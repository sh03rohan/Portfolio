import { EffectComposer, N8AO, Bloom, DepthOfField, Vignette, SMAA } from '@react-three/postprocessing'
import { useStore } from '../store.js'
import { useTouchDevice } from '../device.js'

/**
 * The post stack. Golden rule from the brief: effects should be felt, not
 * seen — if it reads as a filter, it's dialled too far.
 *
 *   N8AO         contact darkening in the creases; the biggest realism win
 *   Bloom        just the sun and the lantern glass, nothing else
 *   DepthOfField a whisper of distance falloff
 *   Vignette     pulls the eye to the middle
 *   SMAA         cleans the alpha-cutout foliage edges
 *
 * The whole stack drops out at low quality and under prefers-reduced-motion
 * (DOF in particular is uncomfortable for motion-sensitive viewers).
 */
export default function Effects() {
  const quality = useStore((s) => s.quality)
  const reducedMotion = useStore((s) => s.reducedMotion)

  // Ambient occlusion and depth of field are by far the most expensive passes
  // here, and mobile GPUs choke on them long before the frame monitor has
  // noticed — so they're desktop-only regardless of the measured tier.
  const touch = useTouchDevice()

  if (quality === 'low') return null

  const high = quality === 'high' && !touch

  return (
    <EffectComposer multisampling={0} enableNormalPass={high}>
      {high ? (
        <N8AO aoRadius={1.6} intensity={2.1} distanceFalloff={0.8} quality="medium" halfRes />
      ) : (
        <></>
      )}

      <Bloom mipmapBlur luminanceThreshold={0.95} luminanceSmoothing={0.25} intensity={0.55} />

      {high && !reducedMotion ? (
        // Deliberately gentle: enough to soften the far shore, never enough to
        // blur anything the player is looking at.
        <DepthOfField focusDistance={0.06} focalLength={0.5} bokehScale={1.6} />
      ) : (
        <></>
      )}

      <Vignette offset={0.32} darkness={0.5} eskil={false} />
      <SMAA />
    </EffectComposer>
  )
}
