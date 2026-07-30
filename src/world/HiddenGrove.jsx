import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { AdditiveBlending, Color, MeshStandardMaterial, Vector3 } from 'three'
import { hiddenGrove } from '../data/collectibles.js'
import { MODELS, useModel } from './assets.js'
import { terrainHeight } from './heightfield.js'
import { playerPosition } from './player-position.js'
import { sfx } from './sfx.js'
import { useStore } from '../store.js'

/**
 * One lantern in the most enclosed clearing on the island, with a note.
 *
 * Nothing marks it, it isn't part of the collectible count and it never appears
 * on the minimap — the entire point is that you only find it by wandering
 * somewhere there was no reason to go. The spot wasn't chosen by eye: it's the
 * result of searching the tree scatter for the standable point with the most
 * trunks within seven units that's also a long way from every structure.
 *
 * The note fades with distance rather than snapping on at a trigger radius, so
 * walking up to it feels like the light reaching you.
 */
export default function HiddenGrove() {
  const group = useRef()
  const note = useRef()
  const glow = useRef()
  const reveal = useRef(0)
  const announced = useRef(false)

  const { scene } = useModel(MODELS.lantern)
  const lantern = useMemo(() => scene.clone(true), [scene])

  const position = useMemo(() => {
    const [x, z] = hiddenGrove.position
    return new Vector3(x, terrainHeight(x, z), z)
  }, [])

  const glowMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color('#ffcf8a'),
        emissive: new Color('#ffb060'),
        emissiveIntensity: 2.4,
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  )

  useEffect(() => {
    lantern.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
  }, [lantern])

  useFrame((_, delta) => {
    const player = playerPosition.get()
    const distance = Math.hypot(player.x - position.x, player.z - position.z)

    // 1 at the lantern, 0 at the edge of the radius, easing between.
    const target = Math.max(0, Math.min(1, 1 - (distance - 1.2) / (hiddenGrove.radius - 1.2)))
    reveal.current += (target - reveal.current) * Math.min(1, delta * 3.5)

    if (note.current) {
      note.current.style.opacity = reveal.current.toFixed(3)
      // Rises slightly as it appears, which reads as the note lifting into view
      // rather than a panel switching on.
      note.current.style.transform = `translateY(${((1 - reveal.current) * 14).toFixed(1)}px)`
    }

    if (glow.current) {
      glowMaterial.opacity = 0.35 + reveal.current * 0.5
      glow.current.scale.setScalar(1 + reveal.current * 0.25)
    }

    // Once, on the first visit of the session.
    if (!announced.current && reveal.current > 0.5 && useStore.getState().entered) {
      announced.current = true
      sfx.emit('discover')
    }
  })

  return (
    <group ref={group} position={position}>
      <primitive object={lantern} scale={1.15} />

      {/* Additive halo instead of a real light: one point light here would be
          the only dynamic light in the scene and would cost a shadow pass. */}
      <mesh ref={glow} position={[0, 0.72, 0]} material={glowMaterial}>
        <sphereGeometry args={[0.3, 14, 12]} />
      </mesh>

      <Html
        transform
        distanceFactor={3}
        position={[0, 2.0, 0]}
        // Never a hit target — walking up is the whole interaction.
        style={{ pointerEvents: 'none' }}
        zIndexRange={[20, 10]}
      >
        <div className="grove-note" ref={note} style={{ opacity: 0 }}>
          <p className="grove-note__title">{hiddenGrove.note.title}</p>
          <p className="grove-note__body">{hiddenGrove.note.body}</p>
          <p className="grove-note__sign">{hiddenGrove.note.sign}</p>
        </div>
      </Html>
    </group>
  )
}
