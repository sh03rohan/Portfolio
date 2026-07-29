import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Environment, Cloud, Clouds, Sparkles } from '@react-three/drei'
import { MeshBasicMaterial } from 'three'
import { useStore } from '../store.js'
import { WEATHER } from '../data/weather.js'
import { HDRI } from './assets.js'

/**
 * Reflections and airborne detail.
 *
 * Sky, fog and lights all belong to Weather.jsx — this file deliberately owns
 * none of them, so there's only ever one thing writing `scene.fog` and the
 * sun. What's left is the HDRI (used for image-based reflections only, with
 * its intensity modulated by the weather) and the cloud bank.
 *
 * Cloud opacity is eased by reaching into the instanced mesh's material rather
 * than re-rendering with a new prop — a hard opacity change would pop, and
 * clouds are the one thing you'd notice snapping between presets.
 */
export default function Atmosphere() {
  const quality = useStore((s) => s.quality)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const clouds = useRef()
  const ready = useStore((s) => s.ready)
  const opacity = useRef(WEATHER[useStore.getState().weatherIndex].clouds)

  useFrame((_, delta) => {
    if (!clouds.current) return
    const target = WEATHER[useStore.getState().weatherIndex].clouds
    opacity.current += (target - opacity.current) * Math.min(1, delta * 0.9)

    clouds.current.traverse((child) => {
      if (child.material && 'opacity' in child.material) {
        child.material.transparent = true
        child.material.opacity = opacity.current
      }
    })
    // Visible through warmup so the cloud shader compiles behind the loader.
    clouds.current.visible = opacity.current > 0.02 || !ready
  })

  return (
    <>
      {/* Self-hosted CC0 sunset HDRI — lighting and reflections only. No
          environmentIntensity prop here on purpose: Weather.jsx writes
          scene.environmentIntensity every frame and the two would fight. */}
      <Environment files={HDRI} />

      {quality !== 'low' && (
        <Clouds ref={clouds} material={MeshBasicMaterial} limit={220} range={90}>
          <Cloud
            seed={7}
            segments={24}
            bounds={[110, 6, 110]}
            volume={9}
            opacity={1}
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
            opacity={1}
            color="#b9a5e6"
            position={[20, 44, 40]}
            speed={reducedMotion ? 0 : 0.08}
            growth={6}
          />
        </Clouds>
      )}

      {/* Dust motes catching the low sun. */}
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
