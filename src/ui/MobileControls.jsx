import { useEffect, useMemo, useState } from 'react'
import { MeshBasicMaterial, Color } from 'three'
import { EcctrlJoystick } from 'ecctrl'

/** Touch-capable and without a hover pointer — i.e. a phone or tablet. */
function useTouchDevice() {
  const [touch, setTouch] = useState(false)
  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)')
    const sync = () => setTouch(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])
  return touch
}

/**
 * ecctrl's on-screen joystick and jump button, shown only on touch devices.
 *
 * The joystick renders into its own canvas which has no lights, so every
 * surface must use an unlit material — a MeshStandardMaterial here comes out
 * pure black.
 */
export default function MobileControls() {
  const touch = useTouchDevice()

  const materials = useMemo(() => {
    const unlit = (color, opacity = 1) =>
      new MeshBasicMaterial({
        color: new Color(color),
        transparent: opacity < 1,
        opacity,
        toneMapped: false,
      })

    return {
      base: unlit('#2a2350', 0.55),
      stick: unlit('#5a4a86', 0.8),
      handle: unlit('#ffc98a', 0.95),
      buttonBase: unlit('#2a2350', 0.5),
      buttonTop: unlit('#ffc98a', 0.9),
    }
  }, [])

  if (!touch) return null

  return (
    <EcctrlJoystick
      buttonNumber={1}
      // These are edge offsets, not centres: on a 390px-wide phone the
      // joystick spans left..left+size, so generous margins here put the two
      // controls on top of each other in the middle of the screen.
      joystickPositionLeft={24}
      joystickPositionBottom={32}
      joystickHeightAndWidth={150}
      buttonPositionRight={24}
      buttonPositionBottom={40}
      buttonHeightAndWidth={112}
      joystickBaseProps={{ material: materials.base }}
      joystickStickProps={{ material: materials.stick }}
      joystickHandleProps={{ material: materials.handle }}
      buttonLargeBaseProps={{ material: materials.buttonBase }}
      buttonTop1Props={{ material: materials.buttonTop }}
    />
  )
}
