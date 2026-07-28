import { useMemo } from 'react'
import { useTexture, useGLTF } from '@react-three/drei'
import { RepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace } from 'three'

/** Draco decoder is self-hosted so nothing depends on a third-party CDN. */
export const DRACO_PATH = '/draco/'

export const MODELS = {
  rocks: '/models/rocks.glb',
  grassTuft: '/models/grass-tuft.glb',
  fern: '/models/fern.glb',
  bush: '/models/bush.glb',
  stump: '/models/stump.glb',
  lantern: '/models/lantern.glb',
}

export const useModel = (url) => useGLTF(url, DRACO_PATH)

Object.values(MODELS).forEach((url) => useGLTF.preload(url, DRACO_PATH))

/**
 * Loads a Poly Haven texture set and applies the right colour space to each
 * map — albedo is sRGB, everything else is raw data. Getting this wrong is the
 * usual cause of a washed-out or oddly-lit scene.
 */
export function useTextureSet(name, maps = ['albedo', 'normal', 'arm'], repeat = 1) {
  const paths = useMemo(
    () => Object.fromEntries(maps.map((m) => [m, `/textures/${name}_${m}.webp`])),
    [name, maps.join()],
  )
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
