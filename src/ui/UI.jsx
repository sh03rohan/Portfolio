import Panel from './Panel.jsx'
import Hud from './Hud.jsx'
import WeatherControls from './WeatherControls.jsx'
import Loader from './Loader.jsx'
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
      {entered && (
        <>
          <Hud />
          <WeatherControls />
          <Panel />
        </>
      )}
      <TextResume />
      <Loader />
    </div>
  )
}
