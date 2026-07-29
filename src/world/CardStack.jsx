import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTransition, a } from '@react-spring/three'
import { Billboard, RoundedBox, Text } from '@react-three/drei'
import { Vector3, DoubleSide } from 'three'
import { useStore } from '../store.js'

/**
 * The content itself, as objects in the world.
 *
 * Cards start collapsed at the structure's origin, so they read as rising out
 * of the building, fan into an arc in front of it, and fly back inside when
 * the zone closes. `useTransition` handles both directions, and `trail`
 * staggers them so it looks dealt rather than switched on.
 */

// Sized for the actual viewing distance: the follow camera sits ~7 units
// behind a player who stops a few metres from the building, so a card is read
// from 10-14 units away. Anything smaller is a grey rectangle.
const CARD_W = 2.05
const CARD_H = 1.4
const RADIUS = 3.9

// Angular step that leaves a small gap between neighbouring cards on the arc:
// chord = 2 * R * sin(step / 2), solved for a chord of one card plus a margin.
const STEP = 2 * Math.asin((CARD_W + 0.14) / (2 * RADIUS))

/** Collapsed at the building's heart — where cards come from and return to. */
const ORIGIN = [0, 0.9, 0]

/** Never more than this many across, or the ends leave the screen. */
const MAX_PER_ROW = 3
// Row centres. With CARD_H 1.4 these leave a clear band at ~2.58, which is
// where Zone.jsx parks its label — so the label never sits on a card.
const ROW_Y = [3.35, 1.8]

/**
 * Fan positions, on an arc centred on the structure.
 *
 * An arc rather than a flat row so every card sits roughly the same distance
 * from the viewer, which keeps the outer ones legible instead of skewed away.
 * Past three cards it wraps to a second row: five across spans ±65°, which at
 * the distance the player actually stands pushes the end cards off both edges
 * of the screen.
 */
function layout(count) {
  const rows = count > MAX_PER_ROW ? 2 : 1
  const perRow = Math.ceil(count / rows)

  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow)
    const inRow = i - row * perRow
    const rowCount = Math.min(perRow, count - row * perRow)

    const offset = inRow - (rowCount - 1) / 2
    const angle = offset * STEP
    const lean = Math.abs(offset) / Math.max(1, rowCount)

    // A single row takes the upper position, keeping the label band below it.
    const y = ROW_Y[row]
    return [Math.sin(angle) * RADIUS, y - lean * 0.28, Math.cos(angle) * RADIUS]
  })
}

/** Shortest-path angle damping, so the fan never spins the long way round. */
function dampAngle(current, target, lambda, delta) {
  let diff = target - current
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return current + diff * (1 - Math.exp(-lambda * delta))
}

export default function CardStack({ open, cards, accent = '#ffc98a' }) {
  const reducedMotion = useStore((s) => s.reducedMotion)
  const targets = useMemo(() => layout(cards.length), [cards.length])

  const fan = useRef()
  const world = useRef(new Vector3())
  const faced = useRef(false)

  /**
   * Swing the whole arc to face the camera.
   *
   * Each card billboards on its own, but their *placement* is fixed in the
   * structure's frame — so without this the fan can open away from whichever
   * side the player walked up on, and they'd be reading the backs of cards
   * arranged behind a building.
   */
  useFrame((state, delta) => {
    const group = fan.current
    if (!group?.parent) return

    if (!open) {
      // Re-aim on the next open rather than sweeping there while closed.
      faced.current = false
      return
    }

    group.parent.getWorldPosition(world.current)
    const camera = state.camera.position
    const target = Math.atan2(camera.x - world.current.x, camera.z - world.current.z)

    // Snap on the frame the zone opens — the cards should already be facing
    // you as they rise, not swing round to find you afterwards. Only once
    // they're out does the arc follow you, and gently.
    if (!faced.current || reducedMotion) {
      group.rotation.y = target
      faced.current = true
      return
    }

    group.rotation.y = dampAngle(group.rotation.y, target, 1.6, Math.min(delta, 0.1))
  })

  const transitions = useTransition(open ? cards : [], {
    keys: (card) => card.title,
    trail: 90,
    from: { p: ORIGIN, s: 0 },
    enter: (card, i) => ({ p: targets[i], s: 1 }),
    leave: { p: ORIGIN, s: 0 },
    config: { mass: 1, tension: 250, friction: 26 },
    immediate: reducedMotion,
  })

  return (
    <group ref={fan}>
      {transitions((style, card) => (
        <a.group position={style.p} scale={style.s}>
          <Billboard>
            <RoundedBox args={[CARD_W, CARD_H, 0.06]} radius={0.07} smoothness={4}>
              <meshStandardMaterial color="#1a162a" roughness={0.55} metalness={0} />
            </RoundedBox>

            {/* A hairline of the zone's accent, so cards belong to their zone. */}
            <mesh position={[0, CARD_H / 2 - 0.055, 0.032]}>
              <planeGeometry args={[CARD_W * 0.8, 0.014]} />
              <meshBasicMaterial color={accent} toneMapped={false} side={DoubleSide} />
            </mesh>

            <Text
              font="/fonts/fraunces.ttf"
              position={[0, CARD_H / 2 - 0.15, 0.04]}
              fontSize={0.115}
              maxWidth={CARD_W - 0.3}
              anchorX="center"
              anchorY="top"
              color={accent}
              outlineWidth={0}
            >
              {card.title}
            </Text>

            <Text
              font="/fonts/inter.ttf"
              // Far enough down to clear a two-line title — several project
              // and job titles wrap.
              position={[0, CARD_H / 2 - 0.5, 0.04]}
              fontSize={0.074}
              maxWidth={CARD_W - 0.32}
              anchorX="center"
              anchorY="top"
              lineHeight={1.4}
              textAlign="center"
              color="#cdbfd6"
            >
              {card.body}
            </Text>

            {card.link && card.link !== '#' && (
              <Text
                font="/fonts/inter.ttf"
                position={[0, -CARD_H / 2 + 0.14, 0.04]}
                fontSize={0.088}
                anchorX="center"
                anchorY="middle"
                color={accent}
                onClick={(event) => {
                  event.stopPropagation()
                  window.open(card.link, '_blank', 'noopener,noreferrer')
                }}
                onPointerOver={(event) => {
                  event.stopPropagation()
                  document.body.style.cursor = 'pointer'
                }}
                onPointerOut={() => {
                  document.body.style.cursor = 'auto'
                }}
              >
                {`${card.linkLabel} →`}
              </Text>
            )}
          </Billboard>
        </a.group>
      ))}
    </group>
  )
}
