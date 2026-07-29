import { useMemo } from 'react'
import { useTexture, useGLTF, useEnvironment } from '@react-three/drei'
import { RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace } from 'three'

/**
 * Every asset the world loads, declared in one place and fetched in one wave.
 *
 * This matters for more than tidiness. `useProgress` reports 0-100% across
 * whatever is in flight *right now*, so anything that starts loading later —
 * a texture set requested when Terrain first renders, the character glTF, the
 * HDRI — begins a fresh 0-100% cycle and the loading bar fills again. Kicking
 * all of it off at module scope, before React even mounts, makes it a single
 * pass.
 */

/** Draco decoder is self-hosted so nothing depends on a third-party CDN. */
export const DRACO_PATH = '/draco/'

export const MODELS = {
  rocks: '/models/rocks.glb',
  grassTuft: '/models/grass-tuft.glb',
  fern: '/models/fern.glb',
  bush: '/models/bush.glb',
  stump: '/models/stump.glb',
  lantern: '/models/lantern.glb',
  character: '/models/character.glb',
}

/** Which maps each Poly Haven texture set actually shipped with. */
export const TEXTURE_SETS = {
  grass: ['albedo', 'normal', 'arm'],
  dirt: ['albedo', 'normal', 'arm'],
  sand: ['albedo', 'normal'],
  cliff: ['albedo', 'normal'],
  wood: ['albedo', 'normal', 'arm'],
  roof: ['albedo', 'normal', 'arm'],
  bark: ['albedo', 'normal', 'arm'],
}

/** Baked leaf-cluster atlas, used directly rather than as a set. */
export const CANOPY_TEXTURE = '/textures/canopy.webp'

/** Sunset HDRI — image-based lighting only; the visible sky is a shader. */
export const HDRI = '/hdri/sunset.hdr'

const textureUrl = (name, map) => `/textures/${name}_${map}.webp`

/** Flat list of every texture URL, so preload and use can't drift apart. */
export const TEXTURE_URLS = [
  ...Object.entries(TEXTURE_SETS).flatMap(([name, maps]) =>
    maps.map((map) => textureUrl(name, map)),
  ),
  CANOPY_TEXTURE,
]

export const useModel = (url) => useGLTF(url, DRACO_PATH)

// --- the single load wave ---------------------------------------------------
Object.values(MODELS).forEach((url) => useGLTF.preload(url, DRACO_PATH))
useTexture.preload(TEXTURE_URLS)
useEnvironment.preload({ files: HDRI })

/**
 * Loads a Poly Haven texture set and applies the right colour space to each
 * map — albedo is sRGB, everything else is raw data. Getting this wrong is the
 * usual cause of a washed-out or oddly-lit scene.
 *
 * The map list comes from TEXTURE_SETS so the URLs match what was preloaded;
 * a mismatched path would quietly become a second load wave.
 */
export function useTextureSet(name, repeat = 1) {
  const paths = useMemo(() => {
    const maps = TEXTURE_SETS[name]
    if (!maps) throw new Error(`Unknown texture set "${name}" — add it to TEXTURE_SETS`)
    return Object.fromEntries(maps.map((map) => [map, textureUrl(name, map)]))
  }, [name])

  const set = useTexture(paths)

  return useMemo(() => {
    for (const [map, texture] of Object.entries(set)) {
      texture.wrapS = texture.wrapT = RepeatWrapping
      texture.colorSpace = map === 'albedo' ? SRGBColorSpace : LinearSRGBColorSpace
      texture.anisotropy = 8
      if (repeat !== 1) texture.repeat.set(repeat, repeat)
      texture.needsUpdate = true
    }
    return set
  }, [set, repeat])
}
