import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  LatheGeometry,
  MeshStandardMaterial,
  Object3D,

  Vector2,
  Vector3,
} from 'three'
import { zoneById } from '../data/world.js'
import { terrainHeight, makeRandom } from './heightfield.js'
import { uTime, uAnimate } from './wind.js'
import { useStore } from '../store.js'

/**
 * Every visitor's lantern, drifting up over the island.
 *
 * One instanced mesh for the whole sky. The rise, the sway and the flicker are
 * all solved in the vertex shader from four numbers per lantern, so the CPU
 * only ever touches this when somebody releases one.
 *
 * The mesh is allocated once at the tier's cap and never resized. Releasing a
 * lantern writes a single instance matrix and bumps `mesh.count`; rebuilding
 * the mesh to add one would drop the sky's shader and rebuild it at exactly
 * the moment the visitor is watching their own lantern go up.
 */

/**
 * How high the column runs before a lantern wraps back to the platform.
 *
 * Tuned against the camera, not against realism. At 78 the column looked right
 * in isolation and was almost entirely outside the frustum in practice: the
 * follow camera sits ~2 units up with a 48° fov, so anything much above 45
 * units needs the player to crane past the up-limit to see it at all. 46 keeps
 * the whole column reachable by an ordinary drag, and reachable is the point —
 * you're meant to be able to read these.
 */
export const COLUMN_HEIGHT = 46

/** Where they're launched from, and where a new one starts. */
export function platformAnchor() {
  const zone = zoneById.guestbook
  const [x, , z] = zone.position
  return new Vector3(x, terrainHeight(x, z) + 1.2, z)
}

/**
 * What fraction of lanterns stay down in the readable band.
 *
 * The column alone was the wrong answer. Sky lanterns really do go up and away,
 * and the honest version of that put every message either too high to read or
 * too small to tap — a guestbook nobody can actually read is just a particle
 * effect. So a bit over a third of them circle the platform at head height,
 * close enough to read at a glance, and the rest carry on up for the view.
 */
export const BAND_SHARE = 0.38

/**
 * The band's floor, its vertical travel, and how far out it orbits.
 *
 * Pushed out from an earlier 3.5–5.5 and lifted from 1.5: at the tighter radius
 * a lantern regularly parked between the follow camera and the character, which
 * is a glowing blob over the thing you're controlling. At 5–8 units and just
 * above head height they drift past rather than through.
 */
const BAND_LOW = 1.9
const BAND_RISE = 2.3
const BAND_RING = 4.4
const BAND_RING_SPREAD = 2.3

/**
 * How far off-centre a tap can be and still count, as a ratio of distance.
 *
 * The camera's vertical half-angle is 24°, i.e. tan ≈ 0.445 across half the
 * viewport — so on a 640px-tall window one pixel is about 0.0014 of this ratio,
 * and 0.022 works out to a target roughly sixteen pixels across whether the
 * lantern is three units away or forty.
 */
const ANGULAR_TOLERANCE = 0.022

/**
 * The drift, in JavaScript.
 *
 * This has to agree with the GLSL in `useLanternMaterial` **exactly**, because
 * both the message label and the click target are positioned from it — if the
 * two drift apart you tap one lantern and read another's message. Any change
 * to one is a change to both.
 */
export function lanternOffset(seed, time, out = new Vector3()) {
  const [phase, speed, radius, start, band] = seed

  if (band > 0.5) {
    // A slow carousel at eye level: bobs between 1.5 and 3.8, orbiting the
    // brazier a few units out.
    const bob = 0.5 + 0.5 * Math.sin(time * 0.45 * speed + phase)
    const angle = time * 0.12 * speed + phase
    const ring = BAND_RING + radius * BAND_RING_SPREAD
    return out.set(
      Math.cos(angle) * ring,
      BAND_LOW + bob * BAND_RISE,
      Math.sin(angle) * ring,
    )
  }

  const height = (start + time * speed * 0.35) % 1
  const spread = 1 + height * 10
  return out.set(
    Math.sin(time * 0.19 + phase) * radius * spread,
    height * COLUMN_HEIGHT,
    Math.cos(time * 0.16 + phase * 1.31) * radius * spread,
  )
}

/**
 * Deterministic per-lantern character, so a given message always drifts the
 * same way — and, because the band flag is part of it, always stays in the same
 * layer. A message that migrated between the band and the column on reload
 * would make the sky feel arbitrary.
 */
export function lanternSeeds(count, rng = makeRandom(8081)) {
  const seeds = []
  for (let i = 0; i < count; i++) {
    // Every third-ish lantern, spread evenly rather than randomly, so the
    // newest few messages are never all stuck up in the column.
    const band = i % 3 === 1 ? 1 : rng() < BAND_SHARE * 0.35 ? 1 : 0
    seeds.push([
      rng() * Math.PI * 2, // phase
      0.55 + rng() * 0.55, // rise speed / orbit rate
      0.5 + rng() * 1.6, // sway radius
      rng(), // starting height through the column
      band, // 1 = readable band, 0 = climbing
    ])
  }
  return seeds
}

function makeLanternGeometry() {
  // A paper-lantern profile: narrow mouth at the bottom, belly, domed top.
  const profile = [
    [0.03, 0],
    [0.15, 0.05],
    [0.25, 0.16],
    [0.3, 0.3],
    [0.29, 0.42],
    [0.2, 0.51],
    [0.07, 0.56],
    [0.01, 0.575],
  ].map(([r, y]) => new Vector2(r, y))

  const geometry = new LatheGeometry(profile, 12)
  // Centre it so the shader's offsets read as "the lantern", not "its base".
  geometry.translate(0, -0.28, 0)
  return geometry
}

function useLanternMaterial() {
  return useMemo(() => {
    const material = new MeshStandardMaterial({
      color: new Color('#ffffff'),
      emissive: new Color('#ffb066'),
      emissiveIntensity: 1.9,
      roughness: 0.85,
      metalness: 0,
      // Paper: you see the far wall lit from inside.
      side: DoubleSide,
      transparent: true,
      opacity: 1,
    })

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.uniforms.uAnimate = uAnimate
      shader.uniforms.uColumn = { value: COLUMN_HEIGHT }

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uTime;
          uniform float uAnimate;
          uniform float uColumn;
          attribute vec4 aDrift;   // phase, rise speed, sway radius, start height
          attribute float aBand;   // 1 = readable band, 0 = climbing
          varying float vAltitude; // 0 at the platform, 1 at the top of the column
          `,
        )
        // Mirrored by lanternOffset() in this file. The label and the click
        // target are both placed from the JavaScript copy, so the two must
        // stay identical — change one, change the other.
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          // Under reduced motion the sky is frozen where it stands rather than
          // collapsed to the platform — still a sky full of lanterns, just a
          // still one.
          float t = uTime * uAnimate;

          if ( aBand > 0.5 ) {
            // The readable band: a slow carousel at head height, close enough
            // in to read and to tap.
            float bob = 0.5 + 0.5 * sin( t * 0.45 * aDrift.y + aDrift.x );
            float angle = t * 0.12 * aDrift.y + aDrift.x;
            float ring = ${BAND_RING.toFixed(2)} + aDrift.z * ${BAND_RING_SPREAD.toFixed(2)};
            transformed.x += cos( angle ) * ring;
            transformed.z += sin( angle ) * ring;
            transformed.y += ${BAND_LOW.toFixed(2)} + bob * ${BAND_RISE.toFixed(2)};
            // Held at the warm end of the ramp — these are the ones being read.
            vAltitude = 0.08;
          } else {
            float height = fract( aDrift.w + t * aDrift.y * 0.35 );
            vAltitude = height;
            // They spread as they climb: tight over the brazier, scattered high.
            float spread = 1.0 + height * 10.0;
            transformed.x += sin( t * 0.19 + aDrift.x ) * aDrift.z * spread;
            transformed.z += cos( t * 0.16 + aDrift.x * 1.31 ) * aDrift.z * spread;
            transformed.y += height * uColumn;
          }
          `,
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uTime;
          varying float vAltitude;
          `,
        )
        // Colour and brightness are altitude-dependent: warmest and strongest
        // over the brazier, cooling and thinning with height so the column
        // reads as deep rather than as a wall of identical dots.
        .replace(
          '#include <emissivemap_fragment>',
          /* glsl */ `
          #include <emissivemap_fragment>
          #ifdef USE_INSTANCING_COLOR
            totalEmissiveRadiance *= vColor;
          #endif
          float flicker = 0.88 + 0.12 * sin( uTime * 5.3 + vAltitude * 40.0 );
          float cool = 1.0 - smoothstep( 0.15, 1.0, vAltitude ) * 0.55;
          totalEmissiveRadiance *= flicker * cool;
          `,
        )
        .replace(
          '#include <opaque_fragment>',
          /* glsl */ `
          diffuseColor.a *= 1.0 - smoothstep( 0.72, 1.0, vAltitude );
          #include <opaque_fragment>
          `,
        )
    }

    material.customProgramCacheKey = () => 'sky-lantern-v1'
    return material
  }, [])
}

export default function SkyLanterns() {
  const quality = useStore((s) => s.quality)
  const lanterns = useStore((s) => s.lanterns)
  const readLantern = useStore((s) => s.readLantern)
  const hoverLantern = useStore((s) => s.hoverLantern)

  const cap = quality === 'high' ? 300 : quality === 'medium' ? 150 : 60
  const mesh = useRef()
  const material = useLanternMaterial()
  const geometry = useMemo(makeLanternGeometry, [])
  const anchor = useMemo(platformAnchor, [])

  /** Newest first, capped. Seeds are per-slot so a lantern keeps its drift. */
  const visible = useMemo(() => lanterns.slice(0, cap), [lanterns, cap])
  const seeds = useMemo(() => lanternSeeds(cap), [cap])

  // The whole capacity is allocated once. Only the live prefix is drawn.
  useLayoutEffect(() => {
    const instanced = mesh.current
    if (!instanced) return

    // The drift seeds are plain instanced attributes, written once.
    if (!instanced.geometry.getAttribute('aDrift')) {
      const drift = new Float32Array(cap * 4)
      const band = new Float32Array(cap)
      seeds.forEach((seed, i) => {
        drift.set(seed.slice(0, 4), i * 4)
        band[i] = seed[4]
      })
      instanced.geometry.setAttribute('aDrift', new InstancedBufferAttribute(drift, 4))
      instanced.geometry.setAttribute('aBand', new InstancedBufferAttribute(band, 1))
    }

    const dummy = new Object3D()
    const tint = new Color()

    for (let i = 0; i < cap; i++) {
      dummy.position.copy(anchor)
      dummy.scale.setScalar(i < visible.length ? 1 : 0)
      dummy.updateMatrix()
      instanced.setMatrixAt(i, dummy.matrix)

      // Hue comes off the message, so a lantern's colour is its author's.
      const hue = (((visible[i]?.hue ?? 30) % 360) + 360) % 360
      tint.setHSL(hue / 360, 0.55, 0.62)
      instanced.setColorAt(i, tint)
    }

    instanced.count = Math.max(1, visible.length)
    instanced.instanceMatrix.needsUpdate = true
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true
    instanced.visible = visible.length > 0
  }, [visible, cap, anchor, seeds])

  /**
   * Picking, done by hand.
   *
   * three raycasts an InstancedMesh against its CPU-side geometry and instance
   * matrices — and every one of those matrices says "at the platform", because
   * the drift only exists in the vertex shader. Left alone, clicking a lantern
   * a hundred feet up hits nothing and clicking empty air over the brazier hits
   * all three hundred.
   *
   * So the ray is tested against a sphere at each lantern's *animated* position,
   * from the same `lanternOffset()` the shader mirrors. Three hundred sphere
   * tests only happen on an actual click, which is far cheaper than writing
   * three hundred matrices every frame to keep three's picking informed.
   */
  useLayoutEffect(() => {
    const instanced = mesh.current
    if (!instanced) return

    const point = new Vector3()
    const toward = new Vector3()

    instanced.raycast = (raycaster, intersects) => {
      const live = visible.length
      const time = uTime.value * uAnimate.value

      for (let i = 0; i < live; i++) {
        lanternOffset(seeds[i], time, point).add(anchor)

        // Decompose the offset from the camera into "along the ray" and
        // "perpendicular to it".
        toward.subVectors(point, raycaster.ray.origin)
        const along = toward.dot(raycaster.ray.direction)
        if (along <= 0) continue // behind the camera
        const perp = Math.sqrt(Math.max(0, toward.lengthSq() - along * along))

        /**
         * An *angular* tolerance, not a sphere.
         *
         * A fixed-radius sphere is a comfortable target at three metres and a
         * two-pixel needle at forty, so the lanterns up in the column were
         * unclickable. Scaling the radius with distance fixes that and creates
         * a worse problem: at 2.4 units the spheres in the low band overlap so
         * heavily that tapping one reliably gets you a neighbour's message.
         *
         * Comparing `perp` against `along` instead makes the target a constant
         * *angle*, which is a constant size on screen at every distance — near
         * or far, you're aiming at about sixteen pixels. Overlaps then resolve
         * the way they look: R3F takes the smallest `distance`, so the lantern
         * in front wins, which is the one the visitor can see.
         */
        if (perp > along * ANGULAR_TOLERANCE + 0.2) continue

        intersects.push({
          distance: along,
          point: point.clone(),
          object: instanced,
          instanceId: i,
        })
      }
    }
  }, [visible, seeds, anchor])

  // Compiled while empty would mean compiling on the first release instead, so
  // the sky is forced visible through warmup like everything else that hides.
  useFrame(({ camera, size }) => {
    const instanced = mesh.current
    if (!instanced) return
    if (!useStore.getState().ready) instanced.visible = true
    else instanced.visible = visible.length > 0

    if (import.meta.env.DEV) {
      // Where each lantern currently is, in world *and* screen space. The
      // screen half is what makes the picking testable: the drift only exists
      // on the GPU, so without this there's no way to aim at one on purpose.
      const time = uTime.value * uAnimate.value
      const point = new Vector3()
      window.__lanterns = {
        count: instanced.count,
        live: visible.length,
        at: visible.map((entry, i) => {
          lanternOffset(seeds[i], time, point).add(anchor)
          const projected = point.clone().project(camera)
          return {
            name: entry.name,
            world: [+point.x.toFixed(1), +point.y.toFixed(1), +point.z.toFixed(1)],
            screen: [
              Math.round(((projected.x + 1) / 2) * size.width),
              Math.round(((1 - projected.y) / 2) * size.height),
            ],
            inFront: projected.z < 1,
          }
        }),
      }
    }
  })

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, cap]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      onClick={(event) => {
        // R3F hands back which instance was hit; that's the index into the
        // visible list, which is the index into the message list.
        if (event.instanceId == null || event.instanceId >= visible.length) return
        event.stopPropagation()
        readLantern(event.instanceId)
      }}
      // Hover previews without committing. Touch has no hover, so tapping has
      // to work on its own — it does, via onClick above; this is a mouse
      // affordance on top, not the mechanism.
      onPointerMove={(event) => {
        if (event.instanceId == null || event.instanceId >= visible.length) return
        event.stopPropagation()
        hoverLantern(event.instanceId)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        hoverLantern(null)
        document.body.style.cursor = ''
      }}
    />
  )
}
