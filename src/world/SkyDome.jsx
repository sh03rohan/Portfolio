import { useMemo } from 'react'
import { BackSide, Color, ShaderMaterial, Vector3 } from 'three'

/**
 * The visible sky.
 *
 * A photographic HDRI gives lovely light but its colours are whatever the
 * photographer's evening looked like. Since the brief specifies an exact dusk
 * ramp — deep indigo through violet to coral and peach — the sky is drawn as a
 * gradient instead, and the HDRI is kept purely for image-based lighting. That
 * also means the horizon colour, the fog colour and the palette in the UI can
 * all be derived from the same four values.
 */

/** The dusk ramp, shared with the fog and the UI so everything agrees. */
export const SKY = {
  zenith: '#1f1a44',
  high: '#443a76',
  mid: '#6d5490',
  horizon: '#d4836d',
  glow: '#ffc98a',
}

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize( position );
    // Drop the translation so the dome stays centred on the camera, and force
    // z = w so it always sits exactly on the far plane.
    mat4 view = modelViewMatrix;
    view[3].xyz = vec3( 0.0 );
    vec4 clip = projectionMatrix * view * vec4( position, 1.0 );
    gl_Position = clip.xyww;
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 uZenith, uHigh, uMid, uHorizon, uGlow;
  uniform vec3 uSunDir;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize( vDir );
    float h = clamp( dir.y * 0.5 + 0.5, 0.0, 1.0 );

    // Four-stop vertical ramp: peach at the horizon up to indigo overhead.
    vec3 sky = mix( uHorizon, uMid,    smoothstep( 0.500, 0.545, h ) );
    sky      = mix( sky,      uHigh,   smoothstep( 0.535, 0.640, h ) );
    sky      = mix( sky,      uZenith, smoothstep( 0.630, 0.900, h ) );

    // Below the horizon line, deepen toward the sea.
    sky = mix( sky * 0.55, sky, smoothstep( 0.34, 0.5, h ) );

    // Warm bloom around the sun, and a broad wash along the whole horizon.
    float sun = max( 0.0, dot( dir, normalize( uSunDir ) ) );
    sky += uGlow * pow( sun, 24.0 ) * 0.55;
    sky += uGlow * pow( sun, 3.0 ) * 0.16;
    sky += uGlow * 0.09 * pow( 1.0 - abs( dir.y ), 8.0 );

    gl_FragColor = vec4( sky, 1.0 );
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export default function SkyDome({ sunDirection = [-52, 26, -34] }) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: BackSide,
        depthWrite: false,
        fog: false,
        toneMapped: false,
        uniforms: {
          uZenith: { value: new Color(SKY.zenith) },
          uHigh: { value: new Color(SKY.high) },
          uMid: { value: new Color(SKY.mid) },
          uHorizon: { value: new Color(SKY.horizon) },
          uGlow: { value: new Color(SKY.glow) },
          uSunDir: { value: new Vector3(...sunDirection).normalize() },
        },
      }),
    [sunDirection.join()],
  )

  return (
    <mesh material={material} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 16]} />
    </mesh>
  )
}
