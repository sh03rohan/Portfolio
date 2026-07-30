/**
 * The sky lantern guestbook.
 *
 * Two backends behind one interface. If `VITE_SUPABASE_URL` and
 * `VITE_SUPABASE_ANON_KEY` are set, messages go to a shared Postgres table and
 * every visitor sees every other visitor's lantern. If they aren't, everything
 * falls back to `localStorage` — the whole feature still works, it's just
 * private to that browser. Nothing anywhere needs to know which is in use.
 *
 * **No SDK.** The brief called for `@supabase/supabase-js`; this talks to the
 * same service over plain `fetch` instead. Supabase's REST layer is PostgREST,
 * so a select is a GET and an insert is a POST — about thirty lines here
 * against roughly 40kB gzipped of client library, on a page that already ships
 * 5MB. Swapping the SDK back in means replacing `select()` and `insert()`
 * below and nothing else.
 */

const URL_BASE = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when a shared database is configured. */
export const isShared = Boolean(URL_BASE && ANON_KEY)

export const NAME_MAX = 40
export const MESSAGE_MAX = 140

/** How long between one visitor's releases. Client-side only — see below. */
export const COOLDOWN_MS = 30_000

const LOCAL_KEY = 'rohan-portfolio:lanterns'
const LAST_SENT_KEY = 'rohan-portfolio:lantern-sent'

/**
 * Messages you'd like in the sky before anyone else has written one.
 *
 * Deliberately empty. An empty sky on a brand-new install is honest; inventing
 * visitor messages to fill it would put words in strangers' mouths. Add your
 * own here if you'd rather it wasn't empty on day one — they're yours, so
 * they're fair to show.
 *
 *   { name: 'Rohan', message: 'Thanks for coming by.', hue: 30 }
 */
export const seedLanterns = []

// ------------------------------------------------------------ validation ---

/**
 * A short, deliberately mild word list.
 *
 * Worth being clear about what this is and isn't. Anyone can read the anon key
 * out of the bundle and POST straight to the API, so **this is a politeness
 * filter, not a security control** — it stops an unthinking submission, not a
 * determined one. The controls that actually hold are the length checks in the
 * RLS policy (enforced by Postgres, not by this file) and your ability to
 * delete a row. If the guestbook ever gets real traffic, add a moderation flag
 * defaulting to false and select only approved rows.
 */
const BLOCKED = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'asshole',
  'bastard',
  'dickhead',
  'wanker',
  'slut',
  'whore',
  'retard',
  'nigger',
  'faggot',
]

/** Catches f-u-c-k, f*ck and fuuuck without catching Scunthorpe. */
function normalise(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z]+/g, '')
    .replace(/(.)\1{2,}/g, '$1$1')
}

export function hasBlockedWord(text) {
  const flat = normalise(text)
  return BLOCKED.some((word) => flat.includes(word))
}

/**
 * Returns `{ ok, name, message, error }`. The caller shows `error` verbatim, so
 * these read as a person talking rather than as a form validator.
 */
export function validate({ name, message }) {
  const cleanName = (name ?? '').trim().replace(/\s+/g, ' ').slice(0, NAME_MAX)
  const cleanMessage = (message ?? '').trim().replace(/\s+/g, ' ').slice(0, MESSAGE_MAX)

  if (!cleanName) return { ok: false, error: 'A name would be nice — even a first one.' }
  if (!cleanMessage) return { ok: false, error: 'Your lantern needs something written on it.' }
  if (hasBlockedWord(cleanName) || hasBlockedWord(cleanMessage)) {
    return { ok: false, error: "Let's keep it kind — try different wording." }
  }

  return { ok: true, name: cleanName, message: cleanMessage }
}

/** Milliseconds still to wait, or 0. */
export function cooldownRemaining() {
  try {
    const last = Number(localStorage.getItem(LAST_SENT_KEY) ?? 0)
    return Math.max(0, COOLDOWN_MS - (Date.now() - last))
  } catch {
    return 0
  }
}

function markSent() {
  try {
    localStorage.setItem(LAST_SENT_KEY, String(Date.now()))
  } catch {
    // Private mode. The cooldown is a courtesy, not a gate.
  }
}

// --------------------------------------------------------------- storage ---

function readLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

function writeLocal(list) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 250)))
  } catch {
    // Nothing to do about it.
  }
}

const headers = () => ({
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json',
})

/** Newest first. Never rejects — an unreachable database shows an empty sky. */
export async function fetchLanterns(limit = 250) {
  if (!isShared) return [...seedLanterns, ...readLocal()]

  try {
    const query = new URLSearchParams({
      select: 'name,message,hue,created_at',
      order: 'created_at.desc',
      limit: String(limit),
    })
    const response = await fetch(`${URL_BASE}/rest/v1/lanterns?${query}`, {
      headers: headers(),
    })
    if (!response.ok) throw new Error(`Supabase responded ${response.status}`)
    const rows = await response.json()
    return [...seedLanterns, ...(Array.isArray(rows) ? rows : [])]
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[lanterns] falling back to local:', error.message)
    return [...seedLanterns, ...readLocal()]
  }
}

/** Writes one lantern. Throws with a readable message so the panel can show it. */
export async function addLantern({ name, message, hue }) {
  const entry = { name, message, hue, created_at: new Date().toISOString() }

  if (!isShared) {
    writeLocal([entry, ...readLocal()])
    markSent()
    return entry
  }

  const response = await fetch(`${URL_BASE}/rest/v1/lanterns`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=representation' },
    body: JSON.stringify({ name, message, hue }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    if (import.meta.env.DEV) console.warn('[lanterns] insert failed:', response.status, detail)
    throw new Error("That didn't send. Your lantern is in the sky here, at least.")
  }

  markSent()
  const [row] = await response.json().catch(() => [])
  return row ?? entry
}

// ------------------------------------------------------ suspense resource ---

/**
 * Read during render inside the ready-gate Suspense boundary, so the sky is
 * populated *before* the loading veil lifts. Otherwise the lanterns would pop
 * in a second after the reveal, which is exactly what the gate exists to stop.
 */
let resource = null

export function readLanterns() {
  if (!resource) {
    resource = { status: 'pending', value: null }
    resource.promise = fetchLanterns().then((value) => {
      resource.status = 'done'
      resource.value = value
    })
  }
  if (resource.status === 'pending') throw resource.promise
  return resource.value
}

/** Keeps the cached list in step after a release, without a refetch. */
export function primeResource(list) {
  resource = { status: 'done', value: list, promise: Promise.resolve() }
}
