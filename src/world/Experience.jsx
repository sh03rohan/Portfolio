import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping } from 'three'
import { OrbitControls, Environment } from '@react-three/drei'

/**
 * Phase 0 — the render surface and its colour pipeline.
 *
 * Everything downstream depends on this being right: ACES Filmic tone mapping
 * plus three's default sRGB output is what keeps the dusk palette rich instead
 * of washed out.
 */
export default function Experience() {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        powerPreference: 'high-performance',
      }}
      camera={{ position: [18, 12, 24], fov: 45, near: 0.1, far: 400 }}
    >
      <color attach="background" args={['#2b2450']} />
      <fog attach="fog" args={['#5a4a86', 40, 160]} />

      <Suspense fallback={null}>
        <Environment preset="sunset" environmentIntensity={0.9} />

        <directionalLight
          castShadow
          position={[24, 22, -12]}
          intensity={2.6}
          color="#ffc98a"
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
        >
          <orthographicCamera attach="shadow-camera" args={[-40, 40, 40, -40, 0.5, 120]} />
        </directionalLight>
        <ambientLight intensity={0.25} color="#8fa8ff" />

        {/* Placeholder ground — replaced by the real island in Phase 1. */}
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <circleGeometry args={[46, 64]} />
          <meshStandardMaterial color="#6f7d4a" roughness={0.95} />
        </mesh>

        <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[3, 3, 3]} />
          <meshStandardMaterial color="#d97a6c" roughness={0.4} metalness={0.1} />
        </mesh>
      </Suspense>

      <OrbitControls makeDefault target={[0, 1.5, 0]} />
    </Canvas>
  )
}
