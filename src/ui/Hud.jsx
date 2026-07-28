import { content } from '../data/content.js'
import { zones } from '../data/world.js'
import { controlHints } from '../world/controls.js'
import { useStore } from '../store.js'

/**
 * Persistent overlay: who this is, how to move, and how much of the island
 * you've found.
 */
export default function Hud() {
  const nearZone = useStore((s) => s.nearZone)
  const visited = useStore((s) => s.visited)
  const openPanel = useStore((s) => s.openPanel)

  return (
    <>
      <header className="brand">
        <p className="brand__name">{content.name}</p>
        <p className="brand__role">{content.role}</p>
      </header>

      <div className={`hud-hint${nearZone && !openPanel ? ' is-visible' : ''}`} aria-live="polite">
        Press <kbd>E</kbd> to open
      </div>

      <div className="progress" aria-label={`${visited.length} of ${zones.length} places found`}>
        {zones.map((zone) => (
          <span
            key={zone.id}
            className={`progress__dot${visited.includes(zone.id) ? ' is-found' : ''}${
              nearZone === zone.id ? ' is-near' : ''
            }`}
            style={{ '--accent': zone.accent }}
            title={zone.label}
          />
        ))}
      </div>

      <dl className="legend">
        {controlHints.map((hint) => (
          <div key={hint.label} className="legend__row">
            <dt>
              {hint.keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
            </dt>
            <dd>{hint.label}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}
