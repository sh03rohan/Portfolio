# Credits

Every asset shipped in `public/` is **CC0 1.0 (public domain)**. CC0 asks for
nothing, but these people did the work and deserve the mention.

Everything here is fetched and compressed by `npm run assets` from the manifest
in `scripts/assets.config.js` — that file is the machine-readable version of
this page.

---

## Environment lighting

| Asset | Source | Author | Licence |
| --- | --- | --- | --- |
| `hdri/sunset.hdr` — *Belfast Sunset (Pure Sky)*, 1K | [Poly Haven](https://polyhaven.com/a/belfast_sunset_puresky) | Greg Zaal, Dimitrios Savva, Jarod Guest | CC0 |

Used for image-based lighting and reflections only. The visible sky is a
gradient shader (`src/world/SkyDome.jsx`), not this image.

## Textures

All from [Poly Haven](https://polyhaven.com/textures), resized and re-encoded
to WebP.

| Ships as | Poly Haven asset | Author | Licence |
| --- | --- | --- | --- |
| `textures/grass_*` | [Aerial Grass Rock](https://polyhaven.com/a/aerial_grass_rock) | Rob Tuytel | CC0 |
| `textures/dirt_*` | [Brown Mud Leaves 01](https://polyhaven.com/a/brown_mud_leaves_01) | Rob Tuytel | CC0 |
| `textures/sand_*` | [Coast Sand 05](https://polyhaven.com/a/coast_sand_05) | Rob Tuytel, Dario Barresi | CC0 |
| `textures/cliff_*` | [Rock Face 03](https://polyhaven.com/a/rock_face_03) | Dario Barresi, Rico Cilliers | CC0 |
| `textures/wood_*` | [Brown Planks 09](https://polyhaven.com/a/brown_planks_09) | Rob Tuytel | CC0 |
| `textures/roof_*` | [Clay Roof Tiles 02](https://polyhaven.com/a/clay_roof_tiles_02) | Amal Kumar | CC0 |
| `textures/bark_*` | [Bark Brown 02](https://polyhaven.com/a/bark_brown_02) | Rob Tuytel | CC0 |
| `textures/leaf_*` | leaf maps from [Island Tree 01](https://polyhaven.com/a/island_tree_01) | Rob Tuytel, Rico Cilliers | CC0 |
| `textures/canopy.webp` | **derived** — see below | Rob Tuytel, Rico Cilliers | CC0 |

### `canopy.webp` — a derived asset

Poly Haven's `island_tree_01` leaf map is eight individual leaves. Filling a
canopy with them one at a time would take thousands of quads, so
`scripts/make-foliage-atlas.mjs` cuts each leaf out via its alpha mask and
composites ~180 of them — randomly rotated, scaled and tinted — into four
dense cluster cards. The trees in `src/world/tree-geometry.js` are built from
those. The source pixels are Rob Tuytel and Rico Cilliers' CC0 scan; the
arrangement is ours.

## Models

All from [Poly Haven](https://polyhaven.com/models) except the character.
Simplified with meshoptimizer and shipped as Draco-compressed glTF with WebP
textures.

| Ships as | Poly Haven asset | Author | Licence |
| --- | --- | --- | --- |
| `models/rocks.glb` | [Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01) | Kless Gyzen | CC0 |
| `models/grass-tuft.glb` | [Grass Medium 01](https://polyhaven.com/a/grass_medium_01) | Rob Tuytel, Rico Cilliers | CC0 |
| `models/fern.glb` | [Fern 02](https://polyhaven.com/a/fern_02) | Rob Tuytel, Rico Cilliers | CC0 |
| `models/bush.glb` | [Wild Rooibos Bush](https://polyhaven.com/a/wild_rooibos_bush) | James Ray Cock, Jenelle van Heerden | CC0 |
| `models/stump.glb` | [Tree Stump 01](https://polyhaven.com/a/tree_stump_01) | Rob Tuytel | CC0 |
| `models/lantern.glb` | [Wooden Lantern 01](https://polyhaven.com/a/wooden_lantern_01) | James Ray Cock | CC0 |

### Character

| Ships as | Source | Author | Licence |
| --- | --- | --- | --- |
| `models/character.glb` | *RobotExpressive*, via [three.js examples](https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive) | [Tomás Laulhé](https://quaternius.com) — modified by [Don McCurdy](https://donmccurdy.com) | CC0 |

### Not downloaded — built in code

The four buildings (`src/world/Structures.jsx`) and every tree
(`src/world/tree-geometry.js`) are generated from primitives and dressed in the
CC0 textures above. The free libraries have no cabins or mailboxes matching
this art direction, and mixing low-poly cartoon buildings into a world of
photoscanned nature would have looked worse than either alone.

## Audio

**No audio files are shipped.** The ambience in `src/world/Audio.jsx` — a
brown-noise surf bed, a slowly detuning drone, and a bell struck when a zone
opens — is synthesised at runtime with the Web Audio API.

The brief suggested a CC0 loop played through Howler, but none of the free
audio libraries expose a per-file licence that can be verified
programmatically, and shipping sound that can't be credited accurately here
wasn't worth it. Synthesis costs nothing to download and raises no licence
question. To use real files instead, replace the two builders in `Audio.jsx`;
the mute toggle and on/off plumbing stay as they are.

## Fonts

| Font | Source | Licence |
| --- | --- | --- |
| [Fraunces](https://fonts.google.com/specimen/Fraunces) (display) | Google Fonts | SIL Open Font License 1.1 |
| [Inter](https://fonts.google.com/specimen/Inter) (body) | Google Fonts | SIL Open Font License 1.1 |

Both are also self-hosted as `.ttf` in `public/fonts` for the in-world 3D
cards. troika (which drei's `<Text>` uses) needs a real font file, and with no
`font` prop it quietly fetches Roboto from a Google CDN at runtime — self-
hosting keeps the 3D type on-brand and removes that hidden dependency.

## Icons

[Lucide](https://lucide.dev) — ISC License.

## Libraries

[three.js](https://threejs.org) (MIT) ·
[@react-three/fiber](https://github.com/pmndrs/react-three-fiber) (MIT) ·
[@react-three/drei](https://github.com/pmndrs/drei) (MIT) ·
[@react-three/postprocessing](https://github.com/pmndrs/react-postprocessing) (MIT) ·
[@react-three/rapier](https://github.com/pmndrs/react-three-rapier) (MIT) ·
[Rapier](https://rapier.rs) (Apache-2.0) ·
[ecctrl](https://github.com/pmndrs/ecctrl) (MIT) ·
[zustand](https://github.com/pmndrs/zustand) (MIT) ·
[Vite](https://vitejs.dev) (MIT) ·
[React](https://react.dev) (MIT) ·
[glTF-Transform](https://gltf.report) (MIT) ·
[sharp](https://sharp.pixelplumbing.com) (Apache-2.0) ·
[@react-spring/three](https://github.com/pmndrs/react-spring) (MIT) ·
[troika-three-text](https://github.com/protectwise/troika) (MIT)
