/**
 * Asset manifest. Everything the world loads at runtime is declared here and
 * fetched by `npm run assets`. Sources are CC0 (Poly Haven) so the whole
 * pipeline is reproducible from a clean checkout — `public/models`,
 * `public/textures` and `public/hdri` are build artefacts.
 */

/**
 * Sunset HDRI. Used for image-based lighting and reflections only — the
 * visible sky is a gradient shader (SkyDome.jsx) so the dusk palette in the
 * brief can be hit exactly rather than approximated by a photograph.
 */
export const hdri = {
  slug: 'belfast_sunset_puresky',
  res: '1k',
  out: 'sunset.hdr',
}

/**
 * PBR texture sets. Poly Haven packs AO/Roughness/Metalness into one "arm"
 * map, which three's MeshStandardMaterial can consume directly
 * (aoMap=R, roughnessMap=G, metalnessMap=B) — one fetch instead of three.
 */
export const textures = [
  { slug: 'aerial_grass_rock', out: 'grass', maps: ['albedo', 'normal', 'arm'], size: 1024 },
  { slug: 'brown_mud_leaves_01', out: 'dirt', maps: ['albedo', 'normal', 'arm'], size: 512 },
  { slug: 'coast_sand_05', out: 'sand', maps: ['albedo', 'normal'], size: 512 },
  { slug: 'rock_face_03', out: 'cliff', maps: ['albedo', 'normal'], size: 512 },
  { slug: 'brown_planks_09', out: 'wood', maps: ['albedo', 'normal', 'arm'], size: 512 },
  { slug: 'clay_roof_tiles_02', out: 'roof', maps: ['albedo', 'normal', 'arm'], size: 512 },
  { slug: 'bark_brown_02', out: 'bark', maps: ['albedo', 'normal', 'arm'], size: 512 },
]

/** Poly Haven is inconsistent about map naming; try these in order. */
export const mapAliases = {
  albedo: ['Diffuse', 'diff', 'albedo', 'col'],
  normal: ['nor_gl', 'nor_dx', 'Normal'],
  arm: ['arm'],
  rough: ['Rough', 'rough'],
  ao: ['AO', 'ao'],
}

/**
 * Photoscanned CC0 props. `res` is the Poly Haven texture resolution we pull
 * before our own downscale; `size` is what ships. `ratio` is the meshopt
 * simplification target (fraction of vertices kept).
 */
/**
 * Photoscanned CC0 props. `res` is the Poly Haven texture resolution we pull
 * before our own downscale; `size` is what ships. `ratio` is the meshopt
 * simplification target (fraction of vertices kept).
 *
 * Note: Poly Haven's full trees are photogrammetry at 600k+ vertices, and
 * meshopt can't reduce them without shredding the alpha leaf cards — so the
 * canopy is built procedurally instead (see Foliage.jsx) from the CC0 bark and
 * leaf textures below. Solid props like rocks and stumps simplify beautifully
 * and are used as-is.
 */
export const models = [
  // join:false keeps the six rocks in the set as separate meshes so they can be
  // scattered individually instead of always appearing as one clump.
  { slug: 'rock_moss_set_01', out: 'rocks', res: '1k', size: 512, ratio: 0.12, join: false },
  { slug: 'grass_medium_01', out: 'grass-tuft', res: '1k', size: 256, ratio: 0.5 },
  { slug: 'fern_02', out: 'fern', res: '1k', size: 256, ratio: 0.4 },
  { slug: 'wild_rooibos_bush', out: 'bush', res: '1k', size: 256, ratio: 0.25 },
  { slug: 'tree_stump_01', out: 'stump', res: '1k', size: 256, ratio: 0.15 },
  { slug: 'wooden_lantern_01', out: 'lantern', res: '1k', size: 256, ratio: 0.3 },
]

/**
 * Texture-only pulls from *model* assets — Poly Haven exposes each map of a
 * model at the top level of its files payload, which is how we get a real
 * photoscanned leaf atlas (with alpha) for the procedural canopies.
 */
export const modelTextures = [
  {
    slug: 'island_tree_01',
    out: 'leaf',
    maps: { albedo: 'leaves_diff', normal: 'leaves_nor_gl', alpha: 'leaves_alpha', arm: 'leaves_arm' },
    size: 512,
  },
]

