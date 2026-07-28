import { create } from 'zustand'

/**
 * Global UI/world state. Deliberately small — anything that changes every
 * frame (player transform) is kept in refs, not here, so React never re-renders
 * on the animation loop.
 */
export const useStore = create((set, get) => ({
  // --- loading -------------------------------------------------------------
  entered: false,
  enter: () => set({ entered: true }),

  // --- proximity / panels --------------------------------------------------
  /** id of the zone the player is currently standing inside, or null */
  nearZone: null,
  setNearZone: (id) => {
    if (get().nearZone === id) return
    set({ nearZone: id })
  },

  /** id of the zone whose panel is open, or null */
  openPanel: null,
  setOpenPanel: (id) => set({ openPanel: id }),
  togglePanel: (id) => set((s) => ({ openPanel: s.openPanel === id ? null : id })),
  closePanel: () => set({ openPanel: null }),

  /** zones the player has already opened at least once (for the HUD progress) */
  visited: [],
  markVisited: (id) =>
    set((s) => (s.visited.includes(id) ? s : { visited: [...s.visited, id] })),

  // --- audio ---------------------------------------------------------------
  audioOn: false, // off by default, per the brief
  toggleAudio: () => set((s) => ({ audioOn: !s.audioOn })),

  // --- quality -------------------------------------------------------------
  /** 'high' | 'medium' | 'low' — driven by <PerformanceMonitor> */
  quality: 'high',
  setQuality: (quality) => set((s) => (s.quality === quality ? s : { quality })),

  /** true when the OS asks for reduced motion */
  reducedMotion: false,
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),

  // --- accessibility fallback ---------------------------------------------
  textMode: false,
  setTextMode: (textMode) => set({ textMode }),
}))

export default useStore
