/**
 * A one-line event bus for one-shot sounds.
 *
 * Things inside the canvas need to make a noise — picking up a spark, finishing
 * the set — but the audio graph belongs to Audio.jsx, and reaching into it from
 * the frame loop would either put the engine in a store (re-rendering the tree
 * whenever a sound plays) or hand every component its own AudioContext.
 *
 * So the world emits names and Audio.jsx is the only thing that knows what they
 * sound like. With no listener attached — audio muted, which is the default —
 * emitting is a no-op.
 */
const listeners = new Set()

export const sfx = {
  emit(name, detail) {
    for (const listener of listeners) listener(name, detail)
  },
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
