import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  LatheGeometry,
  MeshStandardMaterial,
  Object3D,
  Sphere,
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
 * The drift, in JavaScript.
 *
 * This has to agree with the GLSL in `useLanternMaterial` exactly, because the
 * message label is positioned from it — if the two drift apart, the label sits
 * next to the wrong lantern, or next to nothing. Any change to one is a change
 * to both.
 */
export function lanternOffset(seed, time, out = new Vector3()) {
  const [phase, speed, radius, start] = seed
  const height = (start + time * speed * 0.35) % 1
  const y = height * COLUMN_HEIGHT
  const spread = 1 + height * 10
  return out.set(
    Math.sin(time * 0.19 + phase) * radius * spread,
    y,
    Math.cos(time * 0.16 + phase * 1.31) * radius * spread,
  )
}

/** Deterministic per-lantern character, so a given message always drifts the same way. */
export function lanternSeeds(count, rng = makeRandom(8081)) {
  const seeds = []
  for (let i = 0; i < count; i++) {
    seeds.push([
      rng() * Math.PI * 2, // phase
      0.55 + rng() * 0.55, // rise speed
      0.5 + rng() * 1.6, // sway radius near the platform
      rng(), // starting height through the column
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
          varying float vAltitude; // 0 at the platform, 1 at the top of the column
          `,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          // Under reduced motion the column is frozen where it stands rather
          // than collapsed to the platform — still a sky full of lanterns,
          // just a still one.
          float t = uTime * uAnimate;
          float height = fract( aDrift.w + t * aDrift.y * 0.35 );
          vAltitude = height;

          // They spread as they climb: tight over the brazier, scattered high up.
          float spread = 1.0 + height * 10.0;
          transformed.x += sin( t * 0.19 + aDrift.x ) * aDrift.z * spread;
          transformed.z += cos( t * 0.16 + aDrift.x * 1.31 ) * aDrift.z * spread;
          transformed.y += height * uColumn;
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

    // The drift seeds are a plain instanced attribute, written once.
    if (!instanced.geometry.getAttribute('aDrift')) {
      const data = new Float32Array(cap * 4)
      seeds.forEach((seed, i) => data.set(seed, i * 4))
      instanced.geometry.setAttribute('aDrift', new InstancedBufferAttribute(data, 4))
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

    const sphere = new Sphere(new Vector3(), 0.42)
    const point = new Vector3()

    instanced.raycast = (raycaster, intersects) => {
      const live = visible.length
      const time = uTime.value * uAnimate.value
      for (let i = 0; i < live; i++) {
        lanternOffset(seeds[i], time, point).add(anchor)
        sphere.center.copy(point)
        if (!raycaster.ray.intersectsSphere(sphere)) continue
        intersects.push({
          distance: raycaster.ray.origin.distanceTo(point),
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
        at: visible.slice(0, 12).map((entry, i) => {
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
    />
  )
}
