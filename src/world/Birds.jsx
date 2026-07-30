import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  MeshStandardMaterial,
  Matrix4,
  Sphere,
  Vector3,
} from 'three'
import { WEATHER } from '../data/weather.js'
import { makeRandom } from './heightfield.js'
import { uTime } from './wind.js'
import { useStore } from '../store.js'

/**
 * A flock wheeling over the island.
 *
 * Every bird's position, heading and wingbeat is solved in the vertex shader
 * from four numbers held on the instance, so the CPU touches this exactly once
 * at mount and never again — no per-bird object, no per-frame loop, no React
 * state. The instance matrices are left as identity on purpose: the shader
 * builds the full transform itself, which is the only way to make the birds
 * *fly* rather than sit at fixed points.
 */

/** Radius of the wing span, in model units — the flap weight is normalised to it. */
const SPAN = 0.62

/**
 * Ten triangles: an octahedral body with a triangular wing either side.
 *
 * At the altitude these fly, a bird is a silhouette with a wingbeat and
 * nothing else; spending vertices on a head would buy nothing you could see.
 * `aFlap` is how far out the wing a vertex sits, which is what the shader
 * bends against so the wing roots stay attached to the body.
 */
function makeBirdGeometry() {
  const N = [0, 0, 0.42] // nose
  const T = [0, 0, -0.46] // tail
  const L = [-0.06, 0, 0]
  const R = [0.06, 0, 0]
  const U = [0, 0.06, 0]
  const D = [0, -0.05, 0]

  // Wound so every face points outward — computeVertexNormals is only as good
  // as the winding it's given, and an inverted face reads as a black notch.
  const faces = [
    [N, R, U], [N, U, L], [N, L, D], [N, D, R],
    [T, U, R], [T, L, U], [T, D, L], [T, R, D],
    // Wings, drawn double-sided so they read from above and below.
    [[0, 0.03, 0.16], [0, 0.03, -0.22], [-SPAN, 0.02, -0.02]],
    [[0, 0.03, -0.22], [0, 0.03, 0.16], [SPAN, 0.02, -0.02]],
  ]

  const positions = []
  const flap = []
  for (const face of faces) {
    for (const [x, y, z] of face) {
      positions.push(x, y, z)
      flap.push(Math.abs(x) / SPAN)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('aFlap', new Float32BufferAttribute(flap, 1))
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Loose flocks rather than evenly spaced birds: real ones travel together, and
 * a ring of equally spaced dots is unmistakably a carousel. Each flock gets one
 * orbit and its members jitter around it.
 */
function makeFlightAttributes(count, seed = 5) {
  const random = makeRandom(seed)
  const path = new Float32Array(count * 4)
  const bird = new Float32Array(count * 3)

  const flocks = Math.max(1, Math.round(count / 5))
  const shapes = []
  for (let f = 0; f < flocks; f++) {
    shapes.push({
      radius: 26 + random() * 30,
      altitude: 30 + random() * 22,
      // Both directions, so the sky isn't one synchronised roundabout.
      speed: (0.055 + random() * 0.05) * (random() > 0.5 ? 1 : -1),
      phase: random() * Math.PI * 2,
    })
  }

  for (let i = 0; i < count; i++) {
    const flock = shapes[i % flocks]
    path[i * 4 + 0] = flock.radius + (random() - 0.5) * 9
    path[i * 4 + 1] = flock.altitude + (random() - 0.5) * 7
    path[i * 4 + 2] = flock.speed * (1 + (random() - 0.5) * 0.12)
    path[i * 4 + 3] = flock.phase + (random() - 0.5) * 0.5

    bird[i * 3 + 0] = 0.9 + random() * 0.8 // scale
    bird[i * 3 + 1] = 5.5 + random() * 3.5 // wingbeat rate
    bird[i * 3 + 2] = 1.2 + random() * 2.2 // vertical bob
  }

  return { path, bird }
}

function useBirdMaterial() {
  return useMemo(() => {
    const material = new MeshStandardMaterial({
      // Read as silhouettes: dark, matt, and lit mostly by the sky.
      color: new Color('#2a3040'),
      roughness: 0.92,
      metalness: 0,
      side: DoubleSide,
      transparent: true,
      opacity: 0,
    })

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform float uTime;
          attribute vec4 aPath;   // orbit radius, altitude, angular speed, phase
          attribute vec3 aBird;   // scale, wingbeat rate, bob amplitude
          attribute float aFlap;  // 0 at the body, 1 at the wingtip

          // Forward is the tangent of the orbit. Flipping both the forward and
          // the right vector for anticlockwise birds keeps the basis
          // right-handed, so their normals don't invert.
          mat3 birdBasis( float angle ) {
            float dir = aPath.z < 0.0 ? -1.0 : 1.0;
            vec3 f = dir * vec3( -sin( angle ), 0.0, cos( angle ) );
            vec3 r = dir * vec3( cos( angle ), 0.0, sin( angle ) );
            return mat3( r, vec3( 0.0, 1.0, 0.0 ), f );
          }

          vec3 birdCentre( float angle ) {
            return vec3(
              cos( angle ) * aPath.x,
              aPath.y + sin( angle * 1.7 + aPath.w ) * aBird.z,
              sin( angle ) * aPath.x
            );
          }
          `,
        )
        // Rotate the normals into the flight basis too, or every bird is lit
        // as though it were facing +Z no matter where it is on the circle.
        .replace(
          '#include <beginnormal_vertex>',
          /* glsl */ `
          #include <beginnormal_vertex>
          objectNormal = birdBasis( uTime * aPath.z + aPath.w ) * objectNormal;
          `,
        )
        .replace(
          '#include <begin_vertex>',
          /* glsl */ `
          #include <begin_vertex>
          float angle = uTime * aPath.z + aPath.w;
          float beat = sin( uTime * aBird.y + aPath.w * 3.7 );
          vec3 p = transformed;
          p.y += aFlap * beat * 0.34;
          // Foreshorten the span on the downstroke — wings that only pivot
          // look like they're waving rather than pushing air.
          p.x *= mix( 1.0, 0.86, abs( beat ) );
          p *= aBird.x;
          transformed = birdBasis( angle ) * p + birdCentre( angle );
          `,
        )
    }

    material.customProgramCacheKey = () => 'birds-v1'
    return material
  }, [])
}

export default function Birds() {
  const quality = useStore((s) => s.quality)
  const mesh = useRef()
  const material = useBirdMaterial()
  const opacity = useRef(0)

  const count = quality === 'high' ? 20 : quality === 'medium' ? 12 : 0
  const geometry = useMemo(makeBirdGeometry, [])

  useLayoutEffect(() => {
    const instanced = mesh.current
    if (!instanced || !count) return

    const { path, bird } = makeFlightAttributes(count)
    instanced.geometry.setAttribute('aPath', new InstancedBufferAttribute(path, 4))
    instanced.geometry.setAttribute('aBird', new InstancedBufferAttribute(bird, 3))

    // The shader builds the whole transform itself, so the instance matrices
    // only have to be *something* valid — InstancedMesh starts them at all
    // zeros, which collapses every bird to a point at the origin.
    const identity = new Matrix4()
    for (let i = 0; i < count; i++) instanced.setMatrixAt(i, identity)
    instanced.instanceMatrix.needsUpdate = true

    // Nothing three can derive from the geometry knows where these end up, so
    // the bounds are stated by hand: one sphere holding every orbit.
    instanced.geometry.boundingSphere = new Sphere(new Vector3(0, 40, 0), 100)
  }, [count])

  useFrame((_, delta) => {
    const instanced = mesh.current
    if (!instanced) return
    const { weatherIndex, ready } = useStore.getState()
    const target = WEATHER[weatherIndex].birds
    opacity.current += (target - opacity.current) * Math.min(1, delta * 0.7)
    material.opacity = opacity.current
    // Kept visible through warmup: three compiles via traverseVisible, so a
    // hidden flock would compile its shader the first time the sky cleared.
    instanced.visible = opacity.current > 0.01 || !ready
  })

  if (!count) return null

  return (
    <instancedMesh
      key={count}
      ref={mesh}
      args={[geometry, material, count]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
    />
  )
}
