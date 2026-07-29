import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import {
  RingGeometry,
  Color,
  AdditiveBlending,
  ShaderMaterial,
  DoubleSide,
} from 'three'
import { terrainHeight } from './heightfield.js'
import { CARDS } from '../data/cards.js'
import CardStack from './CardStack.jsx'
import { useStore } from '../store.js'

/**
 * A point of interest: a glowing ring on the ground, a floating label, and a
 * warm light that all bloom up as the player walks in.
 *
 * The ring's vertices are pushed onto the terrain so it lies flat on a slope
 * instead of clipping through the hillside.
 */

const ringVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vRadial;
  void main() {
    vUv = uv;
    vRadial = uv.y; // 0 at the inner edge, 1 at the outer
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`

const ringFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uActive;
  uniform float uTime;
  varying vec2 vUv;
  varying float vRadial;

  void main() {
    // Soft band, brightest in the middle of the ring's width.
    float band = smoothstep( 0.0, 0.35, vRadial ) * ( 1.0 - smoothstep( 0.6, 1.0, vRadial ) );

    // A slow pulse that travels outward; it speeds up and brightens on entry.
    float pulse = 0.6 + 0.4 * sin( uTime * ( 1.4 + uActive * 1.8 ) - vRadial * 6.0 );

    float alpha = band * pulse * mix( 0.28, 0.95, uActive );
    gl_FragColor = vec4( uColor * mix( 0.8, 2.1, uActive ), alpha );
  }
`

function useRingGeometry(center, radius) {
  return useMemo(() => {
    const geometry = new RingGeometry(radius * 0.82, radius, 96, 1)
    geometry.rotateX(-Math.PI / 2)

    // Drape the ring over the terrain rather than letting it cut into it.
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i) + center[0]
      const z = position.getZ(i) + center[2]
      position.setY(i, terrainHeight(x, z) - center[1] + 0.06)
    }
    geometry.computeVertexNormals()
    return geometry
  }, [center[0], center[1], center[2], radius])
}

export default function Zone({ zone }) {
  const [x, , z] = zone.position
  const base = useMemo(() => [x, terrainHeight(x, z), z], [x, z])

  const active = useStore((s) => s.nearZone === zone.id)
  const isOpen = useStore((s) => s.openZone === zone.id)
  const toggleZone = useStore((s) => s.toggleZone)
  const reducedMotion = useStore((s) => s.reducedMotion)

  const geometry = useRingGeometry(base, zone.radius)
  const lightRef = useRef()
  const labelRef = useRef()

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: ringVertex,
        fragmentShader: ringFragment,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
        uniforms: {
          uColor: { value: new Color(zone.accent) },
          uActive: { value: 0 },
          uTime: { value: 0 },
        },
      }),
    [zone.accent],
  )

  useFrame((_, delta) => {
    const { uActive, uTime } = material.uniforms
    if (!reducedMotion) uTime.value += delta

    // Ease toward the target so entering and leaving both feel soft.
    const target = active ? 1 : 0
    uActive.value += (target - uActive.value) * Math.min(1, delta * 6)

    if (lightRef.current) {
      lightRef.current.intensity = 2 + uActive.value * 16
    }
    if (labelRef.current) {
      // Sits above the fanned cards, not among them. The top row is centred
      // at 3.35 with cards 1.4 tall, so its upper edge is 4.05 — anything
      // lower than this and the label covers the card behind it.
      const restY = isOpen ? 4.7 : 2.9
      const bob = reducedMotion ? 0 : Math.sin(uTime.value * 1.5) * 0.12
      labelRef.current.position.y +=
        (restY + bob - labelRef.current.position.y) * Math.min(1, delta * 5)
    }
  })

  return (
    <group position={base}>
      {/* Anchored at the structure, so the cards rise out of the building
          itself rather than appearing over the top of the page. */}
      <CardStack open={isOpen} cards={CARDS[zone.id] ?? []} accent={zone.accent} />

      <mesh geometry={geometry} material={material} renderOrder={2} frustumCulled={false} />

      <pointLight
        ref={lightRef}
        position={[0, 2.2, 0]}
        color={zone.accent}
        distance={zone.radius * 3.4}
        decay={2}
        intensity={2}
      />

      <group ref={labelRef} position={[0, 2.9, 0]}>
        {/* Kept well below the .ui layer so labels can't sit over the loader
            or the panels. */}
        <Html center distanceFactor={13} zIndexRange={[20, 0]} pointerEvents="auto">
          <button
            type="button"
            className={`zone-label${active ? ' is-active' : ''}${isOpen ? ' is-open' : ''}`}
            style={{ '--accent': zone.accent }}
            onClick={(event) => {
              event.stopPropagation()
              toggleZone(zone.id)
            }}
            aria-label={`${zone.label} — ${isOpen ? 'close' : 'open'}`}
          >
            <span className="zone-label__title">{zone.label}</span>
            <span className="zone-label__hint">
              {isOpen ? 'Press E to close' : active ? 'Press E' : zone.hint}
            </span>
          </button>
        </Html>
      </group>
    </group>
  )
}
