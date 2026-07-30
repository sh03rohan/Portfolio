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

/**
 * How the player is moving, alongside where they are.
 *
 * Footsteps need the ground speed and whether there's any ground under the
 * feet, and the player is the only thing that actually knows — deriving speed
 * from position deltas elsewhere would pick up the float spring's wobble and
 * the physics interpolation as movement. Written once per frame by
 * `PositionReporter`, same as the vector above.
 */
export const playerMotion = {
  /** Horizontal speed in units/second. */
  speed: 0,
  /** False while jumping or falling. */
  grounded: true,
}

/** Hook-shaped accessor so components can grab the setter without importing state. */
export const usePlayerPosition = (selector = (s) => s) => selector(playerPosition)
