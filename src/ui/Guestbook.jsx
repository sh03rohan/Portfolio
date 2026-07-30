import { useEffect, useRef, useState } from 'react'
import {
  MESSAGE_MAX,
  NAME_MAX,
  addLantern,
  cooldownRemaining,
  isShared,
  primeResource,
  relativeTime,
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

  const lanterns = useStore((s) => s.lanterns)
  const readLantern = useStore((s) => s.readLantern)

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

  /**
   * Escape closes the panel, and this handler is deliberately *not* guarded by
   * `isTyping()`.
   *
   * Everything else that reads the keyboard bails while a field has focus —
   * otherwise typing "the" would trip the E-to-close binding. Escape is the
   * exception, because a dismissal key that stops working once you start
   * writing is a trap.
   */
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      closeZone()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, closeZone])

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
      // Long enough to read the confirmation, then out of the way so the
      // lantern can be watched going up. Submitting is one of the three ways
      // out of here, alongside Escape and the close button.
      setTimeout(() => useStore.getState().closeZone(), 1700)
    } catch (error) {
      setStatus({ kind: 'warn', text: error.message })
    } finally {
      setSending(false)
    }
  }

  const left = MESSAGE_MAX - message.length

  return (
    <div
      className="guestbook"
      role="dialog"
      aria-modal="false"
      aria-label="Release a sky lantern"
      /**
       * Nothing that happens inside this panel is allowed to reach the canvas.
       * ecctrl listens for pointer events to rotate the camera, so without this
       * a drag to select text in the message field also swings the camera, and
       * a click on "Release" starts a look-around.
       */
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
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

      {/**
        * The messages, as text.
        *
        * The sky is the point of this feature, but it's a bad reading surface:
        * a lantern forty units up is a few pixels of glow, and finding a
        * specific one means panning around hunting for it. So the same data is
        * here as a plain scrollable list — the guestbook is legible whether or
        * not you feel like looking for it.
        *
        * Clicking a row pins that lantern's label in the world, which doubles
        * as a way of finding it.
        */}
      {lanterns.length > 0 ? (
        <div className="guestbook__recent">
          <p className="guestbook__label guestbook__label--plain">
            Recent messages
            <span className="guestbook__count">{lanterns.length}</span>
          </p>
          <ul className="guestbook__list">
            {lanterns.slice(0, 40).map((entry, i) => (
              <li key={`${entry.created_at}-${i}`}>
                <button type="button" className="guestbook__row" onClick={() => readLantern(i)}>
                  <span className="guestbook__row-msg">{entry.message}</span>
                  <span className="guestbook__row-by">
                    {entry.name}
                    {entry.created_at ? (
                      <span className="guestbook__row-when">{relativeTime(entry.created_at)}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="guestbook__aside">
          {isShared ? 'No lanterns yet — yours would be the first.' : 'Nothing in the sky yet.'}
        </p>
      )}

      {/* Some are down at head height by the brazier; the rest are overhead and
          outside the frame until you look up. Worth saying, or the sky appears
          to be empty. */}
      <p className="guestbook__aside">Drag to look up ↑ — or tap a lantern to read it.</p>
    </div>
  )
}
