# Md. Sakibul Hasan Rohan — explorable 3D portfolio

A small island at golden hour that you actually walk around. Wander up to the
cabin, the workshop, the signpost or the mailbox and each one opens the
matching part of the portfolio.

Built with React Three Fiber, Rapier physics and ecctrl. Every asset is CC0 —
see [CREDITS.md](CREDITS.md).

---

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

```bash
npm run build        # production build into dist/
npm run preview      # serve dist/ locally to check the real build
```

Node 20+ is expected.

### Assets

`public/models`, `public/textures` and `public/hdri` are build artefacts, not
hand-managed files. They're regenerated from the manifest in
`scripts/assets.config.js`:

```bash
npm run assets                      # fetch + compress everything
node scripts/fetch-assets.mjs hdri  # or one group at a time:
                                    # hdri | textures | modelTextures |
                                    # models | externalModels
node scripts/make-foliage-atlas.mjs # rebake the leaf-cluster atlas
```

Downloads are cached in `raw/` (git-ignored), so re-runs are cheap. Everything
comes from Poly Haven's API and is Draco + WebP compressed on the way in.

---

## Editing the content

**All copy lives in [`src/data/content.js`](src/data/content.js).** Name, role,
bio, skills, projects, jobs, education, contact links. Change it there and it
updates the in-world cards *and* the text résumé — nothing is duplicated.
`src/data/cards.js` decides how that content is cut into cards.

The portrait on the About card and the text résumé is `public/portrait.webp`,
pointed at by `content.profile.portrait`. Replace the file to change the photo;
`raw/portrait-source.jpeg` is the uncompressed original.

Note that `content.profile.contact` puts a real email address and phone number
on a public page and in a public repo. That's a deliberate choice for a
portfolio, but it is a choice — remove either entry and both the card and the
text résumé drop it.

**Where things sit in the world** is [`src/data/world.js`](src/data/world.js) —
island size, spawn point, and each zone's position, trigger radius, accent
colour and which structure represents it. Move a zone by editing its
`position`; the terrain flattens a pad under it and the decor scatter clears
space around it automatically.

---

## How it fits together

```
src/
  data/         content.js (all copy) · world.js (island + zone layout)
  store.js      zustand: active zone, open zone, audio, quality, weather
  world/
    Experience.jsx    <Canvas>, colour pipeline, <Physics>, perf monitor
    heightfield.js    terrainHeight(x, z) — the island, as a pure function
    Terrain.jsx       visual mesh built from the heightfield
    TerrainCollider.jsx  Rapier heightfield built from the same function
    TerrainMaterial.js   4-way splat: grass / path / sand / cliff
    SkyDome.jsx       gradient sky in the dusk palette
    Weather.jsx       owns sky, fog, sun — lerped between presets
    Precip.jsx        rain + snow particles
    Atmosphere.jsx    HDRI reflections, cloud bank
    Sea.jsx           analytic ripples, fades to the horizon colour
    tree-geometry.js  procedural trunk + leaf-card canopy
    Foliage.jsx       instanced trees with wind
    Decor.jsx         instanced CC0 rocks, plants, lanterns
    Structures.jsx    the four buildings
    Player.jsx        ecctrl capsule + character + follow camera
    Zones.jsx         proximity detection and the E key
    Zone.jsx          glow ring, floating label, zone light
    Warmup.jsx        compiles shaders and gates the reveal
    CardStack.jsx     content cards that fan out of a structure
    cards.css         the three card layouts (A / B / D)
    Effects.jsx       N8AO · bloom · DoF · vignette · SMAA
    Audio.jsx         synthesised ambience + chime
  ui/           Intro · Hud · Minimap · TextResume · MobileControls
                WeatherControls
```

A few decisions worth knowing about:

**One source of truth for the ground.** `terrainHeight(x, z)` in
`heightfield.js` defines the island. The visual mesh, the physics collider and
every scattered prop all sample it, so the ground you see is exactly the ground
you stand on — verified by raycasting the physics world against the function.

**The trees are procedural on purpose.** Poly Haven's photoscanned trees are
600k+ vertices and meshopt can't reduce them without shredding the alpha leaf
cards. So `scripts/make-foliage-atlas.mjs` bakes their CC0 leaf scan into four
dense cluster tiles, and `tree-geometry.js` grows a canopy from ~240 small
cards per tree. Three details do the heavy lifting:

- **Vertex normals point away from the canopy centre**, not along the card, so
  flat billboards shade like one rounded volume.
- **The crown is several overlapping lobes**, not one ellipsoid — a single
  shell reads as a lollipop from any distance.
- **Each card is tilted off-axis.** Cards facing exactly outward are all seen
  exactly edge-on at the silhouette, which draws a hard sliver around the rim.

Card size is the setting that decides whether it looks real: the atlas holds
~150 leaves per tile, so a card about a metre across renders leaves at ~12cm.
At 2m cards each leaf was 40cm and the tree looked like a houseplant.

The whole forest is six draw calls.

**The sky is a shader, not the HDRI.** The HDRI does the lighting and
reflections; the visible sky is a gradient in the exact palette the brief
asked for, so the horizon colour, the fog and the UI accents all agree.

**The content lives in the world, not over it.** Opening a zone fans a stack
of cards out of the building itself (`CardStack.jsx`) and closing sends them
back inside — there are no DOM popups. The cards billboard individually, and
the whole grid snaps to face the camera on the frame it opens so it never
unfurls behind a building.

They're real HTML placed in the scene by drei's `<Html transform>` rather than
3D text meshes, which is why the type is crisp and why one stylesheet
(`cards.css`) can describe three different layouts — a glass panel with an
accent rail, a timeline entry, and an editorial split header. The trade is
that DOM doesn't depth-test against the scene, so cards always draw over the
world; keeping them out in front of the structure is what stops that showing.

**Nothing re-renders on the animation loop.** The player's position lives in a
plain module (`player-position.js`) that consumers read inside their own
`useFrame`; the store only changes when you actually enter or leave a zone.

**There is no loading screen, only a veil.** The island renders from the first
frame; `Intro.jsx` is a single element over the canvas that blurs and dims
what's already there, and it moves through three states — a heavy blur with a
progress bar while assets land (deep enough that things appearing behind it
can't read as pop-in), a soft blur with "Click to start" once the scene is
genuinely ready, then transparent and inert. Clicking anywhere starts, as do
Space and Enter.

It has to sit above the canvas in order to blur it, which means the veil — not
the character — receives that click. So the character is the *visual* anchor
rather than a hit target: it sits in a warm pool of light and turns slowly on
the spot until you come in.

**Nothing loads, compiles or settles in front of the visitor.** Downloads
finishing isn't the same as being able to render: the first frame after a
reveal is where shaders compile and geometry uploads to the GPU, which is
hundreds of milliseconds of stutter exactly when someone is first looking.
`Warmup.jsx` runs `compileAsync` and a throwaway render inside the same
Suspense boundary as the content, then waits two real frames before flipping
`ready`. The loading screen refuses to lift until then, physics stays paused
so the character can't settle on camera, and the frame monitor ignores the
loading-time stall that would otherwise drop the quality tier a second after
the reveal.

Two consequences worth knowing if you add to the scene: the character spawns
at its exact resting height rather than above the ground, so unpausing physics
moves it by nothing; and anything that starts hidden — the stars, rain, snow
and clouds — is forced visible until `ready`, because three compiles via
`traverseVisible` and silently skips whatever is hidden. Miss that and the
shader compiles the first time it rains instead.

**One thing owns the light.** `Weather.jsx` is the only component that touches
`scene.fog`, `scene.environmentIntensity`, the sun and the sky shader. The
store holds just the *target* preset index; every visible value is eased toward
it inside the frame loop, so switching weather dissolves over a few seconds
instead of cutting. Two components writing the fog would only fight.

---

## Weather

Seven presets in [`src/data/weather.js`](src/data/weather.js) — day, sunset,
night, rain, cloudy, winter, fog — cycling every 25 seconds, with a switcher in
the top-right corner. Picking one by hand stops the cycle; the **Auto** button
restarts it.

Each preset carries the five stops of the gradient sky, fog colour and
distances, sun colour/intensity/position, ambient and environment intensity, a
sea tint, and flags for stars, cloud density, rain and snow. Adding an eighth
is a matter of adding an entry and an icon name.

Two things are tuned to this scene rather than copied from a generic setup:
the presets repaint the **sky gradient** rather than hiding it behind a flat
background colour, and fog distances are scaled to an island ~92 units across
with sightlines to 250 — numbers that read as cosy haze in a small scene would
put your own feet in cloud here.

Auto-cycling is disabled under `prefers-reduced-motion` (weather that changes
itself is unrequested motion); the manual switcher stays.

---

## Dev-only URL flags

| Flag | Effect |
| --- | --- |
| `?at=x,z` | Spawn the player anywhere on the island |
| `?cam=x,y,z&look=x,y,z` | Swap the player for a free orbit camera |
| `?quality=low` | Force the low-quality tier (no post stack) |
| `?stats` | drei’s fps overlay |
| `?weather=<key>` | Pin one weather preset (day, night, rain…) |
| `?physics=1` | Rapier’s debug wireframes |

All are stripped from production builds.

---

## Performance

`PerformanceMonitor` watches the frame rate and steps both the render scale and
a quality tier in the store; shadow map resolution, the post-processing stack,
cloud volumes and decor density all key off the tier.

Render scale starts at **dpr 1.5**, not 2 — dpr 2 is four times the pixels of
dpr 1 for a difference most people can't see, and it's the usual reason a 3D
site feels heavy. It drops to 1 under load.

Ambient occlusion and depth of field are the two most expensive passes, so
they're skipped entirely on touch devices regardless of the measured tier —
mobile GPUs struggle with them long before the frame timer notices. Physics
runs on a fixed 1/60 step with `interpolate` so movement stays smooth when the
frame rate and step rate don't line up.

Production payload:

| | raw | over the wire |
| --- | --- | --- |
| JavaScript | 3.77 MB | **1.33 MB** |
| Textures (WebP) | 2.38 MB | 2.38 MB |
| HDRI | 1.14 MB | 0.71 MB |
| Models (Draco + WebP) | 0.71 MB | 0.59 MB |
| Draco decoder | 0.73 MB | 0.17 MB |
| **Total** | **8.75 MB** | **≈ 5.19 MB** |

Rapier is 0.93 MB of that gzipped JavaScript: `@dimforge/rapier3d-compat`
inlines its WebAssembly as base64, which gzip can't compress well. It's split
into its own chunk so it caches independently. Moving to the non-`compat`
build with a separate `.wasm` file would roughly halve it, but
`@react-three/rapier` depends on the compat package directly.

> **Frame rates are unverified.** This was developed against a headless
> software renderer running at ~0.05 fps, which can confirm correctness but
> says nothing about real performance. Please open it on your own machine and
> a phone before publishing, and tell me if the quality tiers need retuning.

---

## Accessibility

- **"Résumé (text)"** in the HUD renders the entire portfolio as a plain
  scrollable document from the same data — for keyboards, screen readers, weak
  GPUs, or anyone who just wants to read it.
- `prefers-reduced-motion` disables the wind, wave, cloud, sparkle and label
  animations and drops depth of field.
- The content cards are 3D objects, so they can't be read by a screen reader —
  which is exactly what the text résumé is for. Esc closes a card fan, and
  walking away closes it too.
- Visible focus rings throughout.

---

## Deploying

### Vercel

1. Push this repo to GitHub.
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Vercel detects Vite. Confirm: build `npm run build`, output `dist`.
4. **Deploy.** You'll get a `*.vercel.app` URL.
5. Custom domain: Project → **Settings → Domains** → add it and follow the DNS
   instructions.

`<SpeedInsights />` in `App.jsx` reports real-user Core Web Vitals to the
Vercel dashboard. It's inert anywhere else — on localhost, Netlify or Pages it
renders nothing and sends nothing. Delete the component and the dependency if
you'd rather not collect it.

Or from the terminal:

```bash
npm i -g vercel
vercel          # preview deploy
vercel --prod   # production
```

### Netlify

Build command `npm run build`, publish directory `dist`.

### GitHub Pages

Pages serves from a subpath, so set the base first:

```js
// vite.config.js
export default defineConfig({ base: '/<repo-name>/', /* ... */ })
```

then publish `dist/` to the `gh-pages` branch.

---

## Licence

Code: do as you like with it. Assets: CC0, but please keep
[CREDITS.md](CREDITS.md) with the project — it's how the authors get their due.
