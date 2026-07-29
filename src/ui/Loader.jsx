import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { content } from '../data/content.js'
import { useStore } from '../store.js'

/**
 * Branded loading screen — fills once, 0 to 100, and never restarts.
 *
 * `useProgress` reports 0-100% across whatever is in flight *at that moment*,
 * so every new batch of requests starts a fresh cycle and the bar refills.
 * Preloading every asset at module scope (see world/assets.js) makes it one
 * batch, and two guards here make the bar honest even if something slips
 * through later:
 *
 *   - the displayed value only ever moves forward, so a fresh 0% can't drag
 *     it backwards
 *   - once it has genuinely finished — loader idle *and* the peak at 100 — it
 *     latches, and no later traffic can reopen it
 *
 * It stays outside <Canvas> so it renders while the scene is still resolving,
 * and its button doubles as the user gesture browsers require before an
 * AudioContext may start.
 */
export default function Loader() {
  const { active, progress } = useProgress()
  const entered = useStore((s) => s.entered)
  const enter = useStore((s) => s.enter)
  const sceneReady = useStore((s) => s.ready)

  const [display, setDisplay] = useState(0)
  const [complete, setComplete] = useState(false)
  const [ready, setReady] = useState(false)
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
  // smoothly, and lifting the screen on the former is what causes the reveal to
  // stutter.
  useEffect(() => {
    if (complete || active || !sceneReady || peak.current < 100) return
    setComplete(true)
    setDisplay(100)
  }, [active, progress, sceneReady, complete])

  // The reveal delay gets its own effect, keyed only on the latch. Sharing an
  // effect with `progress` meant a later progress tick ran the cleanup and
  // cancelled this timer before it could fire — leaving the button stuck on
  // "Building the island… 100%" forever.
  useEffect(() => {
    if (!complete) return
    const timer = setTimeout(() => setReady(true), 500)
    return () => clearTimeout(timer)
  }, [complete])

  return (
    <div className={`loader${entered ? ' is-done' : ''}`} aria-hidden={entered}>
      <div className="loader__inner">
        <p className="loader__eyebrow">Portfolio</p>
        <h1 className="loader__name">{content.name}</h1>
        <p className="loader__role">{content.role}</p>

        <div
          className="loader__bar"
          role="progressbar"
          aria-valuenow={Math.round(display)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Loading the island"
        >
          <span className="loader__fill" style={{ transform: `scaleX(${display / 100})` }} />
        </div>

        <button type="button" className="loader__enter" disabled={!ready} onClick={enter}>
          {ready ? 'Step outside' : `Building the island… ${Math.round(display)}%`}
        </button>

        <p className="loader__tip">
          Walk with <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> — or drag the joystick on a phone. Wander up to a building to read
          more.
        </p>
      </div>
    </div>
  )
}
