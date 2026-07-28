import { Suspense } from 'react'
import Experience from './world/Experience.jsx'
import MobileControls from './ui/MobileControls.jsx'
import UI from './ui/UI.jsx'

export default function App() {
  return (
    <div className="app">
      <Suspense fallback={null}>
        <Experience />
      </Suspense>
      <UI />
      <MobileControls />
    </div>
  )
}
