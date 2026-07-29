import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useKeyboardControls } from '@react-three/drei'
import { zones } from '../data/world.js'
import { playerPosition } from './player-position.js'
import { useStore } from '../store.js'
import Zone from './Zone.jsx'

/**
 * Watches the player against every zone radius in one frame loop and writes
 * the result to the store. Because `setNearZone` bails when the value is
 * unchanged, this only re-renders anything on an actual enter/leave.
 */
function Proximity() {
  const setNearZone = useStore((s) => s.setNearZone)
  const [subscribeKeys] = useKeyboardControls()
  const nearest = useRef(null)

  useFrame(() => {
    const player = playerPosition.get()

    let found = null
    let bestDistance = Infinity
    for (const zone of zones) {
      const [x, , z] = zone.position
      const distance = Math.hypot(player.x - x, player.z - z)
      // Hysteresis: you have to step further out to leave than to enter, so
      // standing near the boundary can't flicker the panel open and shut.
      const limit = nearest.current === zone.id ? zone.radius * 1.28 : zone.radius
      if (distance < limit && distance < bestDistance) {
        bestDistance = distance
        found = zone.id
      }
    }

    if (found !== nearest.current) {
      nearest.current = found
      setNearZone(found)

      // Walking away dismisses whatever the zone opened.
      const { openZone, closeZone, markVisited } = useStore.getState()
      if (found) markVisited(found)
      else if (openZone) closeZone()
    }
  })

  // "E" fans the cards out of whichever structure you're standing at, or sends
  // them back in.
  useEffect(
    () =>
      subscribeKeys(
        (state) => state.action1,
        (pressed) => {
          if (!pressed) return
          const { nearZone, toggleZone } = useStore.getState()
          if (nearZone) toggleZone(nearZone)
        },
      ),
    [subscribeKeys],
  )

  // Esc sends the cards home. This used to live in the DOM panel; with the
  // panel gone the trigger owner has to carry it.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      const { openZone, closeZone } = useStore.getState()
      if (openZone) closeZone()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return null
}

export default function Zones() {
  return (
    <group>
      <Proximity />
      {zones.map((zone) => (
        <Zone key={zone.id} zone={zone} />
      ))}
    </group>
  )
}
