#!/usr/bin/env node
/**
 * Bakes a leaf-cluster atlas from Poly Haven's individual-leaf scan.
 *
 *   node scripts/make-foliage-atlas.mjs
 *
 * The source (island_tree_01's leaf map) is eight loose leaves — far too fine
 * a unit to build a canopy from, since filling a tree would take thousands of
 * quads. So we cut the leaves out, then composite dozens of them, randomly
 * rotated and scaled, into four dense cluster tiles. The canopy in Foliage.jsx
 * then needs ~50 cards per tree instead of ~3000, which is what makes an
 * instanced forest affordable.
 *
 * Output: public/textures/canopy.webp (2x2 atlas, RGBA)
 */
import sharp from 'sharp'
import path from 'node:path'
import { mkdir } from 'node:fs/promises'

const ROOT = path.resolve(import.meta.dirname, '..')
const RAW = path.join(ROOT, 'raw', 'textures')
const OUT = path.join(ROOT, 'public', 'textures', 'canopy.webp')

const TILE = 640 // px per cluster
const GRID = 2 // 2x2 = 4 distinct clusters
const LEAVES_PER_TILE = 150

// Deterministic PRNG — the atlas must be identical on every rebuild.
let seed = 20260728
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}
const between = (a, b) => a + (b - a) * rand()

/** Column/row scan of the alpha mask to find each leaf's bounding box. */
function findLeaves(mask, width, height) {
  const solid = (x, y) => mask[y * width + x] > 40

  // Split into horizontal bands of content, then vertical runs within each.
  const bands = []
  let start = -1
  for (let y = 0; y < height; y++) {
    let any = false
    for (let x = 0; x < width && !any; x++) if (solid(x, y)) any = true
    if (any && start < 0) start = y
    if (!any && start >= 0) {
      if (y - start > height * 0.04) bands.push([start, y])
      start = -1
    }
  }
  if (start >= 0) bands.push([start, height])

  const boxes = []
  for (const [y0, y1] of bands) {
    let runStart = -1
    for (let x = 0; x <= width; x++) {
      let any = false
      for (let y = y0; y < y1 && !any; y++) if (x < width && solid(x, y)) any = true
      if (any && runStart < 0) runStart = x
      if (!any && runStart >= 0) {
        if (x - runStart > width * 0.03) boxes.push({ left: runStart, top: y0, width: x - runStart, height: y1 - y0 })
        runStart = -1
      }
    }
  }
  return boxes
}

const canopy = async () => {
  const diffuse = sharp(path.join(RAW, 'island_tree_01_leaves_diff.png'))
  const alpha = sharp(path.join(RAW, 'island_tree_01_leaves_alpha.png'))

  const meta = await diffuse.metadata()
  const { width, height } = meta

  const maskRaw = await alpha
    .clone()
    .resize(width, height, { fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer()

  const boxes = findLeaves(maskRaw, width, height)
  if (!boxes.length) throw new Error('no leaves found in the alpha mask')
  console.log(`found ${boxes.length} leaves in ${width}x${height}`)

  // Premultiply the cutout: RGB from the diffuse, A from the mask.
  const rgba = await diffuse
    .clone()
    .ensureAlpha()
    .joinChannel(await alpha.clone().resize(width, height, { fit: 'fill' }).greyscale().toBuffer())
    .png()
    .toBuffer()

  // Cut every leaf out once, then reuse the cutouts across all tiles.
  const cutouts = await Promise.all(
    boxes.map((box) => sharp(rgba).extract(box).png().toBuffer()),
  )

  const layers = []
  for (let ty = 0; ty < GRID; ty++) {
    for (let tx = 0; tx < GRID; tx++) {
      for (let i = 0; i < LEAVES_PER_TILE; i++) {
        const src = cutouts[Math.floor(rand() * cutouts.length)]
        // Small relative to the tile: a canopy card is roughly a metre across
        // in world space, so a leaf occupying a third of it renders 30cm wide
        // and the tree reads as a houseplant. Real leaves are 5-15cm.
        const size = Math.round(between(TILE * 0.1, TILE * 0.21))

        const leaf = await sharp(src)
          .rotate(Math.round(between(0, 360)), { background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .resize(size, size, { fit: 'inside' })
          // Vary tone so the cluster doesn't read as one repeated stamp.
          .modulate({ brightness: between(0.78, 1.18), saturation: between(0.75, 1.15) })
          .png()
          .toBuffer()

        const { width: lw, height: lh } = await sharp(leaf).metadata()

        // Bias toward the tile centre so cluster edges stay soft and organic.
        const cx = TILE * 0.5 + between(-TILE * 0.36, TILE * 0.36)
        const cy = TILE * 0.5 + between(-TILE * 0.36, TILE * 0.36)
        const left = Math.round(tx * TILE + cx - lw / 2)
        const top = Math.round(ty * TILE + cy - lh / 2)

        // Clamp so sharp never composites outside the canvas.
        if (left < 0 || top < 0 || left + lw > TILE * GRID || top + lh > TILE * GRID) continue
        layers.push({ input: leaf, left, top })
      }
    }
  }

  await mkdir(path.dirname(OUT), { recursive: true })
  await sharp({
    create: {
      width: TILE * GRID,
      height: TILE * GRID,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .webp({ quality: 88, alphaQuality: 100 })
    .toFile(OUT)

  console.log(`wrote ${path.relative(ROOT, OUT)} (${layers.length} leaves, ${GRID}x${GRID} clusters)`)
}

await canopy()
