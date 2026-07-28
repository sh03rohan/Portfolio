import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshStandardMaterial, Color } from 'three'
import { island } from '../data/world.js'
import { SKY } from './SkyDome.jsx'
import { WEATHER } from '../data/weather.js'
import { useStore } from '../store.js'

/**
 * The water ringing the island.
 *
 * Rather than a reflection pass (expensive) this leans on the HDRI: a low
 * roughness, lightly metallic surface picks up the sunset sky almost for free.
 * Ripples are analytic — two crossed wave trains perturb the normal in the
 * fragment shader, so the mesh itself stays a two-triangle plane.
 */
function createWaterMaterial() {
  const material = new MeshStandardMaterial({
    color: new Color('#1b2347'),
    roughness: 0.08,
    metalness: 0.7,
    envMapIntensity: 1.8,
    transparent: true,
    opacity: 0.94,
    // The scene fog is a mauve tuned for the island; applying it to the sea
    // would leave a hard seam where mauve water meets a coral sky. The sea
    // fades toward the horizon colour on its own instead.
    fog: false,
  })

  material.userData.uniforms = {
    uTime: { value: 0 },
    uHorizon: { value: new Color(SKY.horizon) },
  }

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = material.userData.uniforms.uTime
    shader.uniforms.uHorizon = material.userData.uniforms.uHorizon

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorld = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `
        #include <common>
        uniform float uTime;
        uniform vec3 uHorizon;
        varying vec3 vWorld;
        `,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        #include <opaque_fragment>
        // Dissolve into the sky colour with distance so the far edge of the
        // water plane never shows as a line against the horizon.
        float haze = smoothstep( 90.0, 420.0, length( vWorld - cameraPosition ) );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, uHorizon, haze * 0.92 );
        gl_FragColor.a = mix( gl_FragColor.a, 1.0, haze );
        `,
      )
      .replace(
        '#include <normal_fragment_begin>',
        /* glsl */ `
        #include <normal_fragment_begin>
        vec2 p = vWorld.xz;
        // Two wave trains at different scales and speeds read as open water.
        float h1 = sin( p.x * 0.28 + uTime * 0.7 ) * cos( p.y * 0.21 - uTime * 0.5 );
        float h2 = sin( ( p.x + p.y ) * 0.62 - uTime * 1.1 );
        vec3 ripple = normalize( vec3( h1 * 0.16 + h2 * 0.06, 1.0, h1 * 0.13 - h2 * 0.07 ) );
        // Flatten the ripples with distance. Past a hundred metres or so a
        // wave is smaller than a pixel, and keeping them produces moire bands
        // across the whole horizon.
        float calm = 1.0 - smoothstep( 40.0, 150.0, length( vWorld - cameraPosition ) );
        normal = normalize( mix( normal, ripple, 0.85 * calm ) );
        `,
      )
  }

  return material
}

export default function Sea() {
  const material = useMemo(createWaterMaterial, [])
  const reducedMotion = useStore((s) => s.reducedMotion)
  const time = useRef(0)

  const scratch = useMemo(() => new Color(), [])

  useFrame((_, delta) => {
    if (!reducedMotion) {
      time.current += delta
      material.userData.uniforms.uTime.value = time.current
    }

    // Follow the weather: water is mostly reflected sky, so leaving it violet
    // through a snowstorm reads as a bug. Eased at the same rate as the sky.
    const target = WEATHER[useStore.getState().weatherIndex]
    const k = Math.min(1, delta * 0.9)
    material.color.lerp(scratch.set(target.seaColor), k)
    material.userData.uniforms.uHorizon.value.lerp(scratch.set(target.sky.horizon), k)
  })

  // The plane is wide enough that its far edge sits past the fog's far plane,
  // so the horizon reads as open water rather than a visible seam.
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={island.seaLevel} material={material} renderOrder={1}>
      <planeGeometry args={[900, 900, 1, 1]} />
    </mesh>
  )
}
