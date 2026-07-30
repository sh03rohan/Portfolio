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
    wind.js           the one GPU clock + the foliage sway shader
    Ambience.jsx       birds · chimney smoke · fireflies
    Birds.jsx         instanced flock, flight solved in the vertex shader
    Smoke.jsx         chimney plume
    Fireflies.jsx     swarm clustered on the trees
    trees.js          where the forest stands (shared with Fireflies)
    audio-engine.js   the synthesiser: beds, footsteps, chime
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

**One clock drives everything that moves.** The grass, ferns, bushes, canopy,
birds, smoke and fireflies are all instanced, so the only way to animate them
without a CPU loop over hundreds of objects is a vertex shader reading a shared
uniform. `wind.js` holds three of them — `uTime`, `uWind`, `uWindStrength` —
and exactly one component advances them. The CPU touches each layer once, at
mount.

That has consequences worth knowing. The clock is mounted outside every tier
check, because the tiers switch individual layers off and a clock living inside
one of them would freeze the trees along with the birds. The frame delta is
clamped to 100ms, so returning to a backgrounded tab doesn't teleport every
bird. And `prefers-reduced-motion` stops `uTime` rather than each layer, which
means one flag freezes the whole island — but freezing a clock also freezes
each particle wherever it happened to be in its own cycle, half the fireflies
caught mid-blink and dark, so there's a second uniform (`uAnimate`) that lets a
shader fall back to a steady value instead of a frozen one.

The birds don't use their instance matrices at all: position, heading and
wingbeat are solved in the shader from four numbers per bird, which is what
makes them *fly* rather than sit at fixed points. Their normals are rotated
into the flight basis too — skip that and every bird is lit as though it were
facing +Z wherever it is on the circle. `applyWindSway` is idempotent on
purpose: patching a material twice appends the uniform block twice, GLSL
rejects the redeclaration, and the plant renders as nothing. StrictMode invokes
a memo factory twice in development, so this is not a hypothetical.

**The fireflies use the trees the forest actually drew.** That's why the tree
scatter lives in `trees.js` rather than inside `Foliage.jsx` — clustering the
swarm on an independently scattered set would put half of it in open grass,
which is exactly the tell that they were sprinkled over the island rather than
living in it.

**Smoke and fireflies extend `PointsMaterial`** rather than being raw shader
materials, which is what gets them fog, tone mapping, output colour space and
size attenuation for free. A raw shader would have to reimplement all four, and
would get the fog preset visibly wrong. Their soft round edge is a smoothstep on
`gl_PointCoord`, so there's no sprite texture to download.

---

## Things to find

Twelve sparks are hidden around the island — behind each structure, in the
trees, out on the shore. Walk within 1.3 units of one and it's yours: a rising
two-note pickup, a puff of light, and the counter under the zone dots ticks up.
They're remembered in `localStorage`, so they stay found on your next visit.
Find all twelve and you get fireworks over the island, a line of thanks, and the
character keeps a warm pool of light at its feet from then on.

Positions live in [`src/data/collectibles.js`](src/data/collectibles.js) as XZ
pairs, with the height coming from the heightfield like everything else. Each
one was checked against `isPlantable()` for slope and tide, kept 4.5+ units off
the nearest structure so it reads as *behind* the building rather than part of
it, and kept 1.8+ units off the nearest trunk so it isn't buried inside a tree.
Move one and the collider, the glow and the counter all follow; put one
somewhere unreachable and the dev build says so in the console rather than
letting it sit there uncollectable.

A few things about how it's built:

**The pickup effect and the fireworks are mounted from the first frame.** They
sit at zero alpha until they're needed, driven by a start time rather than being
created on the event. A material built at the moment of pickup would compile its
shader right then — a visible hitch in precisely the moment that shouldn't have
one. This is the same reason the stars and the rain are forced visible during
warmup.

**Collected sparks are hidden by zeroing an instance matrix**, not by
re-rendering with a shorter list. Rebuilding the geometry to drop one item would
throw away the whole set's shader and rebuild it mid-walk.

**The pickup note climbs a pentatonic scale with each find**, so the twelfth
sounds an octave above the first. A fixed sound tells you something happened; a
rising one tells you how far along you are.

**The celebration is a moment, not a state.** `celebrating` is set on the frame
the last spark is collected and cleared when the last ember dies — a later visit
loads a full list without replaying anything. `?celebrate=1` in dev fires the
display on demand, because reviewing a reward shouldn't cost a lap of the island.

### Two easter eggs

**The hidden grove.** One lantern and a note, in the most enclosed clearing on
the island. The spot wasn't chosen by eye — it's the standable point with the
most trunks within seven units that's also a long way from every structure,
found by searching the tree scatter. Nothing marks it, it isn't part of the
count and it never appears on the minimap; you only find it by going somewhere
there was no reason to go. The note fades in with distance rather than snapping
on at a trigger radius, so walking up feels like the light reaching you. **The
text is yours to rewrite** — it's in `collectibles.js`, and it's the one place
on the site that talks to somebody who went looking.

**Click the character five times** (inside a second and a half of each other)
and it does a full turn on the spot. The turn is added to the same code that
already owns the model's rotation, so there's only ever one writer, and a full
revolution ends where it started — nothing to unwind, and ecctrl's facing is
untouched throughout.

---

## Sound

There is still not a single audio file in the build. That began as a licensing
decision — no free library exposes a machine-verifiable licence per file, and
shipping audio we can't attribute properly in [CREDITS.md](CREDITS.md) wasn't
worth it — and the ambience layer only strengthened it. Six cross-fading beds
and four footstep surfaces would be about a megabyte of downloads for sounds
that a few lines of arithmetic produce, and the synthesised versions respond to
the world continuously: the surf really does get louder as you walk toward the
water, rather than switching between a "near" file and a "far" one.

`audio-engine.js` is plain JavaScript with no React in it, so nothing about the
sound can cause a render. What it makes:

| Layer | How |
| --- | --- |
| Surf | Brown noise through a lowpass, level set by distance from the middle of the island |
| Wind | Brown noise through a bandpass, with the weather's `wind` on the gain and an LFO on the *filter* — modulating the frequency rather than the volume is what makes a gust read as moving air |
| Crickets | ~40 chirp trains written into one 6-second buffer at startup and looped; each voice wraps past the end, so the loop point is inaudible |
| Birdsong | Scheduled one phrase at a time, 2–4 swept notes each. The one layer where a loop would be obvious, because the ear tracks the phrase |
| Drone | Three detuned sines, each drifting on its own LFO |
| Footsteps | Filtered white noise, one voice per surface, plus a low thump for the surfaces that have something solid to strike |

Cross-fades use `setTargetAtTime`, so the browser eases them on the audio
thread and a long frame on the main thread can't turn a fade into a step.

**Footsteps read the surface from the same rule the renderer paints it with.**
`surfaceWeights()` in `heightfield.js` is deliberately the same arithmetic as
`splatWeights()` in the terrain shader — footsteps that disagree with what's
visibly underfoot are worse than no footsteps at all. Grass is a mid-band
rustle, the worn path a duller thud, sand a long soft hiss with no attack, rock
a short bright click. Walking the path loop, the mix comes out 72% grass, 17%
path, 7% sand, 4% cliff.

Cadence follows ground speed, which is also what drives the walk and run clips,
so the steps stay with the animation without reading its phase. It carries a few
percent of jitter on purpose: the step clock can only fire on a frame boundary,
so a fixed interval comes out perfectly quantised and starts to sound like a
drum machine rather than a person.

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
| `?celebrate=1` | Fire the all-found fireworks without finding all twelve |

Dev builds also publish probes on `window`: `__player` and `__feet` for the
character, `__jitter` for idle drift, `__emote` for the click counter, and
`__wind` for the ambience clock — everything in that layer is animated by three
numbers, so `__wind` tells you straight away whether a frozen-looking island is
the clock's fault.

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
  animations and drops depth of field. It stops the ambience clock too, so the
  grass, birds, smoke and fireflies hold still — the fireflies keep glowing at a
  steady level rather than freezing wherever their blink happened to be.
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
