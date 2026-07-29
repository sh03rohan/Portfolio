import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useStore } from '../store.js'

/**
 * Rain and snow, as a single points cloud that follows the camera.
 *
 * The field is only ~44 units across and re-centred on the camera each frame,
 * so a few thousand particles cover the whole visible area — there's no point
 * simulating weather over the far side of the island.
 *
 * Both types stay mounted so they can fade rather than pop, but the per-
 * particle loop bails out entirely once a type has faded to nothing. That
 * matters: without it the scene would be integrating five thousand invisible
 * particles every frame in clear weather.
 */
export default function Precip({ type = 'rain', amount = 0 }) {
  const points = useRef()
  const material = useRef()
  const { camera } = useThree()
  // three compiles shaders via traverseVisible, so anything hidden during the
  // warmup pass is skipped and pays for its compile later — as a hitch the
  // first time it rains. Stay visible until the gate opens.
  const ready = useStore((s) => s.ready)

  const AREA = 44
  const HEIGHT = 30
  const count = type === 'rain' ? 3200 : 1400

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * AREA
      positions[i * 3 + 1] = Math.random() * HEIGHT
      positions[i * 3 + 2] = (Math.random() - 0.5) * AREA
      velocities[i] = type === 'rain' ? 18 + Math.random() * 12 : 2 + Math.random() * 2
    }
    return { positions, velocities }
  }, [count, type])

  useFrame((_, rawDelta) => {
    const mesh = points.current
    const mat = material.current
    if (!mesh || !mat) return

    // A backgrounded tab hands back a delta of several seconds. Unclamped,
    // every drop would fall hundreds of units in one step and respawn at the
    // ceiling together, so the rain visibly restarts.
    const delta = Math.min(rawDelta, 1 / 20)

    const target = amount > 0 ? (type === 'rain' ? 0.55 : 0.9) : 0
    mat.opacity += (target - mat.opacity) * Math.min(1, delta * 2.2)

    const visible = mat.opacity > 0.01
    mesh.visible = visible || !ready
    if (!visible) return

    // Snap to whole units so the field doesn't shimmer as the camera drifts.
    mesh.position.set(Math.round(camera.position.x), 0, Math.round(camera.position.z))

    const array = mesh.geometry.attributes.position.array
    const drift = type === 'snow' ? performance.now() * 0.001 : 0
    for (let i = 0; i < count; i++) {
      array[i * 3 + 1] -= velocities[i] * delta
      if (type === 'snow') array[i * 3] += Math.sin(drift + i) * delta * 0.4
      if (array[i * 3 + 1] < 0) array[i * 3 + 1] = HEIGHT
    }
    mesh.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} count={count} />
      </bufferGeometry>
      <pointsMaterial
        ref={material}
        transparent
        opacity={0}
        depthWrite={false}
        sizeAttenuation
        color={type === 'rain' ? '#afc3d6' : '#ffffff'}
        size={type === 'rain' ? 0.09 : 0.14}
      />
    </points>
  )
}
