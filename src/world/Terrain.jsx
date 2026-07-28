import { useMemo } from 'react'
import { PlaneGeometry, BufferAttribute } from 'three'
import { island } from '../data/world.js'
import { terrainHeight, pathWeight } from './heightfield.js'
import { useTextureSet } from './assets.js'
import TerrainMaterial from './TerrainMaterial.js'

/**
 * Builds the island mesh by displacing a grid with `terrainHeight()`.
 *
 * The same grid is handed to Rapier in Phase 2 as a heightfield collider, so
 * what you see is exactly what you walk on.
 */
export function useTerrainGeometry() {
  return useMemo(() => {
    const { radius, segments } = island
    const size = radius * 2
    const geometry = new PlaneGeometry(size, size, segments, segments)
    geometry.rotateX(-Math.PI / 2) // lie flat, so XZ is world XZ

    const position = geometry.attributes.position
    const path = new Float32Array(position.count)

    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i)
      const z = position.getZ(i)
      position.setY(i, terrainHeight(x, z))
      path[i] = pathWeight(x, z)
    }

    geometry.setAttribute('aPath', new BufferAttribute(path, 1))
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
    return geometry
  }, [])
}

export default function Terrain() {
  const geometry = useTerrainGeometry()

  const grass = useTextureSet('grass')
  const dirt = useTextureSet('dirt')
  const sand = useTextureSet('sand', ['albedo', 'normal'])
  const cliff = useTextureSet('cliff', ['albedo', 'normal'])

  const material = useMemo(
    () => new TerrainMaterial({ grass, dirt, sand, cliff, seaLevel: island.seaLevel }),
    [grass, dirt, sand, cliff],
  )

  return <mesh geometry={geometry} material={material} receiveShadow castShadow />
}
