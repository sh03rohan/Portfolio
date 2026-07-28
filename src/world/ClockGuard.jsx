import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * Swallows the giant frame delta that follows a pause.
 *
 * three's clock reports real elapsed time, so coming back from a backgrounded
 * tab — or any long stall — hands every useFrame a delta of seconds rather
 * than milliseconds. ecctrl scales its movement and float-spring forces by
 * that delta, so the character launches off the island; particle systems jump
 * a similar distance.
 *
 * Calling getDelta() here consumes the accumulated time so the next real frame
 * starts from roughly zero, which is exactly what we want to happen to it.
 */
export default function ClockGuard() {
  const clock = useThree((state) => state.clock)

  useEffect(() => {
    const discard = () => {
      if (!document.hidden) clock.getDelta()
    }
    document.addEventListener('visibilitychange', discard)
    window.addEventListener('focus', discard)
    return () => {
      document.removeEventListener('visibilitychange', discard)
      window.removeEventListener('focus', discard)
    }
  }, [clock])

  return null
}
