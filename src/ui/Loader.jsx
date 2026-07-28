import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { content } from '../data/content.js'
import { useStore } from '../store.js'

/**
 * Branded loading screen.
 *
 * It doubles as the gesture that lets audio start: browsers won't open an
 * AudioContext until the user has interacted, so "Step outside" is both the
 * entry point and that first click.
 */
export default function Loader() {
  const { progress, active } = useProgress()
  const entered = useStore((s) => s.entered)
  const enter = useStore((s) => s.enter)
  const [ready, setReady] = useState(false)

  // Wait for a beat after loading finishes so the first frame is already
  // rendered behind the screen when it fades out.
  useEffect(() => {
    if (active || progress < 100) return
    const timer = setTimeout(() => setReady(true), 600)
    return () => clearTimeout(timer)
  }, [active, progress])

  return (
    <div className={`loader${entered ? ' is-done' : ''}`} aria-hidden={entered}>
      <div className="loader__inner">
        <p className="loader__eyebrow">Portfolio</p>
        <h1 className="loader__name">{content.name}</h1>
        <p className="loader__role">{content.role}</p>

        <div className="loader__bar" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100} aria-label="Loading the island">
          <span className="loader__fill" style={{ transform: `scaleX(${progress / 100})` }} />
        </div>

        <button
          type="button"
          className="loader__enter"
          disabled={!ready}
          onClick={enter}
        >
          {ready ? 'Step outside' : `Building the island… ${Math.round(progress)}%`}
        </button>

        <p className="loader__tip">
          Walk with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> — or drag the joystick on a phone.
          Wander up to a building to read more.
        </p>
      </div>
    </div>
  )
}
