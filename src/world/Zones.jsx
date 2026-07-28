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
      const { openPanel, closePanel, markVisited } = useStore.getState()
      if (found) markVisited(found)
      else if (openPanel) closePanel()
    }
  })

  // "E" opens or closes the panel for whichever zone you're standing in.
  useEffect(
    () =>
      subscribeKeys(
        (state) => state.action1,
        (pressed) => {
          if (!pressed) return
          const { nearZone, togglePanel } = useStore.getState()
          if (nearZone) togglePanel(nearZone)
        },
      ),
    [subscribeKeys],
  )

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
