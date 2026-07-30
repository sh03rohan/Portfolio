import { useFrame } from '@react-three/fiber'
import { WEATHER } from '../data/weather.js'
import { useStore } from '../store.js'

/**
 * One clock for everything that moves on the GPU.
 *
 * Trees, grass, birds, smoke and fireflies are all instanced, which means the
 * only way to animate them without a CPU loop over hundreds of objects is a
 * vertex shader driven by a shared uniform. These three objects are that
 * shared state: they're handed straight to `shader.uniforms` (three keeps the
 * reference, so writing `.value` here reaches every material at once), and
 * exactly one component advances them.
 *
 * The brief suggested `three-custom-shader-material` for this. It isn't a
 * dependency of this project and doesn't need to be — the terrain splat and
 * the canopy wind already extend MeshStandardMaterial through
 * `onBeforeCompile`, which is the same capability for no extra bytes.
 */

/** Seconds since the clock started. Everything phase-based reads this. */
export const uTime = { value: 0 }

/**
 * Wind phase. Advances *faster* in strong weather rather than only wider, so a
 * gale reads as quicker gusts and not just deeper ones.
 */
export const uWind = { value: 0 }

/** 0..1.4-ish, eased toward the current preset's `wind`. */
export const uWindStrength = { value: WEATHER[useStore.getState().weatherIndex].wind }

/**
 * 1 normally, 0 under `prefers-reduced-motion`.
 *
 * Freezing `uTime` stops everything moving, but it also freezes each particle
 * at whatever point in its own cycle it happened to reach — half the fireflies
 * caught mid-blink and dark. This lets a shader fall back to a steady value
 * instead of a frozen one, so a still island is still a lit island.
 */
export const uAnimate = { value: 1 }

/**
 * The only writer. Mounted once, unconditionally — quality tiers switch pieces
 * of ambience off, and if the clock lived inside one of them the rest would
 * freeze along with it.
 */
export function WindClock() {
  useFrame((_, delta) => {
    const { reducedMotion, weatherIndex } = useStore.getState()
    // A long frame (tab wake-up, shader compile) would otherwise jump the
    // phase far enough to teleport every bird and puff of smoke.
    const step = Math.min(delta, 0.1)

    const target = WEATHER[weatherIndex].wind
    uWindStrength.value += (target - uWindStrength.value) * Math.min(1, step * 0.5)
    uAnimate.value = reducedMotion ? 0 : 1

    if (reducedMotion) return
    uTime.value += step
    uWind.value += step * (0.5 + uWindStrength.value * 0.9)

    if (import.meta.env.DEV) {
      // Everything in the ambience layer is animated by these three numbers,
      // so if something looks frozen this says whether the clock is the reason.
      window.__wind = {
        frames: (window.__wind?.frames ?? 0) + 1,
        lastDelta: delta,
        uTime: uTime.value,
        uWind: uWind.value,
        strength: uWindStrength.value,
      }
    }
  })

  return null
}

/**
 * Bends a prop away from its base, in the same gust the trees are riding.
 *
 * The weight is the vertex's own height over the model, squared, so the roots
 * stay planted and only the tips travel — the giveaway of cheap foliage wind is
 * the whole plant sliding sideways. Two sine waves at unrelated rates keep the
 * gust from reading as a loop, and the per-instance phase comes out of the
 * instance matrix's translation so no extra attribute is needed.
 *
 * Note this moves the colour pass only. Anything using it that also casts a
 * shadow keeps a still shadow — true of the canopy since phase 1, and
 * imperceptible at grass and bush scale.
 */
export function applyWindSway(material, { height = 1, amount = 0.1, key }) {
  /**
   * Patching a material twice appends the uniform block twice, and GLSL
   * rejects a redeclared uniform — the whole program fails to link and the
   * plant renders as nothing. That happens more easily than it sounds:
   * StrictMode invokes a useMemo factory twice in development, and any
   * re-render that changes the memo's dependencies would do it in production
   * too. Cheaper to make this idempotent than to make every caller careful.
   */
  if (material.userData.windSway) return material
  material.userData.windSway = true

  const uSwayHeight = { value: Math.max(0.001, height) }
  const uSwayAmount = { value: amount }
  const previous = material.onBeforeCompile

  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer)

    shader.uniforms.uWind = uWind
    shader.uniforms.uWindStrength = uWindStrength
    shader.uniforms.uSwayHeight = uSwayHeight
    shader.uniforms.uSwayAmount = uSwayAmount

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uWind;
        uniform float uWindStrength;
        uniform float uSwayHeight;
        uniform float uSwayAmount;
        `,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `
        #include <begin_vertex>
        float swayW = clamp( transformed.y / uSwayHeight, 0.0, 1.0 );
        swayW *= swayW;
        #ifdef USE_INSTANCING
          float swayPhase = instanceMatrix[3][0] * 0.35 + instanceMatrix[3][2] * 0.27;
        #else
          float swayPhase = 0.0;
        #endif
        float gust = sin( uWind + swayPhase ) * 0.6 + sin( uWind * 1.93 + swayPhase * 2.3 ) * 0.4;
        float bend = swayW * uSwayAmount * uWindStrength;
        transformed.x += gust * bend;
        transformed.z += cos( uWind * 0.77 + swayPhase * 1.4 ) * bend * 0.7;
        `,
      )
  }

  // Without a distinct key three hands back the cached stock program and none
  // of the above ever runs.
  material.customProgramCacheKey = () => key
  return material
}
