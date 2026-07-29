import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { content } from '../data/content.js'
import { useStore } from '../store.js'

/**
 * The whole portfolio as a plain, scrollable document.
 *
 * A 3D world is a bad way to read a CV if you're on a keyboard, a screen
 * reader, a weak GPU or simply in a hurry. Everything here comes from the same
 * data/content.js the panels use, so the two can't drift apart.
 */
export default function TextResume() {
  const open = useStore((s) => s.textMode)
  const setTextMode = useStore((s) => s.setTextMode)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    ref.current?.focus()
    const onKeyDown = (event) => event.key === 'Escape' && setTextMode(false)
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, setTextMode])

  const { about, work, experience, contact } = content

  return (
    <div
      ref={ref}
      className={`resume${open ? ' is-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Résumé, text version"
      aria-hidden={!open}
      inert={!open}
      tabIndex={-1}
    >
      <div className="resume__sheet">
        <button
          type="button"
          className="icon-button resume__close"
          onClick={() => setTextMode(false)}
          aria-label="Close the text résumé"
        >
          <X size={18} aria-hidden="true" />
        </button>

        <header>
          <h1 className="resume__name">{content.name}</h1>
          <p className="resume__role">
            {content.role} · {content.location}
          </p>
        </header>

        <section>
          <h2>About</h2>
          {about.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p>
            <strong>Skills:</strong> {about.skills.join(' · ')}
          </p>
          <p>
            <strong>Languages:</strong> {about.languages.join(' · ')}
          </p>
        </section>

        <section>
          <h2>Selected work</h2>
          <p>{work.intro}</p>
          {work.featured.map((project) => (
            <article key={project.title}>
              <h3>{project.title}</h3>
              <p className="resume__meta">{project.stack}</p>
              <p>{project.desc}</p>
              <p>
                <a href={project.link} target="_blank" rel="noreferrer noopener">
                  {project.linkLabel}
                </a>
              </p>
            </article>
          ))}
          <p>{work.note}</p>
        </section>

        <section>
          <h2>Experience</h2>
          {experience.jobs.map((job) => (
            <article key={`${job.org}-${job.period}`}>
              <h3>
                {job.role} — {job.org}
              </h3>
              <p className="resume__meta">{job.period}</p>
              <ul>
                {job.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
          <h3>Education</h3>
          <p>
            {experience.education.degree}, {experience.education.school} (
            {experience.education.period})
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>{contact.intro}</p>
          <ul>
            {contact.links.map((link) => (
              <li key={link.label}>
                {link.label}:{' '}
                <a
                  href={link.href}
                  target={link.href.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer noopener"
                >
                  {link.detail}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
