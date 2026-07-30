import { island, zones, pathNodes, pathWidth } from '../data/world.js'

/**
 * The island's shape, as a pure function of (x, z).
 *
 * This is the single source of truth for terrain: the visual mesh, the Rapier
 * collider and every scattered prop all sample `terrainHeight()`, so nothing
 * can float, sink or fall through the floor.
 */

// ---------------------------------------------------------------- noise -----

/** Deterministic 2D hash — same result every load, no seeding ceremony. */
function hash(ix, iz) {
  let h = ix * 374761393 + iz * 668265263
  h = (h ^ (h >> 13)) * 1274126177
  return ((h ^ (h >> 16)) >>> 0) / 4294967295
}

const fade = (t) => t * t * (3 - 2 * t)
const lerp = (a, b, t) => a + (b - a) * t

function valueNoise(x, z) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = fade(x - ix)
  const fz = fade(z - iz)
  return lerp(
    lerp(hash(ix, iz), hash(ix + 1, iz), fx),
    lerp(hash(ix, iz + 1), hash(ix + 1, iz + 1), fx),
    fz,
  )
}

/** Fractal brownian motion — layered noise, returns roughly 0..1. */
export function fbm(x, z, octaves = 4) {
  let value = 0
  let amp = 0.5
  let total = 0
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x, z) * amp
    total += amp
    x *= 2.03
    z *= 2.03
    amp *= 0.5
  }
  return value / total
}

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

// ------------------------------------------------------------ path helpers --

/** Shortest distance from (x, z) to the closed loop through `pathNodes`. */
export function distanceToPath(x, z) {
  let best = Infinity
  for (let i = 0; i < pathNodes.length; i++) {
    const [ax, az] = pathNodes[i]
    const [bx, bz] = pathNodes[(i + 1) % pathNodes.length]
    const dx = bx - ax
    const dz = bz - az
    const lenSq = dx * dx + dz * dz || 1
    let t = ((x - ax) * dx + (z - az) * dz) / lenSq
    t = Math.min(1, Math.max(0, t))
    const px = ax + dx * t - x
    const pz = az + dz * t - z
    const d = Math.sqrt(px * px + pz * pz)
    if (d < best) best = d
  }
  return best
}

/** 1 on the trodden path, 0 off it, soft edges. */
export const pathWeight = (x, z) =>
  1 - smoothstep(pathWidth * 0.55, pathWidth * 1.5, distanceToPath(x, z))

// ------------------------------------------------------------- the island ---

const { radius, shoreRadius, seaLevel } = island

/** Raw landform before flattening — rolling hills inside a wobbly coastline. */
function baseHeight(x, z) {
  const dist = Math.hypot(x, z)

  // Wobble the coastline so the island doesn't read as a disc.
  const coast = shoreRadius * (0.86 + 0.3 * fbm(x * 0.022 + 11.3, z * 0.022 + 4.7, 2))
  const land = 1 - smoothstep(coast * 0.78, coast, dist)

  // A gentle dome keeps the middle above water and the edges beachy.
  const dome = 3.2 * Math.cos(Math.min(1, dist / radius) * Math.PI * 0.5)

  const hills = (fbm(x * 0.032 + 3.1, z * 0.032 + 8.6, 4) - 0.5) * 11
  const detail = (fbm(x * 0.14 + 21.7, z * 0.14 + 2.9, 3) - 0.5) * 1.5

  // Off the shelf the ground drops away steeply into the sea.
  const shelf = -18 * smoothstep(coast, coast * 1.22, dist)

  const h = (dome + hills + detail) * land + shelf + 1.6

  // Keep the interior above the waterline — dips in the noise would otherwise
  // punch inland lakes through the island. The lift fades out with the land
  // mask, so the shore still descends into the sea normally.
  const floor = seaLevel + 1.5
  return Math.max(h, lerp(h, floor, land))
}

/**
 * Flatten a disc of terrain toward the height at its centre — used to give the
 * zone structures and the connecting path something level to sit on.
 */
function flattenTowards(x, z, height, cx, cz, inner, outer) {
  const d = Math.hypot(x - cx, z - cz)
  if (d > outer) return height
  const w = 1 - smoothstep(inner, outer, d)
  return lerp(height, baseHeight(cx, cz), w)
}

/** Final terrain height at a world XZ position. */
export function terrainHeight(x, z) {
  let h = baseHeight(x, z)

  // Level pads under each structure.
  for (const zone of zones) {
    const [cx, , cz] = zone.position
    h = flattenTowards(x, z, h, cx, cz, zone.radius * 0.75, zone.radius * 2.1)
  }

  // Ease the path into the hillside so it reads as a worn trail.
  const p = pathWeight(x, z)
  if (p > 0.001) {
    const smoothed =
      (baseHeight(x + 3, z) + baseHeight(x - 3, z) + baseHeight(x, z + 3) + baseHeight(x, z - 3)) / 4
    h = lerp(h, smoothed - 0.14, p * 0.75)
  }

  return h
}

/** Surface normal, sampled by finite difference. Used to reject steep spots. */
export function terrainNormal(x, z, eps = 0.6) {
  const hL = terrainHeight(x - eps, z)
  const hR = terrainHeight(x + eps, z)
  const hD = terrainHeight(x, z - eps)
  const hU = terrainHeight(x, z + eps)
  const nx = hL - hR
  const nz = hD - hU
  const ny = 2 * eps
  const len = Math.hypot(nx, ny, nz)
  return [nx / len, ny / len, nz / len]
}

/** 0 = flat, 1 = vertical. */
export const terrainSlope = (x, z) => 1 - terrainNormal(x, z)[1]

/** True where a prop can plausibly stand: above the tide, not on a cliff. */
export function isPlantable(x, z, { minHeight = seaLevel + 1.1, maxSlope = 0.32 } = {}) {
  const h = terrainHeight(x, z)
  if (h < minHeight) return false
  if (Math.hypot(x, z) > shoreRadius * 1.02) return false
  return terrainSlope(x, z) <= maxSlope
}

/**
 * What you're standing on, as the four splat weights the ground is painted with.
 *
 * This is deliberately the same arithmetic as `splatWeights()` in
 * TerrainMaterial.js — footsteps that disagree with what's visibly under the
 * character are worse than no footsteps at all, so the audio reads the surface
 * from the same rule the renderer does rather than from its own guess.
 *
 * Keep the two in step: if the thresholds there change, change them here.
 */
export function surfaceWeights(x, z) {
  const slope = 1 - Math.min(1, Math.max(0, terrainNormal(x, z)[1]))
  const cliff = smoothstep(0.3, 0.62, slope)
  const sand = (1 - cliff) * (1 - smoothstep(seaLevel + 0.4, seaLevel + 2.6, terrainHeight(x, z)))
  const dirt = Math.min(1, Math.max(0, pathWeight(x, z))) * (1 - cliff) * (1 - sand)
  const grass = Math.max(0, 1 - cliff - sand - dirt)
  const total = Math.max(1e-4, grass + dirt + sand + cliff)
  return { grass: grass / total, dirt: dirt / total, sand: sand / total, cliff: cliff / total }
}

/** The dominant surface at a point: 'grass' | 'dirt' | 'sand' | 'cliff'. */
export function surfaceAt(x, z) {
  const w = surfaceWeights(x, z)
  let best = 'grass'
  for (const key of ['dirt', 'sand', 'cliff']) if (w[key] > w[best]) best = key
  return best
}

/** Deterministic PRNG so decor scatter is identical on every load. */
export function makeRandom(seed = 1) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}
