import Experience from './world/Experience.jsx'
import Audio from './world/Audio.jsx'
import MobileControls from './ui/MobileControls.jsx'
import UI from './ui/UI.jsx'

export default function App() {
  return (
    <div className="app">
      {/* No Suspense boundary here on purpose. The only async work is inside
          the Canvas, and a second boundary lets content resolve in two stages —
          which restarts the loading bar. Experience owns the single one. */}
      <Experience />
      <UI />
      <MobileControls />
      {/* Web Audio, not a three.js listener — lives outside the canvas. */}
      <Audio />
    </div>
  )
}
