/**
 * Fog, for additively blended particles.
 *
 * three's fog does the right thing for solid surfaces — it mixes the colour
 * toward `fogColor` as things recede — and exactly the wrong thing for anything
 * drawn with AdditiveBlending. Additive output is *added* to what's behind it,
 * so mixing a distant spark toward a pale fog colour makes it brighter and
 * greyer as it gets further away, which is the opposite of receding. In the fog
 * preset (fogColor #c3c0b6, fogFar 58) a firefly at the far shore ends up as a
 * bright gauzy blob.
 *
 * What's wanted is attenuation: a distant glow contributes less light. So the
 * material keeps `fog: true` — that's what makes three declare `fogColor`,
 * `fogNear`, `fogFar` and the `vFogDepth` varying — and this replaces the
 * chunk that uses them with one that scales alpha instead.
 *
 * Only the linear-fog branch is implemented, because Weather.jsx builds a
 * linear `Fog` from each preset's fogNear/fogFar. If that ever becomes a
 * FogExp2 this needs the density branch too, hence the assertion in dev.
 */
export function attenuateFog(shader) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <fog_fragment>',
    /* glsl */ `
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
      #else
        float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
      #endif
      gl_FragColor.a *= 1.0 - fogFactor;
    #endif
    `,
  )
}
