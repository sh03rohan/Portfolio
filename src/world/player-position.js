import { Vector3 } from 'three'

/**
 * The player's world position, kept outside React.
 *
 * This changes 60 times a second; routing it through zustand state (or worse,
 * component state) would re-render the tree on every frame. Instead readers
 * subscribe once and pull from a shared vector inside their own useFrame.
 */
const current = new Vector3()
const listeners = new Set()

export const playerPosition = {
  get: () => current,
  set(next) {
    current.copy(next)
    for (const listener of listeners) listener(current)
  },
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

/** Hook-shaped accessor so components can grab the setter without importing state. */
export const usePlayerPosition = (selector = (s) => s) => selector(playerPosition)
