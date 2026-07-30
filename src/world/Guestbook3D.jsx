import { useLayoutEffect } from 'react'
import { readLanterns } from '../data/lanterns.js'
import { useStore } from '../store.js'
import SkyLanterns from './SkyLanterns.jsx'
import LanternMessage from './LanternMessage.jsx'

/**
 * The guestbook's half of the scene.
 *
 * `readLanterns()` is called during render and throws its promise until the
 * fetch resolves, which suspends this subtree. Because it sits inside the same
 * boundary as the rest of the world, the ready gate can't open until the sky
 * has its messages — otherwise three hundred lanterns would appear a second
 * after the reveal, which is exactly the pop the gate exists to prevent.
 *
 * A failed request resolves to an empty list rather than rejecting, so an
 * unreachable database costs an empty sky and never a broken page.
 */
export default function Guestbook3D() {
  const loaded = readLanterns()
  const setLanterns = useStore((s) => s.setLanterns)

  // Into the store before paint, so SkyLanterns' first render is the real sky
  // rather than an empty one followed by a fill.
  useLayoutEffect(() => {
    if (loaded?.length) setLanterns(loaded)
  }, [loaded, setLanterns])

  return (
    <>
      <SkyLanterns />
      <LanternMessage />
    </>
  )
}
