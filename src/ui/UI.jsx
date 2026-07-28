import Panel from './Panel.jsx'
import Hud from './Hud.jsx'

/**
 * The DOM layer over the canvas. It's pointer-transparent by default so
 * dragging to look around still works; individual controls opt back in.
 */
export default function UI() {
  return (
    <div className="ui">
      <Hud />
      <Panel />
    </div>
  )
}
