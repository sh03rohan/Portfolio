import { scatter } from './scatter.js'

/**
 * Where the forest stands.
 *
 * Split out of Foliage.jsx because the fireflies need the *same* trees the
 * renderer drew — clustering them on an independently scattered set would put
 * half the swarm in open grass, which is exactly the tell that they were
 * sprinkled over the island rather than living in it.
 *
 * Wide, overlapping scale ranges are what stop an instanced forest reading as
 * an orchard — the same trunk at 0.6x and 1.5x looks like two different trees.
 */
export const TREE_VARIANTS = [
  { seed: 11, tall: false, count: 24, spacing: 7.0, scale: [0.75, 1.45] },
  { seed: 47, tall: true, count: 16, spacing: 8.4, scale: [0.7, 1.3] },
  { seed: 93, tall: false, count: 22, spacing: 6.4, scale: [0.55, 1.1] },
]

/** Placements for one variant: [x, y, z, yaw, scale] per tree. */
export function treePoints(variant) {
  return scatter({
    count: variant.count,
    seed: variant.seed * 31 + 7,
    minSpacing: variant.spacing,
    maxSlope: 0.3,
    scale: variant.scale,
    maxRadius: 38,
    sink: 0.15,
    clumping: 0.85,
    // Keep the canopies well clear of the structures — a tree in front of the
    // cabin hides the thing the player walked over to look at.
    clearZones: 1.75,
  })
}

/** Every tree on the island, in one flat list. */
export function allTreePoints() {
  return TREE_VARIANTS.flatMap((variant) =>
    treePoints(variant).map((point) => [...point, variant.tall]),
  )
}
