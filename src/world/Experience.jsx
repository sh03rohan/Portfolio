import { Suspense, useEffect, useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import {
  OrbitControls,
  AdaptiveDpr,
  KeyboardControls,
  Preload,
  PerformanceMonitor,
  Stats,
} from '@react-three/drei'
import { Physics } from '@react-three/rapier'

import Atmosphere from './Atmosphere.jsx'
import Lighting from './Lighting.jsx'
import Terrain from './Terrain.jsx'
import TerrainCollider from './TerrainCollider.jsx'
import Sea from './Sea.jsx'
import Foliage from './Foliage.jsx'
import Decor from './Decor.jsx'
import Structures from './Structures.jsx'
import Player from './Player.jsx'
import Zones from './Zones.jsx'
import Effects from './Effects.jsx'
import { keyboardMap } from './controls.js'
import { useStore } from '../store.js'

/**
 * Dev affordance: `?cam=x,y,z&look=x,y,z` swaps the player for a free orbit
 * camera at that spot. Handy for reviewing a corner of the island without
 * walking there.
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

function World({ freeCamera }) {
  const debugPhysics = import.meta.env.DEV && new URLSearchParams(window.location.search).has('physics')

  return (
    <>
      <Atmosphere />
      <Lighting />
      <Sea />

      {/* A fixed timestep, deliberately: with "vary" the step equals the frame
          delta, so on a slow device a single step can advance the capsule
          several metres and punch it straight through the ground. Fixed also
          means movement feels identical on 60Hz and 144Hz displays.
          `interpolate` smooths the rendered transform between those fixed
          steps — without it, movement stutters whenever the frame rate and the
          step rate don't line up. */}
      <Physics timeStep={1 / 60} interpolate gravity={[0, -18, 0]} debug={debugPhysics}>
        <Terrain />
        <TerrainCollider />
        {!freeCamera && <Player />}
      </Physics>

      <Foliage />
      <Decor />
      <Structures />
      <Zones />
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
  const showStats = import.meta.env.DEV && new URLSearchParams(window.location.search).has('stats')

  /**
   * Render scale. Starting at 2 is the single most common reason a 3D site
   * feels heavy — it's four times the pixels of dpr 1 for a difference most
   * people can't see. 1.5 is the sweet spot, dropping to 1 when the frame
   * timer says we're struggling.
   */
  const [dpr, setDpr] = useState(1.5)

  return (
    <KeyboardControls map={keyboardMap}>
      <Canvas
        shadows
        dpr={dpr}
        gl={{
          antialias: false, // SMAA in the post stack handles edges
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
          powerPreference: 'high-performance',
        }}
        camera={{ position: override?.position ?? [0, 12, 26], fov: 48, near: 0.5, far: 700 }}
      >
        {/* Steps quality down on weak hardware and back up when there's
            headroom. The store already gates shadow resolution, the post
            stack, cloud volumes and decor density on this. */}
        <PerformanceMonitor
          bounds={() => [45, 58]}
          flipflops={3}
          onDecline={() => {
            setDpr(1)
            const { quality, setQuality } = useStore.getState()
            setQuality(quality === 'high' ? 'medium' : 'low')
          }}
          onIncline={() => {
            setDpr(1.5)
            const { quality, setQuality } = useStore.getState()
            if (quality === 'low') setQuality('medium')
          }}
        >
          <Suspense fallback={null}>
            <World freeCamera={Boolean(override)} />
            <Effects />
            <Preload all />
          </Suspense>
        </PerformanceMonitor>

        {/* `?stats` in dev only — never shipped. */}
        {showStats && <Stats />}
        <AdaptiveDpr pixelated={false} />
        {override && (
          <OrbitControls
            makeDefault
            target={override.target}
            maxPolarAngle={Math.PI * 0.49}
            minDistance={4}
            maxDistance={160}
          />
        )}
      </Canvas>
    </KeyboardControls>
  )
}
