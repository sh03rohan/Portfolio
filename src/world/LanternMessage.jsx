import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Vector3 } from 'three'
import { lanternOffset, lanternSeeds, platformAnchor } from './SkyLanterns.jsx'
import { relativeTime } from '../data/lanterns.js'
import { isTyping } from './controls.js'
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


export default function LanternMessage() {
  const quality = useStore((s) => s.quality)
  const lanterns = useStore((s) => s.lanterns)
  const pinned = useStore((s) => s.readingLantern)
  const hovered = useStore((s) => s.hoveredLantern)
  const closeLantern = useStore((s) => s.closeLantern)

  // A pin always wins, so crossing the cursor over a neighbour can't steal a
  // message the visitor deliberately opened.
  const index = pinned ?? hovered

  const group = useRef()
  const anchor = useMemo(platformAnchor, [])
  const seeds = useMemo(() => lanternSeeds(CAPS[quality] ?? CAPS.high), [quality])
  const offset = useRef(new Vector3()).current

  const entry = index == null ? null : lanterns[index]

  useEffect(() => {
    if (!entry) return
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      // Mid-sentence, Escape belongs to the write panel — closing a note as
      // well would dismiss two things on one key.
      if (isTyping()) return
      closeLantern()
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
      {/* No `transform`, so it's screen-aligned and always square to the
          camera. distanceFactor keeps it shrinking with distance — but 11 was
          too small to read on a lantern up in the column, so 18 with a much
          heavier background. */}
      <Html
        center
        distanceFactor={18}
        position={[0, 0.95, 0]}
        zIndexRange={[24, 4]}
        pointerEvents="auto"
      >
        <div className={`lantern-note${pinned == null ? ' is-preview' : ''}`}>
          <p className="lantern-note__message">{entry.message}</p>
          <p className="lantern-note__by">
            <span>{entry.name}</span>
            {entry.created_at ? <span className="lantern-note__when">{relativeTime(entry.created_at)}</span> : null}
          </p>
          {pinned == null ? null : (
            <button type="button" className="lantern-note__close" onClick={closeLantern} aria-label="Close">
              ×
            </button>
          )}
        </div>
      </Html>
    </group>
  )
}
