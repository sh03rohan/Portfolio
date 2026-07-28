import { useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Stars, SoftShadows } from '@react-three/drei'
import { Color, Fog, Vector3 } from 'three'
import { useStore } from '../store.js'
import { WEATHER } from '../data/weather.js'
import { island } from '../data/world.js'
import SkyDome from './SkyDome.jsx'
import Precip from './Precip.jsx'

/**
 * The single owner of sky, fog and light.
 *
 * Everything visible is held in a mutable `current` object and eased toward
 * the active preset every frame, so a weather change is a 2-3 second dissolve
 * rather than a cut. Nothing here reads the store reactively — the target is
 * pulled with `getState()` inside the frame loop, so switching weather doesn't
 * re-render the scene graph.
 *
 * This replaces the old standalone Lighting component; having two things set
 * `scene.fog` and the sun would just fight.
 */

/** How fast values chase the target. Higher = snappier. */
const EASE = 0.9

const lerp = (a, b, t) => a + (b - a) * t

/**
 * Stars sit at radius 160, which is deep inside the night fog — left alone
 * they'd be almost entirely fogged out. Real night air is clear, so take them
 * out of the fog calculation instead of pushing the fog away from the island.
 */
const ignoreFog = (group) => {
  group?.traverse((child) => {
    if (child.material && child.material.fog) {
      child.material.fog = false
      child.material.needsUpdate = true
    }
  })
}

export default function Weather() {
  const { scene } = useThree()
  const sun = useRef()
  const hemi = useRef()
  const skyMaterial = useRef()

  const quality = useStore((s) => s.quality)
  // Read reactively only for things that must remount: stars and the shadow
  // sampler. Everything else is interpolated below.
  const weatherIndex = useStore((s) => s.weatherIndex)
  const active = WEATHER[weatherIndex]

  // Seed from whatever the store already says, so a reload doesn't fade in
  // from the wrong weather.
  const current = useMemo(() => {
    const w = WEATHER[useStore.getState().weatherIndex]
    scene.fog = new Fog(w.fogColor, w.fogNear, w.fogFar)
    scene.background = new Color(w.bg)
    return {
      bg: new Color(w.bg),
      fog: new Color(w.fogColor),
      fogNear: w.fogNear,
      fogFar: w.fogFar,
      sunColor: new Color(w.sunColor),
      sunIntensity: w.sunIntensity,
      sunPos: new Vector3(...w.sunPos),
      hemiIntensity: w.ambientIntensity,
      envIntensity: w.envIntensity,
      sky: {
        zenith: new Color(w.sky.zenith),
        high: new Color(w.sky.high),
        mid: new Color(w.sky.mid),
        horizon: new Color(w.sky.horizon),
        glow: new Color(w.sky.glow),
      },
    }
  }, [scene])

  const scratch = useMemo(() => new Color(), [])

  useFrame((_, delta) => {
    const target = WEATHER[useStore.getState().weatherIndex]
    const k = Math.min(1, delta * EASE)
    const c = current

    c.bg.lerp(scratch.set(target.bg), k)
    if (scene.background?.isColor) scene.background.copy(c.bg)

    c.fog.lerp(scratch.set(target.fogColor), k)
    c.fogNear = lerp(c.fogNear, target.fogNear, k)
    c.fogFar = lerp(c.fogFar, target.fogFar, k)
    if (scene.fog) {
      scene.fog.color.copy(c.fog)
      scene.fog.near = c.fogNear
      scene.fog.far = c.fogFar
    }

    c.envIntensity = lerp(c.envIntensity, target.envIntensity, k)
    scene.environmentIntensity = c.envIntensity

    c.sunColor.lerp(scratch.set(target.sunColor), k)
    c.sunIntensity = lerp(c.sunIntensity, target.sunIntensity, k)
    c.sunPos.x = lerp(c.sunPos.x, target.sunPos[0], k)
    c.sunPos.y = lerp(c.sunPos.y, target.sunPos[1], k)
    c.sunPos.z = lerp(c.sunPos.z, target.sunPos[2], k)

    if (sun.current) {
      sun.current.color.copy(c.sunColor)
      sun.current.intensity = c.sunIntensity
      sun.current.position.copy(c.sunPos)
    }

    c.hemiIntensity = lerp(c.hemiIntensity, target.ambientIntensity, k)
    if (hemi.current) hemi.current.intensity = c.hemiIntensity

    // Repaint the gradient sky and keep its sun glow on the real sun.
    const uniforms = skyMaterial.current?.uniforms
    if (uniforms) {
      c.sky.zenith.lerp(scratch.set(target.sky.zenith), k)
      c.sky.high.lerp(scratch.set(target.sky.high), k)
      c.sky.mid.lerp(scratch.set(target.sky.mid), k)
      c.sky.horizon.lerp(scratch.set(target.sky.horizon), k)
      c.sky.glow.lerp(scratch.set(target.sky.glow), k)
      uniforms.uZenith.value.copy(c.sky.zenith)
      uniforms.uHigh.value.copy(c.sky.high)
      uniforms.uMid.value.copy(c.sky.mid)
      uniforms.uHorizon.value.copy(c.sky.horizon)
      uniforms.uGlow.value.copy(c.sky.glow)
      uniforms.uSunDir.value.copy(c.sunPos).normalize()
    }
  })

  const shadowSpan = island.radius + 8
  const shadowMap = quality === 'low' ? 512 : 1024

  return (
    <>
      <SkyDome materialRef={skyMaterial} />

      {quality === 'high' && <SoftShadows size={26} samples={12} focus={0.6} />}

      <hemisphereLight ref={hemi} args={['#ffffff', '#5f4a2e', active.ambientIntensity]} />

      {/* The one shadow caster in the scene. */}
      <directionalLight
        ref={sun}
        castShadow
        position={active.sunPos}
        intensity={active.sunIntensity}
        color={active.sunColor}
        shadow-mapSize={[shadowMap, shadowMap]}
        shadow-bias={-0.0006}
        shadow-normalBias={0.035}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-shadowSpan, shadowSpan, shadowSpan, -shadowSpan, 1, 190]}
        />
      </directionalLight>

      {/* Cool counter-bounce so shadowed faces read coloured, not black. */}
      <directionalLight position={[34, 14, 30]} intensity={0.32} color="#8ea6ff" />

      {active.stars > 0 && (
        <group ref={ignoreFog}>
          <Stars
            radius={160}
            depth={60}
            count={quality === 'low' ? 700 : 1600}
            factor={5}
            fade
            speed={0.4}
          />
        </group>
      )}

      <Precip type="rain" amount={active.rain} />
      <Precip type="snow" amount={active.snow} />
    </>
  )
}
