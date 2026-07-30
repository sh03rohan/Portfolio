import { Volume2, VolumeX, FileText, Sparkles } from 'lucide-react'
import { content } from '../data/content.js'
import { zones } from '../data/world.js'
import { collectibleCount } from '../data/collectibles.js'
import { controlHints } from '../world/controls.js'
import { useStore } from '../store.js'
import Minimap from './Minimap.jsx'

/**
 * Persistent overlay: who this is, how to move, how much you've found, and the
 * two escape hatches — mute, and the plain-text version of everything.
 */
export default function Hud() {
  const nearZone = useStore((s) => s.nearZone)
  const visited = useStore((s) => s.visited)
  const openZone = useStore((s) => s.openZone)
  const audioOn = useStore((s) => s.audioOn)
  const toggleAudio = useStore((s) => s.toggleAudio)
  const setTextMode = useStore((s) => s.setTextMode)
  const found = useStore((s) => s.found)
  const celebrating = useStore((s) => s.celebrating)

  const allFound = found.length >= collectibleCount

  return (
    <>
      <header className="brand">
        <p className="brand__name">{content.name}</p>
        <p className="brand__role">{content.role}</p>
      </header>

      <div className="hud-tools">
        <button
          type="button"
          className="tool"
          onClick={toggleAudio}
          aria-pressed={audioOn}
          aria-label={audioOn ? 'Mute ambient sound' : 'Play ambient sound'}
        >
          {audioOn ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="tool tool--wide"
          onClick={() => setTextMode(true)}
        >
          <FileText size={16} aria-hidden="true" />
          <span>Résumé (text)</span>
        </button>
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

      <div
        className={`sparks${allFound ? ' is-complete' : ''}`}
        aria-label={`${found.length} of ${collectibleCount} sparks found`}
      >
        <Sparkles size={14} aria-hidden="true" />
        <span>
          {found.length} / {collectibleCount}
        </span>
      </div>

      <div className={`hud-hint${nearZone && !openZone ? ' is-visible' : ''}`} aria-live="polite">
        Press <kbd>E</kbd> to open
      </div>

      {/* Announced politely rather than assertively: it's a nice thing that
          happened, not something anybody needs interrupting for. */}
      <div className={`toast${celebrating ? ' is-visible' : ''}`} role="status" aria-live="polite">
        {celebrating ? `All ${collectibleCount} sparks found — thank you for exploring.` : ''}
      </div>

      <Minimap />

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
