/**
 * Key bindings for ecctrl. WASD and the arrow keys both work; Shift sprints,
 * Space jumps, E is the zone interaction added in Phase 3.
 */
export const keyboardMap = [
  { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
  { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
  { name: 'leftward', keys: ['ArrowLeft', 'KeyA'] },
  { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'run', keys: ['ShiftLeft', 'ShiftRight'] },
  { name: 'action1', keys: ['KeyE'] },
]

/** Shown in the HUD legend. */
export const controlHints = [
  { keys: ['W', 'A', 'S', 'D'], label: 'Move' },
  { keys: ['Shift'], label: 'Sprint' },
  { keys: ['Space'], label: 'Jump' },
  { keys: ['E'], label: 'Open' },
  { keys: ['Drag'], label: 'Look' },
]
