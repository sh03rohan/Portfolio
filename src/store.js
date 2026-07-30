import { create } from 'zustand'
import { WEATHER } from './data/weather.js'
import { collectibleCount } from './data/collectibles.js'

const FOUND_KEY = 'rohan-portfolio:found'

/**
 * Reading and writing localStorage both throw outright in Safari's private
 * mode, so every access is guarded. A visitor who can't persist their finds
 * should still be able to make them.
 */
function loadFound() {
  try {
    const raw = JSON.parse(localStorage.getItem(FOUND_KEY) ?? '[]')
    return Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : []
  } catch {
    return []
  }
}

function saveFound(found) {
  try {
    localStorage.setItem(FOUND_KEY, JSON.stringify(found))
  } catch {
    // Nothing to do about it, and nothing worth telling the visitor.
  }
}

const pinnedWeather = () =>
  import.meta.env.DEV ? new URLSearchParams(window.location.search).get('weather') : null

function startingWeather() {
  const key = pinnedWeather()
  const index = WEATHER.findIndex((w) => w.key === key)
  return index >= 0 ? index : 1
}

/**
 * Global UI/world state. Deliberately small — anything that changes every
 * frame (player transform) is kept in refs, not here, so React never re-renders
 * on the animation loop.
 */
export const useStore = create((set, get) => ({
  // --- loading -------------------------------------------------------------
  /**
   * True once every asset has loaded, every shader has compiled and a real
   * frame has been drawn. The loading screen refuses to lift before this, so
   * nothing loads, compiles or settles in front of the visitor.
   */
  ready: false,
  setReady: () => set({ ready: true }),

  entered: false,
  enter: () => set({ entered: true }),

  // --- proximity / zones ---------------------------------------------------
  /** id of the zone the player is currently standing inside, or null */
  nearZone: null,
  setNearZone: (id) => {
    if (get().nearZone === id) return
    set({ nearZone: id })
  },

  /** id of the zone whose cards are fanned out, or null */
  openZone: null,
  setOpenZone: (id) => set({ openZone: id }),
  toggleZone: (id) => set((s) => ({ openZone: s.openZone === id ? null : id })),
  closeZone: () => set({ openZone: null }),

  /** zones the player has already opened at least once (for the HUD progress) */
  visited: [],
  markVisited: (id) =>
    set((s) => (s.visited.includes(id) ? s : { visited: [...s.visited, id] })),

  // --- collectibles --------------------------------------------------------
  /**
   * ids of the sparks already picked up, restored from the last visit.
   *
   * Only ever appended to, and it holds ids rather than a count so that moving
   * or renaming a collectible can't leave someone stuck at 11 of 12 forever.
   */
  found: loadFound(),

  /**
   * Set on the frame the last spark is collected, and only then — not on a
   * later visit that merely loads a full list. The reward is a moment, and a
   * moment you get again on every reload isn't one.
   */
  celebrating: false,
  endCelebration: () => set({ celebrating: false }),

  markFound: (id) =>
    set((s) => {
      if (s.found.includes(id)) return s
      const found = [...s.found, id]
      saveFound(found)
      return { found, celebrating: found.length >= collectibleCount }
    }),

  /** Clicks on the character earn a spin; this is what the model watches. */
  emotes: 0,
  emote: () => set((s) => ({ emotes: s.emotes + 1 })),

  // --- weather -------------------------------------------------------------
  /**
   * Index into WEATHER. Only the *target* lives here — every visible value
   * (sky stops, fog, light colour and intensity) is lerped toward it inside
   * Weather.jsx's frame loop, so switching never snaps.
   */
  weatherIndex: startingWeather(), // sunset — the scene's signature look
  // `?weather=<key>` in dev pins one preset, which keeps review screenshots
  // from drifting to a different sky halfway through.
  autoWeather: !pinnedWeather(),
  setWeather: (weatherIndex) => set({ weatherIndex }),
  nextWeather: () => set((s) => ({ weatherIndex: (s.weatherIndex + 1) % WEATHER.length })),
  toggleAuto: () => set((s) => ({ autoWeather: !s.autoWeather })),

  // --- audio ---------------------------------------------------------------
  audioOn: false, // off by default, per the brief
  toggleAudio: () => set((s) => ({ audioOn: !s.audioOn })),

  // --- quality -------------------------------------------------------------
  /**
   * 'high' | 'medium' | 'low' — driven by <PerformanceMonitor>.
   * `?quality=low` forces it in dev, which makes headless testing bearable.
   */
  quality:
    (import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get('quality')) ||
    'high',
  setQuality: (quality) => set((s) => (s.quality === quality ? s : { quality })),

  /** true when the OS asks for reduced motion */
  reducedMotion: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),

  // --- accessibility fallback ---------------------------------------------
  textMode: false,
  setTextMode: (textMode) => set({ textMode }),
}))

export default useStore
