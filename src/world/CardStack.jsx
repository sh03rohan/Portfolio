import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTransition, a } from '@react-spring/three'
import { Html, Billboard } from '@react-three/drei'
import { Vector3 } from 'three'
import { useStore } from '../store.js'
import './cards.css'

/**
 * The content itself, as objects in the world.
 *
 * Cards start collapsed at the structure's origin, so they read as rising out
 * of the building, spread into a grid in front of it, and fly back inside when
 * the zone closes. `useTransition` handles both directions, and `trail`
 * staggers them so it looks dealt rather than switched on.
 *
 * The cards are real DOM placed in the scene by <Html transform> — that's what
 * makes the type crisp and lets one stylesheet describe three card layouts.
 * The trade is that they don't depth-test against the scene, so they always
 * draw over the world; keeping them out in front of the building is what stops
 * that being noticeable.
 */

/**
 * drei's <Html transform> scales at `distanceFactor / 400` world units per CSS
 * pixel. The cards are 300px wide, so at distanceFactor 3 each one occupies
 * 300 * 3 / 400 = 2.25 world units — which is what the gap below has to clear.
 * At the stock 5 they were 3.75 units wide against a 2.1 gap and overlapped
 * each other by half.
 */
const DISTANCE_FACTOR = 3
const CARD_GAP_X = 2.55

// Row centres. The tallest card (variant B, with its bullet list) is roughly
// 1.8 units, so the rows need better than that between them, and the lower row
// has to stay clear of the ground.
const ROW_Y = [3.3, 1.25]
const DEPTH = 2.6

/**
 * How many columns to use.
 *
 * Two rows maximum, always: at this card size a third row lands below the
 * structure's base and its bottom half is buried in the hillside.
 */
const columnsFor = (count) => (count <= 2 ? count : count <= 4 ? 2 : 3)

function layout(count) {
  const cols = columnsFor(count)

  return Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / cols)
    const col = i - row * cols
    // The last row is often short — centre it on its own width, not the grid's.
    const inRow = Math.min(cols, count - row * cols)
    return [(col - (inRow - 1) / 2) * CARD_GAP_X, ROW_Y[row] ?? ROW_Y[1], DEPTH]
  })
}

/** Shortest-path angle damping, so the grid never spins the long way round. */
function dampAngle(current, target, lambda, delta) {
  let diff = target - current
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return current + diff * (1 - Math.exp(-lambda * delta))
}

function CardDOM({ card }) {
  const style = { '--accent': card.accent }

  if (card.variant === 'B') {
    return (
      <div className="card3d vB" style={style}>
        <div className="b-badge">
          <svg
            className="icn"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          {card.period}
        </div>
        <div className="b-role">{card.role}</div>
        <div className="b-org">
          <span className="dot" />
          {card.org}
        </div>
        <ul>
          {card.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    )
  }

  if (card.variant === 'D') {
    return (
      <div className="card3d vD" style={style}>
        <div className="d-band">
          <div className="d-eye">{card.eyebrow}</div>
          <div className="d-role">{card.title}</div>
          <div className="d-sub">
            <span>{card.org}</span>
            <span>{card.period}</span>
          </div>
        </div>
        <div className="d-body">{card.body}</div>
      </div>
    )
  }

  return (
    <div className="card3d vA" style={style}>
      <div className="a-role">{card.title}</div>
      {card.meta && <div className="a-meta">{card.meta}</div>}
      {card.period && <div className="a-period">{card.period}</div>}
      {card.body && <p>{card.body}</p>}
      {/* '#' is a placeholder handle in content.js — don't offer a dead link. */}
      {card.link && card.link !== '#' && (
        <a
          href={card.link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          {card.linkLabel} →
        </a>
      )}
    </div>
  )
}

export default function CardStack({ open, cards }) {
  const reducedMotion = useStore((s) => s.reducedMotion)
  const targets = useMemo(() => layout(cards.length), [cards.length])

  const fan = useRef()
  const world = useRef(new Vector3())
  const faced = useRef(false)

  /**
   * Swing the whole grid to face the camera.
   *
   * Each card billboards on its own, but their *placement* is fixed in the
   * structure's frame — so without this the grid can open on the far side of a
   * building from wherever the player walked up, and the content sits behind a
   * wall. It snaps on the frame the zone opens, then follows gently.
   */
  useFrame((state, delta) => {
    const group = fan.current
    if (!group?.parent) return

    if (!open) {
      faced.current = false
      return
    }

    group.parent.getWorldPosition(world.current)
    const camera = state.camera.position
    const target = Math.atan2(camera.x - world.current.x, camera.z - world.current.z)

    if (!faced.current || reducedMotion) {
      group.rotation.y = target
      faced.current = true
      return
    }

    group.rotation.y = dampAngle(group.rotation.y, target, 1.6, Math.min(delta, 0.1))
  })

  const transitions = useTransition(open ? cards : [], {
    keys: (_, i) => i,
    trail: 80,
    from: { p: [0, 0.4, 0], s: 0 },
    enter: (card, i) => ({ p: targets[i], s: 1 }),
    leave: { p: [0, 0.4, 0], s: 0 },
    config: { mass: 1, tension: 250, friction: 26 },
    immediate: reducedMotion,
  })

  return (
    <group ref={fan}>
      {transitions((style, card) => (
        <a.group position={style.p} scale={style.s}>
          <Billboard>
            {/* Below the .ui layer's z-index so the loader and HUD stay on top. */}
            <Html
              transform
              distanceFactor={DISTANCE_FACTOR}
              center
              zIndexRange={[20, 0]}
              style={{ pointerEvents: 'auto' }}
            >
              <CardDOM card={card} />
            </Html>
          </Billboard>
        </a.group>
      ))}
    </group>
  )
}
