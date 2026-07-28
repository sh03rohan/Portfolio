import { Environment, Cloud, Clouds, Sparkles } from '@react-three/drei'
import { MeshBasicMaterial } from 'three'
import SkyDome, { SKY } from './SkyDome.jsx'
import { useStore } from '../store.js'

/**
 * Sky, image-based lighting and the airborne detail that gives the island
 * depth: a fog that matches the horizon, slow drifting cloud banks, and motes
 * of dust catching the low sun.
 */
export default function Atmosphere() {
  const quality = useStore((s) => s.quality)
  const reducedMotion = useStore((s) => s.reducedMotion)

  return (
    <>
      {/* Self-hosted CC0 sunset HDRI — lighting and reflections only. */}
      <Environment files="/hdri/sunset.hdr" environmentIntensity={0.6} />

      {/* The sky you actually see, in the brief's palette. */}
      <SkyDome />

      {/* Linear rather than exponential on purpose: exponential fog tints
          everything, including the ground under your feet. This leaves the
          island itself crisp and only dissolves the far sea into the sky. */}
      <fog attach="fog" args={['#8f7aa8', 62, 250]} />

      {quality !== 'low' && (
        <Clouds material={MeshBasicMaterial} limit={220} range={90}>
          <Cloud
            seed={7}
            segments={24}
            bounds={[110, 6, 110]}
            volume={9}
            opacity={0.32}
            color="#f3c39c"
            position={[0, 34, -30]}
            speed={reducedMotion ? 0 : 0.12}
            growth={5}
          />
          <Cloud
            seed={21}
            segments={18}
            bounds={[90, 5, 90]}
            volume={7}
            opacity={0.2}
            color="#b9a5e6"
            position={[20, 44, 40]}
            speed={reducedMotion ? 0 : 0.08}
            growth={6}
          />
        </Clouds>
      )}

      {/* Fireflies / dust motes drifting over the island. */}
      {quality === 'high' && (
        <Sparkles
          count={90}
          scale={[86, 12, 86]}
          position={[0, 7, 0]}
          size={2.6}
          speed={reducedMotion ? 0 : 0.28}
          opacity={0.5}
          color="#ffdca8"
        />
      )}
    </>
  )
}
