import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Vector3 } from 'three'
import { lanternOffset, lanternSeeds, platformAnchor } from './SkyLanterns.jsx'
import { uTime, uAnimate } from './wind.js'
import { useStore } from '../store.js'

/**
 * The message on the lantern you tapped.
 *
 * It has to chase a target that only exists on the GPU, so the label's group is
 * moved every frame from `lanternOffset()` — the JavaScript mirror of the drift
 * in the vertex shader. That's the whole reason the mirror exists.
 *
 * One at a time: tapping another lantern moves this label rather than opening a
 * second, and Esc or a tap on empty air closes it.
 */

/** Same cap as SkyLanterns, so seed indices line up. */
const CAPS = { high: 300, medium: 150, low: 60 }

const RELATIVE = [
  [60, 'just now'],
  [3600, 'a few minutes ago'],
  [86400, 'today'],
  [172800, 'yesterday'],
  [604800, 'this week'],
  [2592000, 'this month'],
]

function relativeTime(iso) {
  const then = Date.parse(iso)
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(0, (Date.now() - then) / 1000)
  for (const [limit, label] of RELATIVE) if (seconds < limit) return label
  const months = Math.round(seconds / 2592000)
  return months >= 12 ? 'over a year ago' : `${months} months ago`
}

export default function LanternMessage() {
  const quality = useStore((s) => s.quality)
  const lanterns = useStore((s) => s.lanterns)
  const index = useStore((s) => s.readingLantern)
  const closeLantern = useStore((s) => s.closeLantern)

  const group = useRef()
  const anchor = useMemo(platformAnchor, [])
  const seeds = useMemo(() => lanternSeeds(CAPS[quality] ?? CAPS.high), [quality])
  const offset = useRef(new Vector3()).current

  const entry = index == null ? null : lanterns[index]

  useEffect(() => {
    if (!entry) return
    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeLantern()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [entry, closeLantern])

  useFrame(() => {
    if (!group.current || !entry || index == null || !seeds[index]) return
    lanternOffset(seeds[index], uTime.value * uAnimate.value, offset)
    group.current.position.copy(anchor).add(offset)
  })

  if (!entry) return null

  return (
    <group ref={group}>
      <Html
        center
        distanceFactor={11}
        position={[0, 0.85, 0]}
        zIndexRange={[24, 4]}
        pointerEvents="auto"
      >
        <div className="lantern-note">
          <p className="lantern-note__message">{entry.message}</p>
          <p className="lantern-note__by">
            <span>{entry.name}</span>
            {entry.created_at ? <span className="lantern-note__when">{relativeTime(entry.created_at)}</span> : null}
          </p>
          <button type="button" className="lantern-note__close" onClick={closeLantern} aria-label="Close">
            ×
          </button>
        </div>
      </Html>
    </group>
  )
}
