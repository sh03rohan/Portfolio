import { useEffect, useRef } from 'react'
import { createAudioEngine } from './audio-engine.js'
import { playerPosition, playerMotion } from './player-position.js'
import { sfx } from './sfx.js'
import { useStore } from '../store.js'

/**
 * Glue between the store and the synthesiser in `audio-engine.js`.
 *
 * Deliberately thin: no audio state lives here, so nothing about the sound can
 * cause a render. The per-frame tick comes from subscribing to the shared
 * player vector — that's already written once a frame from inside the canvas,
 * so the footsteps get frame-accurate timing without this component being part
 * of the render loop at all.
 */
export default function Audio() {
  const audioOn = useStore((s) => s.audioOn)
  const openZone = useStore((s) => s.openZone)
  const engine = useRef(null)

  // Build and tear down with the toggle. The context is only ever created from
  // inside a click, which is what browsers require.
  useEffect(() => {
    if (!audioOn) return

    const created = createAudioEngine()
    if (!created) return
    engine.current = created
    created.setWeather(useStore.getState().weatherIndex)

    return () => {
      created.dispose()
      engine.current = null
    }
  }, [audioOn])

  // Cross-fade the beds when the weather changes — including when it changes
  // while muted, so unmuting lands on the right ambience rather than easing
  // into it from whatever was playing last.
  useEffect(
    () =>
      useStore.subscribe((state, previous) => {
        if (state.weatherIndex !== previous.weatherIndex) {
          engine.current?.setWeather(state.weatherIndex)
        }
      }),
    [],
  )

  // Footsteps and the surf. Driven off the player vector rather than a timer:
  // an interval would drift against the animation and miss steps on a hitch.
  useEffect(() => {
    let last = performance.now()
    return playerPosition.subscribe((position) => {
      const now = performance.now()
      const delta = Math.min(0.1, (now - last) / 1000)
      last = now
      engine.current?.step(position, playerMotion, delta, useStore.getState().entered)
    })
  }, [])

  // One-shot sounds emitted from inside the canvas. This is the only place that
  // knows what any of them sound like.
  useEffect(
    () =>
      sfx.subscribe((name, detail) => {
        if (name === 'pickup') engine.current?.pickup(detail)
        else if (name === 'complete') engine.current?.fanfare()
        else if (name === 'discover') engine.current?.chime()
      }),
    [],
  )

  // Ring the bell when a zone opens (not when it closes).
  useEffect(() => {
    if (openZone) engine.current?.chime()
  }, [openZone])

  return null
}
