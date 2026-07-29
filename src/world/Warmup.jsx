import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useStore } from '../store.js'

/**
 * The gate between "loaded" and "ready".
 *
 * Assets being downloaded isn't the same as the scene being able to draw: the
 * first frame after a reveal is where shaders compile and geometry and
 * textures are uploaded to the GPU, and that costs hundreds of milliseconds of
 * stutter right when the visitor is first looking. Doing it here — behind the
 * loading screen, inside the same Suspense boundary as the content — moves
 * that cost somewhere nobody can see it.
 *
 * `compileAsync` is the important part: it resolves only once the driver
 * reports the programs are genuinely linked, rather than returning as soon as
 * the compile has been queued.
 *
 * Note this must run while everything is still *visible*. three compiles via
 * `traverseVisible`, so anything hidden at this moment is skipped and pays for
 * its shader later — which is why the weather's stars, rain and clouds are
 * forced on until `ready`.
 */
export default function Warmup() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    let cancelled = false
    const frames = []

    const finish = () => {
      if (cancelled) return
      // Draw once to force the remaining GPU uploads, then let two real frames
      // pass so the first thing revealed is a frame that already rendered
      // cheaply.
      gl.render(scene, camera)
      frames.push(
        requestAnimationFrame(() => {
          frames.push(requestAnimationFrame(() => !cancelled && useStore.getState().setReady()))
        }),
      )
    }

    const compiled = gl.compileAsync
      ? gl.compileAsync(scene, camera)
      : Promise.resolve(gl.compile(scene, camera))

    compiled.then(finish).catch(finish)

    return () => {
      cancelled = true
      frames.forEach(cancelAnimationFrame)
    }
  }, [gl, scene, camera])

  return null
}
