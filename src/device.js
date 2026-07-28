import { useEffect, useState } from 'react'

/** Subscribes to a media query and re-renders only when it flips. */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const list = window.matchMedia(query)
    const sync = () => setMatches(list.matches)
    sync()
    list.addEventListener('change', sync)
    return () => list.removeEventListener('change', sync)
  }, [query])

  return matches
}

/**
 * Touch-first device: no hover, coarse pointer. Used to pick the on-screen
 * joystick over the keyboard legend, and to skip the effects that are far too
 * expensive on a phone GPU regardless of how the frame timer is doing.
 */
export const useTouchDevice = () => useMediaQuery('(hover: none) and (pointer: coarse)')
