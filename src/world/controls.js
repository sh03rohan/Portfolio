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

/**
 * True while the visitor is typing into something.
 *
 * Every global key handler has to check this first. The guestbook is the reason:
 * `E` is bound to open and close a zone, so writing the word "the" into the
 * message field used to shut the panel mid-sentence — and `Space` jumped, and
 * WASD walked away from the platform.
 *
 * Movement is stopped a second way too, by handing ecctrl `disableControl` while
 * a panel is open (see Player.jsx). Both are needed: this guards the handlers
 * that read the key map, and that stops the ones that read it every frame.
 */
export function isTyping() {
  const el = document.activeElement
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable === true
}

/** Shown in the HUD legend. */
export const controlHints = [
  { keys: ['W', 'A', 'S', 'D'], label: 'Move' },
  { keys: ['Shift'], label: 'Sprint' },
  { keys: ['Space'], label: 'Jump' },
  { keys: ['E'], label: 'Open' },
  { keys: ['Drag'], label: 'Look' },
]
