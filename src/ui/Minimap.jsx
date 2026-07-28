import { useEffect, useRef } from 'react'
import { zones, island } from '../data/world.js'
import { playerPosition } from '../world/player-position.js'
import { useStore } from '../store.js'

const SIZE = 132
const SCALE = SIZE / (island.radius * 2.15)
const toMap = (v) => SIZE / 2 + v * SCALE

/**
 * Top-down map of the island.
 *
 * The player marker is moved by writing to a ref's transform directly rather
 * than through React state — this updates every frame, and re-rendering the
 * component that often would be wasteful.
 */
export default function Minimap() {
  const nearZone = useStore((s) => s.nearZone)
  const visited = useStore((s) => s.visited)
  const marker = useRef(null)

  useEffect(() => {
    let frame
    const tick = () => {
      const p = playerPosition.get()
      if (marker.current) {
        marker.current.setAttribute('cx', toMap(p.x).toFixed(1))
        marker.current.setAttribute('cy', toMap(p.z).toFixed(1))
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="minimap" aria-hidden="true">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={island.shoreRadius * SCALE}
          className="minimap__land"
        />

        {zones.map((zone) => {
          const [x, , z] = zone.position
          return (
            <g key={zone.id}>
              <circle
                cx={toMap(x)}
                cy={toMap(z)}
                r={zone.radius * SCALE}
                className="minimap__zone"
                style={{ stroke: zone.accent }}
              />
              <circle
                cx={toMap(x)}
                cy={toMap(z)}
                r={nearZone === zone.id ? 4.5 : 3}
                className={`minimap__dot${visited.includes(zone.id) ? ' is-found' : ''}`}
                style={{ fill: zone.accent }}
              />
            </g>
          )
        })}

        <circle ref={marker} cx={SIZE / 2} cy={SIZE / 2} r={3.4} className="minimap__player" />
      </svg>
    </div>
  )
}
