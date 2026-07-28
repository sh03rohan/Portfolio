import { MeshStandardMaterial, Vector2 } from 'three'

/**
 * A four-way splatted ground material.
 *
 * It extends MeshStandardMaterial rather than replacing it, so the terrain
 * keeps real PBR shading, image-based lighting from the HDRI and shadow
 * receiving for free. The grass set is bound through the standard `map` /
 * `normalMap` / `roughnessMap` / `aoMap` slots — that makes three declare the
 * uniforms, UV varyings and the tangent frame we need — and the remaining
 * three sets are blended on top in the fragment shader.
 *
 * Blend weights:
 *   sand  — low ground near the waterline
 *   cliff — steep faces, sampled with a vertical projection so it doesn't smear
 *   dirt  — the worn path, supplied per-vertex as the `aPath` attribute
 *   grass — everything else
 */
export default class TerrainMaterial extends MeshStandardMaterial {
  constructor({ grass, dirt, sand, cliff, seaLevel = -1.6, ...params } = {}) {
    super({
      map: grass.albedo,
      normalMap: grass.normal,
      roughnessMap: grass.arm,
      aoMap: grass.arm,
      normalScale: new Vector2(1.1, 1.1),
      roughness: 1,
      metalness: 0,
      aoMapIntensity: 1,
      dithering: true,
      ...params,
    })

    this.uniformsData = {
      uDirtAlbedo: { value: dirt.albedo },
      uDirtNormal: { value: dirt.normal },
      uDirtArm: { value: dirt.arm },
      uSandAlbedo: { value: sand.albedo },
      uSandNormal: { value: sand.normal },
      uCliffAlbedo: { value: cliff.albedo },
      uCliffNormal: { value: cliff.normal },
      // Tiling frequencies, in tiles per world unit.
      uScale: { value: [0.09, 0.16, 0.11, 0.075] }, // grass, dirt, sand, cliff
      uSeaLevel: { value: seaLevel },
    }

    this.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniformsData)

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          attribute float aPath;
          varying float vPath;
          varying vec3 vWorldPos;
          varying vec3 vGeoNormal;
          `,
        )
        .replace(
          '#include <worldpos_vertex>',
          /* glsl */ `
          #include <worldpos_vertex>
          vPath = aPath;
          vWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
          vGeoNormal = normalize( mat3( modelMatrix ) * objectNormal );
          `,
        )

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          /* glsl */ `
          #include <common>
          uniform sampler2D uDirtAlbedo, uDirtNormal, uDirtArm;
          uniform sampler2D uSandAlbedo, uSandNormal;
          uniform sampler2D uCliffAlbedo, uCliffNormal;
          uniform vec4 uScale;
          uniform float uSeaLevel;
          varying float vPath;
          varying vec3 vWorldPos;
          varying vec3 vGeoNormal;

          // Weights are computed once and reused by every map lookup below.
          vec4 splatWeights() {
            float slope = 1.0 - clamp( vGeoNormal.y, 0.0, 1.0 );
            float cliff = smoothstep( 0.30, 0.62, slope );
            float sand  = ( 1.0 - cliff ) * ( 1.0 - smoothstep( uSeaLevel + 0.4, uSeaLevel + 2.6, vWorldPos.y ) );
            float dirt  = clamp( vPath, 0.0, 1.0 ) * ( 1.0 - cliff ) * ( 1.0 - sand );
            float grass = max( 0.0, 1.0 - cliff - sand - dirt );
            return vec4( grass, dirt, sand, cliff ) / max( 1e-4, grass + dirt + sand + cliff );
          }

          // Flat materials project down the Y axis; the cliff set is projected
          // sideways so vertical faces keep their detail instead of streaking.
          vec2 flatUv( float scale )  { return vWorldPos.xz * scale; }
          vec2 cliffUv( float scale ) { return vec2( vWorldPos.x + vWorldPos.z, vWorldPos.y ) * scale; }
          `,
        )
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
          vec4 w = splatWeights();
          vec3 albedo =
              texture2D( map,          flatUv( uScale.x ) ).rgb * w.x
            + texture2D( uDirtAlbedo,  flatUv( uScale.y ) ).rgb * w.y
            + texture2D( uSandAlbedo,  flatUv( uScale.z ) ).rgb * w.z
            + texture2D( uCliffAlbedo, cliffUv( uScale.w ) ).rgb * w.w;
          diffuseColor.rgb *= albedo;
          `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          /* glsl */ `
          float roughnessFactor = roughness * mix( 1.0,
              texture2D( roughnessMap, flatUv( uScale.x ) ).g * w.x
            + texture2D( uDirtArm,     flatUv( uScale.y ) ).g * w.y
            + 0.95 * w.z
            + 0.85 * w.w, 1.0 );
          `,
        )
        .replace(
          '#include <normal_fragment_maps>',
          /* glsl */ `
          vec3 mapN =
              ( texture2D( normalMap,    flatUv( uScale.x ) ).xyz * 2.0 - 1.0 ) * w.x
            + ( texture2D( uDirtNormal,  flatUv( uScale.y ) ).xyz * 2.0 - 1.0 ) * w.y
            + ( texture2D( uSandNormal,  flatUv( uScale.z ) ).xyz * 2.0 - 1.0 ) * w.z
            + ( texture2D( uCliffNormal, cliffUv( uScale.w ) ).xyz * 2.0 - 1.0 ) * w.w;
          mapN.xy *= normalScale;
          normal = normalize( tbn * mapN );
          `,
        )
        .replace(
          '#include <aomap_fragment>',
          /* glsl */ `
          float ambientOcclusion = mix( 1.0,
              texture2D( aoMap,      flatUv( uScale.x ) ).r * w.x
            + texture2D( uDirtArm,   flatUv( uScale.y ) ).r * w.y
            + w.z + w.w, aoMapIntensity );
          reflectedLight.indirectDiffuse *= ambientOcclusion;
          #if defined( USE_ENVMAP ) && defined( STANDARD )
            float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
            reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
          #endif
          `,
        )
    }

    // Distinct key so three doesn't reuse a stock MeshStandardMaterial program.
    this.customProgramCacheKey = () => 'terrain-splat-v1'
  }
}
