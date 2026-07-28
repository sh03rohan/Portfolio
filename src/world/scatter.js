import { zones, island } from '../data/world.js'
import { terrainHeight, isPlantable, pathWeight, makeRandom, fbm } from './heightfield.js'

/**
 * Places props on the island.
 *
 * Uses dart-throwing with a minimum spacing rather than a grid, so clusters
 * feel natural, and rejects anything on a cliff, below the tide, on the path,
 * or standing in a zone's clearing.
 */
export function scatter({
  count,
  seed = 1,
  minSpacing = 2.2,
  maxSlope = 0.32,
  clearPath = 1.6,
  clearZones = 1,
  minRadius = 0,
  maxRadius = island.shoreRadius,
  scale = [0.9, 1.2],
  sink = 0,
  // A low-frequency density field. Above 0 it carves the scatter into groves
  // and open meadows instead of spreading everything out like an orchard.
  clumping = 0,
  clumpScale = 0.055,
}) {
  const random = makeRandom(seed)
  const placed = []
  const spacingSq = minSpacing * minSpacing
  const attempts = count * 40

  for (let i = 0; i < attempts && placed.length < count; i++) {
    // Sample by area, not by radius, or everything bunches at the centre.
    const r = Math.sqrt(random()) * (maxRadius - minRadius) + minRadius
    const theta = random() * Math.PI * 2
    const x = Math.cos(theta) * r
    const z = Math.sin(theta) * r

    if (!isPlantable(x, z, { maxSlope })) continue
    if (clearPath && pathWeight(x, z) > 1 - clearPath * 0.5) continue

    if (clumping > 0) {
      const density = fbm(x * clumpScale + 57.3, z * clumpScale + 13.9, 3)
      if (random() > 1 - clumping + density * clumping * 2) continue
    }

    let blocked = false
    for (const zone of zones) {
      const [zx, , zz] = zone.position
      if (Math.hypot(x - zx, z - zz) < zone.radius * clearZones) {
        blocked = true
        break
      }
    }
    if (blocked) continue

    for (const p of placed) {
      const dx = p[0] - x
      const dz = p[2] - z
      if (dx * dx + dz * dz < spacingSq) {
        blocked = true
        break
      }
    }
    if (blocked) continue

    placed.push([
      x,
      terrainHeight(x, z) - sink,
      z,
      random() * Math.PI * 2, // yaw
      scale[0] + random() * (scale[1] - scale[0]),
    ])
  }

  return placed
}

/** Evenly spaced points along the path loop, for lanterns and fence posts. */
export function alongPath(nodes, spacing, offset = 0) {
  const points = []
  let carry = offset
  for (let i = 0; i < nodes.length; i++) {
    const [ax, az] = nodes[i]
    const [bx, bz] = nodes[(i + 1) % nodes.length]
    const len = Math.hypot(bx - ax, bz - az)
    for (let d = carry; d < len; d += spacing) {
      const t = d / len
      const x = ax + (bx - ax) * t
      const z = az + (bz - az) * t
      points.push([x, terrainHeight(x, z), z, Math.atan2(bx - ax, bz - az)])
    }
    carry = (carry - len) % spacing
    if (carry < 0) carry += spacing
  }
  return points
}
