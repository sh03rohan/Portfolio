import { useMemo } from 'react'
import { MeshStandardMaterial, BufferGeometry, BufferAttribute, Color, DoubleSide } from 'three'
import { zones } from '../data/world.js'
import { terrainHeight } from './heightfield.js'
import { useTextureSet } from './assets.js'

/**
 * The four buildings the content lives in.
 *
 * These are built from primitives rather than downloaded, for two reasons: the
 * CC0 libraries have no cabins or mailboxes that match this art direction, and
 * dropping low-poly cartoon buildings into a world of photoscanned nature
 * would look worse than either alone. Dressed in the same Poly Haven PBR wood
 * and clay-tile textures as everything else they sit in the world
 * consistently — and they add nothing to the download.
 */

function useBuildMaterials() {
  const wood = useTextureSet('wood')
  const roof = useTextureSet('roof')

  return useMemo(() => {
    const make = (set, color, rest = {}) =>
      new MeshStandardMaterial({
        map: set.albedo,
        normalMap: set.normal,
        roughnessMap: set.arm,
        aoMap: set.arm,
        roughness: 1,
        metalness: 0,
        color: new Color(color),
        ...rest,
      })

    return {
      plank: make(wood, '#9d7a54'),
      plankDark: make(wood, '#5f4630'),
      beam: make(wood, '#6d5238'),
      tile: make(roof, '#b06a52'),
      // Warm enough to read as lamplight, dim enough that bloom doesn't turn
      // the windows into two white squares.
      glow: new MeshStandardMaterial({
        color: '#e8bd86',
        emissive: new Color('#ff9d4d'),
        emissiveIntensity: 0.65,
        roughness: 0.35,
      }),
    }
  }, [wood, roof])
}

/** Flat triangle used to close the ends of a gabled roof. */
function useGableGeometry(width, height) {
  return useMemo(() => {
    const hw = width / 2
    const geometry = new BufferGeometry()
    geometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-hw, 0, 0, hw, 0, 0, 0, height, 0]), 3),
    )
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 0.5, 1]), 2))
    geometry.computeVertexNormals()
    return geometry
  }, [width, height])
}

/** Two pitched slabs meeting at a ridge, closed at both ends. */
function GableRoof({ width, depth, height, material, endMaterial, overhang = 0.35 }) {
  const w = width / 2 + overhang
  const d = depth / 2 + overhang
  const pitch = Math.atan2(height, w)
  const slope = Math.hypot(w, height)
  const gable = useGableGeometry(width, height)

  return (
    <group>
      {[1, -1].map((side) => (
        <mesh
          key={side}
          castShadow
          receiveShadow
          material={material}
          position={[(side * w) / 2, height / 2, 0]}
          rotation={[0, 0, -side * (Math.PI / 2 - pitch)]}
        >
          <boxGeometry args={[slope, 0.12, d * 2]} />
        </mesh>
      ))}
      {[1, -1].map((side) => (
        <mesh
          key={`end${side}`}
          castShadow
          receiveShadow
          geometry={gable}
          material={endMaterial}
          position={[0, 0, (side * depth) / 2]}
          rotation={[0, side > 0 ? 0 : Math.PI, 0]}
        />
      ))}
    </group>
  )
}

/** About — a small cabin with lit windows. */
function House({ materials: m }) {
  return (
    <group>
      <mesh castShadow receiveShadow material={m.plankDark} position={[0, 0.2, 0]}>
        <boxGeometry args={[4.6, 0.4, 3.8]} />
      </mesh>
      <mesh castShadow receiveShadow material={m.plank} position={[0, 1.6, 0]}>
        <boxGeometry args={[4.2, 2.4, 3.4]} />
      </mesh>
      <mesh castShadow material={m.plankDark} position={[0, 1.25, 1.73]}>
        <boxGeometry args={[0.9, 1.7, 0.12]} />
      </mesh>
      {[-1.3, 1.3].map((x) => (
        <mesh key={x} material={m.glow} position={[x, 2.05, 1.73]}>
          <boxGeometry args={[0.8, 0.7, 0.1]} />
        </mesh>
      ))}
      <group position={[0, 2.8, 0]}>
        <GableRoof width={4.2} depth={3.4} height={1.5} material={m.tile} endMaterial={m.plank} />
      </group>
      <mesh castShadow receiveShadow material={m.plankDark} position={[1.5, 3.9, -0.9]}>
        <boxGeometry args={[0.5, 1.6, 0.5]} />
      </mesh>
    </group>
  )
}

/** Work — an open-fronted workshop with a lean-to roof. */
function Workshop({ materials: m }) {
  return (
    <group>
      <mesh castShadow receiveShadow material={m.plankDark} position={[0, 0.2, 0]}>
        <boxGeometry args={[5.4, 0.4, 4.2]} />
      </mesh>
      <mesh castShadow receiveShadow material={m.plank} position={[0, 1.7, -1.9]}>
        <boxGeometry args={[5, 2.6, 0.25]} />
      </mesh>
      {[-2.4, 2.4].map((x) => (
        <mesh key={x} castShadow receiveShadow material={m.plank} position={[x, 1.7, 0]}>
          <boxGeometry args={[0.25, 2.6, 3.8]} />
        </mesh>
      ))}
      {[-2.3, 2.3].map((x) => (
        <mesh key={`post${x}`} castShadow receiveShadow material={m.beam} position={[x, 1.7, 1.85]}>
          <boxGeometry args={[0.28, 2.6, 0.28]} />
        </mesh>
      ))}
      <mesh castShadow receiveShadow material={m.tile} position={[0, 3.35, 0.1]} rotation={[-0.26, 0, 0]}>
        <boxGeometry args={[6, 0.16, 5]} />
      </mesh>

      <mesh castShadow receiveShadow material={m.beam} position={[0, 1, -1.3]}>
        <boxGeometry args={[3, 0.16, 0.8]} />
      </mesh>
      {[-1.3, 1.3].map((x) => (
        <mesh key={`leg${x}`} castShadow material={m.beam} position={[x, 0.55, -1.3]}>
          <boxGeometry args={[0.14, 0.9, 0.14]} />
        </mesh>
      ))}
      <mesh castShadow receiveShadow material={m.plankDark} position={[1.6, 0.75, 1]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.7, 0.7, 0.7]} />
      </mesh>
      <mesh castShadow receiveShadow material={m.plankDark} position={[1.75, 1.4, 0.85]} rotation={[0, -0.2, 0]}>
        <boxGeometry args={[0.55, 0.55, 0.55]} />
      </mesh>
    </group>
  )
}

/** Experience — a fingerpost, one arm per role. */
function Signpost({ materials: m, accent }) {
  const accentMaterial = useMemo(
    () => new MeshStandardMaterial({ color: new Color(accent), roughness: 0.3, metalness: 0.6 }),
    [accent],
  )
  const arms = [
    { y: 2.5, rot: 0.2, len: 1.9 },
    { y: 2.0, rot: 2.4, len: 1.6 },
    { y: 1.5, rot: 4.1, len: 1.75 },
  ]

  return (
    <group>
      <mesh castShadow receiveShadow material={m.plankDark} position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.6, 0.75, 0.5, 10]} />
      </mesh>
      <mesh castShadow receiveShadow material={m.beam} position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.13, 0.17, 3.2, 8]} />
      </mesh>
      {arms.map(({ y, rot, len }) => (
        <group key={y} rotation={[0, rot, 0]}>
          <mesh castShadow receiveShadow material={m.plank} position={[len / 2, y, 0]}>
            <boxGeometry args={[len, 0.34, 0.1]} />
          </mesh>
        </group>
      ))}
      <mesh castShadow material={accentMaterial} position={[0, 3.35, 0]}>
        <sphereGeometry args={[0.19, 12, 10]} />
      </mesh>
    </group>
  )
}

/** Contact — a mailbox on a post, flag up. */
function Mailbox({ materials: m, accent }) {
  const shell = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(accent),
        roughness: 0.45,
        metalness: 0.35,
        side: DoubleSide,
      }),
    [accent],
  )
  const flag = useMemo(() => new MeshStandardMaterial({ color: '#e8534b', roughness: 0.5 }), [])

  return (
    <group>
      <mesh castShadow receiveShadow material={m.beam} position={[0, 0.65, 0]}>
        <boxGeometry args={[0.2, 1.3, 0.2]} />
      </mesh>
      <mesh castShadow receiveShadow material={shell} position={[0, 1.5, 0]}>
        <boxGeometry args={[0.62, 0.42, 1.0]} />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        material={shell}
        position={[0, 1.71, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.31, 0.31, 1.0, 14, 1, false, 0, Math.PI]} />
      </mesh>
      <mesh castShadow material={m.plankDark} position={[0.36, 1.85, -0.2]}>
        <boxGeometry args={[0.05, 0.55, 0.05]} />
      </mesh>
      <mesh castShadow material={flag} position={[0.45, 2.02, -0.2]}>
        <boxGeometry args={[0.22, 0.28, 0.03]} />
      </mesh>
    </group>
  )
}

const BUILDERS = { house: House, workshop: Workshop, signpost: Signpost, mailbox: Mailbox }

export default function Structures() {
  const materials = useBuildMaterials()

  return (
    <group>
      {zones.map((zone) => {
        const Build = BUILDERS[zone.structure]
        if (!Build) return null
        const [x, , z] = zone.position
        return (
          <group
            key={zone.id}
            position={[x, terrainHeight(x, z), z]}
            rotation={[0, zone.rotation, 0]}
          >
            <Build materials={materials} accent={zone.accent} />
          </group>
        )
      })}
    </group>
  )
}
