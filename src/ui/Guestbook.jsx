import { useEffect, useRef, useState } from 'react'
import {
  MESSAGE_MAX,
  NAME_MAX,
  addLantern,
  cooldownRemaining,
  isShared,
  primeResource,
  validate,
} from '../data/lanterns.js'
import { useStore } from '../store.js'

/**
 * Write a wish, release a lantern.
 *
 * A DOM panel rather than a fan of in-world cards, because this one is an input
 * — typing into an `<Html transform>` element sitting in 3D space means a text
 * field that scales with distance and a caret that shears with the camera. The
 * four content zones stay in the world; the one that asks for something back
 * comes to the front.
 */
export default function Guestbook() {
  const open = useStore((s) => s.openZone) === 'guestbook'
  const closeZone = useStore((s) => s.closeZone)
  const prependLantern = useStore((s) => s.prependLantern)

  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState(null)
  const [sending, setSending] = useState(false)
  const honeypot = useRef(null)
  const field = useRef(null)

  // Focus the first field when it opens — the panel exists to be typed into.
  useEffect(() => {
    if (open) field.current?.focus()
    else setStatus(null)
  }, [open])

  if (!open) return null

  const submit = async (event) => {
    event.preventDefault()
    if (sending) return

    // The honeypot: a field no human ever sees, so anything in it came from a
    // script. Reported as success rather than as an error — telling a bot which
    // check it tripped is just free debugging for whoever wrote it.
    if (honeypot.current?.value) {
      setStatus({ kind: 'ok', text: 'Your lantern is on its way ✦' })
      setName('')
      setMessage('')
      return
    }

    const wait = cooldownRemaining()
    if (wait > 0) {
      setStatus({ kind: 'warn', text: `One at a time — try again in ${Math.ceil(wait / 1000)}s.` })
      return
    }

    const checked = validate({ name, message })
    if (!checked.ok) {
      setStatus({ kind: 'warn', text: checked.error })
      return
    }

    /**
     * A stable hue per author, so the same person's lanterns always match.
     *
     * Confined to 8°–52° — deep ember through to pale gold. A full 0–360 hash
     * is the obvious thing to write and it puts blue and green paper lanterns
     * over a sunset island, which reads as a bug rather than as variety.
     */
    const hash = [...checked.name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 4096, 7)
    const hue = 8 + (hash % 45)

    setSending(true)
    const entry = { name: checked.name, message: checked.message, hue, created_at: new Date().toISOString() }

    // Up it goes immediately. If the write fails the lantern stays — losing
    // somebody's wish to a network blip is worse than a sky that's briefly
    // ahead of the database.
    prependLantern(entry)
    // Read the list back rather than rebuilding it — zustand's set is
    // synchronous, so `[entry, ...getState().lanterns]` would list the new
    // lantern twice.
    primeResource(useStore.getState().lanterns)
    setName('')
    setMessage('')

    try {
      await addLantern(entry)
      setStatus({ kind: 'ok', text: 'Your lantern is on its way ✦' })
    } catch (error) {
      setStatus({ kind: 'warn', text: error.message })
    } finally {
      setSending(false)
    }
  }

  const left = MESSAGE_MAX - message.length

  return (
    <div className="guestbook" role="dialog" aria-modal="false" aria-label="Release a sky lantern">
      <button type="button" className="guestbook__close" onClick={closeZone} aria-label="Close">
        ×
      </button>

      <p className="guestbook__title">Release a lantern</p>
      <p className="guestbook__lede">
        Write something and send it up. {isShared
          ? "Everyone who visits will see it in the sky."
          : 'It will stay in the sky on this device.'}
      </p>

      <form onSubmit={submit}>
        <label className="guestbook__label" htmlFor="gb-name">
          Your name
        </label>
        <input
          id="gb-name"
          ref={field}
          className="guestbook__input"
          value={name}
          maxLength={NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />

        <label className="guestbook__label" htmlFor="gb-message">
          Your wish
          <span className={`guestbook__count${left < 20 ? ' is-low' : ''}`}>{left}</span>
        </label>
        <textarea
          id="gb-message"
          className="guestbook__input guestbook__input--area"
          value={message}
          maxLength={MESSAGE_MAX}
          rows={3}
          onChange={(e) => setMessage(e.target.value)}
        />

        {/* Off-screen rather than display:none — some bots skip hidden fields,
            and screen readers are told to ignore it either way. */}
        <input
          ref={honeypot}
          className="guestbook__trap"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        <button type="submit" className="guestbook__send" disabled={sending}>
          {sending ? 'Sending…' : '✦ Release lantern'}
        </button>
      </form>

      {status ? (
        <p className={`guestbook__status is-${status.kind}`} role="status">
          {status.text}
        </p>
      ) : null}

      {/* The lanterns are directly overhead, which is outside the frame until
          you look up. Worth saying, or the sky appears to be empty. */}
      <p className="guestbook__aside">Drag to look up — then tap a lantern to read it.</p>
    </div>
  )
}
