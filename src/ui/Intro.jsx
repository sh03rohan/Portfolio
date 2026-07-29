import { useCallback, useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { content } from '../data/content.js'
import { useStore } from '../store.js'

/**
 * The way in — one element, three states, no separate screen.
 *
 * The island is rendering behind this from the first frame. Rather than hiding
 * it behind an opaque panel, this is a blur over the live canvas that thins as
 * the scene becomes ready and clears entirely on the first click:
 *
 *   loading   heavy blur, dim, progress bar — deep enough that assets
 *             appearing behind it can't be read as pop-in
 *   invite    soft blur, "Click to start"; the character is spotlit and
 *             slowly turning underneath, as the thing to click
 *   entered   transparent and inert
 *
 * It has to sit above the canvas to blur it, which means it — not the
 * character — receives the click. That's deliberate: clicking anywhere starts,
 * which is what you want anyway, and the character is the visual anchor rather
 * than a hit target.
 *
 * The click doubles as the user gesture browsers demand before an AudioContext
 * may open.
 */
export default function Intro() {
  const { active, progress } = useProgress()
  const entered = useStore((s) => s.entered)
  const enter = useStore((s) => s.enter)
  const sceneReady = useStore((s) => s.ready)
  const reducedMotion = useStore((s) => s.reducedMotion)

  const [display, setDisplay] = useState(0)
  const [complete, setComplete] = useState(false)
  const [invite, setInvite] = useState(false)
  const peak = useRef(0)

  // Monotonic: the bar only ever moves forward.
  useEffect(() => {
    if (complete) return
    if (progress > peak.current) {
      peak.current = progress
      setDisplay(progress)
    }
  }, [progress, complete])

  // Latch exactly once: the loading manager idle at a full 100 *and* the scene
  // reporting itself ready — shaders compiled, GPU uploads done, a real frame
  // already drawn. Downloads finishing is not the same as being able to render
  // smoothly.
  useEffect(() => {
    if (complete || active || !sceneReady || peak.current < 100) return
    setComplete(true)
    setDisplay(100)
  }, [active, progress, sceneReady, complete])

  // The invite gets its own effect, keyed only on the latch. Sharing one with
  // `progress` meant a later tick ran the cleanup and cancelled the timer.
  useEffect(() => {
    if (!complete) return
    const timer = setTimeout(() => setInvite(true), 400)
    return () => clearTimeout(timer)
  }, [complete])

  const start = useCallback(() => {
    if (invite) enter()
  }, [invite, enter])

  // Space and Enter start it too, for anyone not reaching for a mouse.
  useEffect(() => {
    if (entered) return
    const onKeyDown = (event) => {
      if (event.code !== 'Space' && event.code !== 'Enter') return
      event.preventDefault()
      start()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [entered, start])

  const className = [
    'intro-veil',
    invite ? 'is-invite' : 'is-loading',
    entered ? 'is-gone' : '',
    reducedMotion ? 'is-brief' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={className}
      onClick={start}
      role={invite && !entered ? 'button' : undefined}
      tabIndex={invite && !entered ? 0 : -1}
      aria-label={invite && !entered ? 'Start exploring the island' : undefined}
      aria-hidden={entered}
    >
      <div className="intro-hint">
        <p className="intro-eyebrow">Portfolio</p>
        <h1>{content.name}</h1>
        <p className="intro-role">{content.role}</p>

        {invite ? (
          <>
            <span className="intro-cta">Click to start ›</span>
            <p className="intro-tip">
              Then walk with <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> — or the joystick on a phone.
            </p>
          </>
        ) : (
          <div
            className="intro-bar"
            role="progressbar"
            aria-valuenow={Math.round(display)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Loading the island"
          >
            <span className="intro-fill" style={{ transform: `scaleX(${display / 100})` }} />
          </div>
        )}
      </div>
    </div>
  )
}
