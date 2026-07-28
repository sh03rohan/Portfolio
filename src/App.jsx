import { Suspense } from 'react'
import Experience from './world/Experience.jsx'

export default function App() {
  return (
    <div className="app">
      <Suspense fallback={null}>
        <Experience />
      </Suspense>
    </div>
  )
}
