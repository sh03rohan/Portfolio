import { Suspense, useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import { OrbitControls, AdaptiveDpr, BakeShadows } from '@react-three/drei'

import Atmosphere from './Atmosphere.jsx'
import Lighting from './Lighting.jsx'
import Terrain from './Terrain.jsx'
import Sea from './Sea.jsx'
import Foliage from './Foliage.jsx'
import Decor from './Decor.jsx'
import Structures from './Structures.jsx'
import Effects from './Effects.jsx'
import { useStore } from '../store.js'

/**
 * Dev affordance: `?cam=x,y,z&look=x,y,z` positions the review camera.
 * Handy for grabbing a specific spot on the island without editing code.
 */
function readCameraOverride() {
  if (!import.meta.env.DEV) return null
  const params = new URLSearchParams(window.location.search)
  const parse = (key) => {
    const raw = params.get(key)
    if (!raw) return null
    const parts = raw.split(',').map(Number)
    return parts.length === 3 && parts.every(Number.isFinite) ? parts : null
  }
  const position = parse('cam')
  if (!position) return null
  return { position, target: parse('look') ?? [0, 2, 0] }
}

/** Watches the OS motion preference and mirrors it into the store. */
function useReducedMotionSync() {
  const setReducedMotion = useStore((s) => s.setReducedMotion)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [setReducedMotion])
}

function World() {
  return (
    <>
      <Atmosphere />
      <Lighting />
      <Terrain />
      <Sea />
      <Foliage />
      <Decor />
      <Structures />
    </>
  )
}

/**
 * The render surface and its colour pipeline: ACES Filmic tone mapping with
 * three's sRGB output, dpr capped at 2, shadows on. Everything about how the
 * dusk palette reads depends on these three lines being right.
 */
export default function Experience() {
  useReducedMotionSync()
  const override = useMemo(readCameraOverride, [])

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: false, // SMAA in the post stack handles edges
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        powerPreference: 'high-performance',
      }}
      camera={{ position: override?.position ?? [30, 16, 38], fov: 48, near: 0.5, far: 700 }}
    >
      <Suspense fallback={null}>
        <World />
        <Effects />
      </Suspense>

      <AdaptiveDpr pixelated={false} />
      <OrbitControls
        makeDefault
        target={override?.target ?? [0, 3, 0]}
        maxPolarAngle={Math.PI * 0.49}
        minDistance={12}
        maxDistance={120}
      />
    </Canvas>
  )
}
