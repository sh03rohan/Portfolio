import { useEffect, useRef } from 'react'
import { X, ExternalLink, MapPin } from 'lucide-react'
import { content } from '../data/content.js'
import { zoneById } from '../data/world.js'
import { useStore } from '../store.js'

/**
 * The sliding info panel — one component per zone's content, all reading from
 * data/content.js so the copy lives in exactly one place.
 */

function About() {
  const { about, location } = content
  return (
    <>
      <p className="panel__lede">{about.paragraphs[0]}</p>
      {about.paragraphs.slice(1).map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}

      <h3 className="panel__subhead">Skills</h3>
      <ul className="chips">
        {about.skills.map((skill) => (
          <li key={skill} className="chip">
            {skill}
          </li>
        ))}
      </ul>

      <h3 className="panel__subhead">Languages</h3>
      <ul className="chips">
        {about.languages.map((language) => (
          <li key={language} className="chip chip--quiet">
            {language}
          </li>
        ))}
      </ul>

      <p className="panel__meta">
        <MapPin size={15} aria-hidden="true" /> {location}
      </p>
    </>
  )
}

function Work() {
  const { work } = content
  return (
    <>
      <p className="panel__lede">{work.intro}</p>
      <ul className="cards">
        {work.featured.map((project) => (
          <li key={project.title} className="card">
            <h3 className="card__title">{project.title}</h3>
            <p className="card__stack">{project.stack}</p>
            <p className="card__desc">{project.desc}</p>
            <a className="card__link" href={project.link} target="_blank" rel="noreferrer noopener">
              {project.linkLabel}
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
      <p className="panel__meta">{work.note}</p>
    </>
  )
}

function Experience() {
  const { experience } = content
  return (
    <>
      <ol className="timeline">
        {experience.jobs.map((job) => (
          <li key={`${job.org}-${job.period}`} className="timeline__item">
            <p className="timeline__period">{job.period}</p>
            <h3 className="timeline__role">{job.role}</h3>
            <p className="timeline__org">{job.org}</p>
            <ul className="timeline__points">
              {job.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <h3 className="panel__subhead">Education</h3>
      <p className="timeline__role">{experience.education.degree}</p>
      <p className="timeline__org">
        {experience.education.school} · {experience.education.period}
      </p>
    </>
  )
}

function Contact() {
  const { contact } = content
  return (
    <>
      <p className="panel__lede">{contact.intro}</p>
      <ul className="contact">
        {contact.links.map((link) => (
          <li key={link.label}>
            <a
              className="contact__row"
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel="noreferrer noopener"
            >
              <span className="contact__label">{link.label}</span>
              <span className="contact__detail">{link.detail}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  )
}

const BODIES = { about: About, work: Work, experience: Experience, contact: Contact }

export default function Panel() {
  const openPanel = useStore((s) => s.openPanel)
  const closePanel = useStore((s) => s.closePanel)
  const panelRef = useRef(null)
  const restoreFocus = useRef(null)

  const zone = openPanel ? zoneById[openPanel] : null
  const Body = openPanel ? BODIES[openPanel] : null

  // Esc closes; focus moves into the panel and back out again on close.
  useEffect(() => {
    if (!openPanel) return
    restoreFocus.current = document.activeElement
    panelRef.current?.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closePanel()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (restoreFocus.current instanceof HTMLElement) restoreFocus.current.focus()
    }
  }, [openPanel, closePanel])

  return (
    <>
      <div
        className={`panel-scrim${openPanel ? ' is-open' : ''}`}
        onClick={closePanel}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        className={`panel${openPanel ? ' is-open' : ''}`}
        style={zone ? { '--accent': zone.accent } : undefined}
        role="dialog"
        aria-modal="false"
        aria-label={zone?.label ?? 'Information'}
        aria-hidden={!openPanel}
        tabIndex={-1}
        // Keep the panel out of the tab order entirely while it's closed.
        inert={!openPanel}
      >
        {zone && (
          <>
            <header className="panel__head">
              <p className="panel__eyebrow">{zone.hint}</p>
              <h2 className="panel__title">
                {openPanel === 'about' ? content.about.title : zone.label}
              </h2>
              <button type="button" className="panel__close" onClick={closePanel} aria-label="Close panel">
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="panel__body">{Body && <Body />}</div>
          </>
        )}
      </aside>
    </>
  )
}
