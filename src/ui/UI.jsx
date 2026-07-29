import Hud from './Hud.jsx'
import WeatherControls from './WeatherControls.jsx'
import Intro from './Intro.jsx'
import TextResume from './TextResume.jsx'
import { useStore } from '../store.js'

/**
 * The DOM layer over the canvas. It's pointer-transparent by default so
 * dragging to look around still works; individual controls opt back in.
 */
export default function UI() {
  const entered = useStore((s) => s.entered)

  return (
    <div className="ui">
      {/* Mounted only once you're in, and faded rather than snapped so the
          chrome arrives after the world rather than on top of the reveal. */}
      {entered && (
        <div className="hud-layer">
          <Hud />
          <WeatherControls />
        </div>
      )}
      <TextResume />
      <Intro />
    </div>
  )
}
