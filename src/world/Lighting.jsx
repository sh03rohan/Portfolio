import { SoftShadows } from '@react-three/drei'
import { island } from '../data/world.js'
import { useStore } from '../store.js'

/**
 * Golden-hour key light plus a cool sky fill.
 *
 * The HDRI in Atmosphere.jsx supplies the ambient/indirect term, so this file
 * only has to do two things: cast the long warm shadows that sell the time of
 * day, and lift the shadow side with a complementary blue so nothing goes flat
 * black.
 */
export default function Lighting() {
  const quality = useStore((s) => s.quality)
  const shadowMap = quality === 'high' ? 2048 : quality === 'medium' ? 1024 : 512
  const span = island.radius + 8

  return (
    <>
      {quality === 'high' && <SoftShadows size={26} samples={12} focus={0.6} />}

      {/* Low, warm sun sitting just above the horizon. */}
      <directionalLight
        castShadow
        position={[-52, 26, -34]}
        intensity={3.8}
        color="#ffb877"
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.035}
      >
        <orthographicCamera attach="shadow-camera" args={[-span, span, span, -span, 1, 190]} />
      </directionalLight>

      {/* Cool bounce from the opposite side, so shadows read violet not black. */}
      <directionalLight position={[34, 14, 30]} intensity={0.4} color="#8ea6ff" />

      {/* Ground bounce — a touch of warmth from below. */}
      <hemisphereLight args={['#a894d8', '#5f4a2e', 0.28]} />
    </>
  )
}
