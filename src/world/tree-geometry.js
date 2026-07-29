import { CylinderGeometry, BufferGeometry, BufferAttribute, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { makeRandom } from './heightfield.js'

/**
 * Builds a tree as two pieces of geometry — a trunk and a canopy of leaf cards
 * — both instanceable, so an entire forest costs two draw calls.
 *
 * The canopy is the interesting part. Each card's vertex normals point away
 * from the canopy centre rather than along the card, which is the standard
 * game-foliage trick: it makes a flat billboard shade like a rounded volume,
 * so the tree catches the low sun on one side and stays soft on the other.
 */

const UP = new Vector3(0, 1, 0)
const SIDE = new Vector3(1, 0, 0)

function trunkGeometry(random, { height, radius, bend, branches }) {
  const parts = []

  const trunk = new CylinderGeometry(radius * 0.42, radius, height, 7, 5, false)
  trunk.translate(0, height / 2, 0)
  parts.push(trunk)

  for (let i = 0; i < branches; i++) {
    const t = 0.5 + (i / Math.max(1, branches)) * 0.28
    // Short enough to stay inside the canopy — a branch poking out the far
    // side of the leaves reads as a spike, not a limb.
    const len = height * (0.2 + random() * 0.14)
    const branch = new CylinderGeometry(radius * 0.12, radius * 0.32, len, 5, 2, false)
    branch.translate(0, len / 2, 0)
    branch.rotateZ((0.55 + random() * 0.4) * (random() > 0.5 ? 1 : -1))
    branch.rotateY(random() * Math.PI * 2)
    branch.translate(0, height * t, 0)
    parts.push(branch)
  }

  const geometry = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())

  // Lean the whole trunk along a gentle arc so it isn't a telegraph pole.
  const position = geometry.attributes.position
  const dir = random() * Math.PI * 2
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    const t = Math.max(0, y / height)
    const offset = bend * t * t
    position.setX(i, position.getX(i) + Math.cos(dir) * offset)
    position.setZ(i, position.getZ(i) + Math.sin(dir) * offset)
  }
  geometry.computeVertexNormals()

  // Bark tiles vertically; stretch V so it doesn't smear on tall trunks.
  const uv = geometry.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * height * 0.42)

  return { geometry, bendDir: dir }
}

function canopyGeometry(random, { cards, centerY, radiusXZ, radiusY, cardSize, lobes = 5, atlas = 2 }) {
  const positions = []
  const normals = []
  const uvs = []
  const sway = [] // 0 at the trunk, 1 at the canopy edge — drives the wind
  const indices = []

  const outward = new Vector3()
  const facing = new Vector3()
  const scratch = new Vector3()
  const tangentU = new Vector3()
  const tangentV = new Vector3()

  /**
   * Clusters of foliage rather than one smooth ellipsoid. A single shell reads
   * as a lollipop from any distance; a handful of overlapping lobes gives the
   * broken, clumpy silhouette real crowns have.
   */
  const clusters = []
  for (let l = 0; l < lobes; l++) {
    const theta = random() * Math.PI * 2
    const phi = Math.acos(1 - random() * 1.25) // biased toward the top
    const spread = 0.3 + random() * 0.45
    clusters.push({
      x: Math.sin(phi) * Math.cos(theta) * radiusXZ * spread,
      y: Math.cos(phi) * radiusY * spread,
      z: Math.sin(phi) * Math.sin(theta) * radiusXZ * spread,
      radius: 0.42 + random() * 0.3,
    })
  }

  for (let i = 0; i < cards; i++) {
    const lobe = clusters[Math.floor(random() * clusters.length)]

    // Bias the distribution upward: canopies are fuller on top than beneath.
    const theta = random() * Math.PI * 2
    const phi = Math.acos(1 - random() * 1.55)
    const shell = 0.35 + random() * 0.65

    outward
      .set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta))
      .normalize()

    const cx = lobe.x + outward.x * radiusXZ * lobe.radius * shell
    const cy = centerY + lobe.y + outward.y * radiusY * lobe.radius * shell
    const cz = lobe.z + outward.z * radiusXZ * lobe.radius * shell

    // Shade against the whole crown, not the lobe: normals pointing away from
    // the tree's centre are what make flat cards read as one rounded volume.
    outward.set(cx, cy - centerY, cz).normalize()

    // Cards all facing exactly outward means every card on the silhouette is
    // seen exactly edge-on, which draws a thin dark sliver at the crown's rim.
    // Tilting each one off-axis breaks that up and looks more like real
    // foliage; the shading normal stays on `outward`.
    facing
      .copy(outward)
      .addScaledVector(
        scratch.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize(),
        0.55,
      )
      .normalize()

    // Build an orthonormal frame around the outward direction, then roll it.
    tangentU.crossVectors(facing, Math.abs(facing.y) > 0.95 ? SIDE : UP).normalize()
    tangentV.crossVectors(facing, tangentU).normalize()
    const roll = random() * Math.PI * 2
    const cos = Math.cos(roll)
    const sin = Math.sin(roll)
    const ax = tangentU.clone().multiplyScalar(cos).addScaledVector(tangentV, sin)
    const ay = tangentU.clone().multiplyScalar(-sin).addScaledVector(tangentV, cos)

    const size = cardSize * (0.72 + random() * 0.6)
    const half = size / 2
    const base = positions.length / 3

    // One of the four cluster tiles in the atlas.
    const tile = Math.floor(random() * atlas * atlas)
    const u0 = (tile % atlas) / atlas
    const v0 = Math.floor(tile / atlas) / atlas
    const step = 1 / atlas

    const corners = [
      [-half, -half, u0, v0],
      [half, -half, u0 + step, v0],
      [half, half, u0 + step, v0 + step],
      [-half, half, u0, v0 + step],
    ]

    for (const [ox, oy, u, v] of corners) {
      positions.push(cx + ax.x * ox + ay.x * oy, cy + ax.y * ox + ay.y * oy, cz + ax.z * ox + ay.z * oy)
      // Spherical normal — the volumetric-shading trick.
      normals.push(outward.x, outward.y, outward.z)
      uvs.push(u, v)
      sway.push(shell)
    }

    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(normals), 3))
  geometry.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  geometry.setAttribute('aSway', new BufferAttribute(new Float32Array(sway), 1))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

/** One tree variant: matching trunk + canopy, both centred on the origin. */
export function makeTree(seed, { tall = false } = {}) {
  const random = makeRandom(seed)
  const height = (tall ? 6.2 : 4.2) + random() * 1.8
  const radius = (tall ? 0.4 : 0.36) + random() * 0.1

  const { geometry: trunk, bendDir } = trunkGeometry(random, {
    height,
    radius,
    bend: 0.32 + random() * 0.4,
    branches: 4 + Math.floor(random() * 3),
  })

  // The canopy sits low enough to swallow the top of the trunk — a canopy
  // perched above bare wood is what makes procedural trees read as lollipops.
  //
  // Many small cards rather than few large ones: the atlas holds ~150 leaves
  // per tile, so a card about a metre across renders leaves at roughly 12cm.
  // At the old 2m cards each leaf was 40cm and the tree looked like a
  // houseplant photographed from the wrong distance.
  const canopy = canopyGeometry(random, {
    cards: tall ? 265 : 235,
    centerY: height * 0.74,
    radiusXZ: (tall ? 2.7 : 3.1) + random() * 0.7,
    radiusY: (tall ? 2.6 : 2.0) + random() * 0.5,
    cardSize: 1.12 + random() * 0.35,
    lobes: 4 + Math.floor(random() * 3),
  })
  // Sit the canopy over the leaning trunk's tip.
  const lean = 0.32 + random() * 0.4
  canopy.translate(Math.cos(bendDir) * lean, 0, Math.sin(bendDir) * lean)

  return { trunk, canopy, height }
}
