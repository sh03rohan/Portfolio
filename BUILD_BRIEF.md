# Build Brief — Realistic Explorable 3D Portfolio

> **For:** Claude Code
> **Owner:** Md. Sakibul Hasan Rohan — Frontend & WordPress Developer
> **Goal:** A high-end, **explorable** 3D portfolio in the spirit of
> [bruno-simon.com](https://bruno-simon.com) — you move a character/vehicle
> around a world and walk up to structures that reveal my About, Work,
> Experience and Contact. **Stylized-realistic** look (real models, PBR
> textures, HDRI lighting, soft shadows, post-processing) — NOT flat cartoon.
> Use only **free / open-source** tools and assets. Aim for a top-notch,
> production-quality result.

---

## 0. How to use this brief

- If I've given you a starter zip (`rohan-portfolio`), **evolve that** — it
  already has the React Three Fiber setup, my content in `src/data/content.js`,
  and a working scene. Don't start from scratch; upgrade it phase by phase.
- If not, scaffold fresh with the stack in §2.
- Work in the **phases in §7**. Finish and verify each phase (it should build
  and run) before starting the next. Commit after each phase.
- Treat the **Quality Checklist (§12)** as the definition of done.

**Be realistic about scope with me.** This is a big project. A great Phase 1–2
result (realistic static world + movement) is the priority. Bells and whistles
come after.

---

## 1. Aesthetic direction

- **Vibe:** a small, warm, inviting island/diorama at **golden-hour / sunset**,
  floating in a soft sky. Cozy but polished — think "handcrafted game world."
- **Realism level:** stylized realism. Real GLTF models with PBR materials,
  image-based lighting, soft contact shadows, subtle depth of field and bloom.
  Avoid the plasticky, flat-shaded primitive look of the starter.
- **Palette:** dusk sky (deep indigo `#2b2450` → violet `#5a4a86` → warm coral
  `#d97a6c` → peach `#f4ad82`); warm amber accent `#ffc98a`; UI on dark glass.
- **Typography (UI):** display = **Fraunces**; body = **Inter** (both Google
  Fonts). In-world 3D text (signs) = a bold geometric font via `Text3D`.
- **Signature moment:** the reveal — as the player nears a structure, a soft
  glow + floating label rise, then a panel slides in. One memorable interaction,
  executed cleanly.

---

## 2. Tech stack (all free / open source)

```bash
# Core
react react-dom vite @vitejs/plugin-react

# 3D
three                         # ^0.169
@react-three/fiber            # ^8.17   (React renderer for three)
@react-three/drei             # ^9.114  (helpers: Environment, shadows, Html, etc.)
@react-three/postprocessing   # ^2.16   (bloom, SSAO, DOF, vignette)

# Physics + movement (for exploration)
@react-three/rapier           # ^1.5    (Rapier physics, WASM)
ecctrl                        # ^1.0    (free character controller + mobile joystick)

# State + audio + misc
zustand                       # ^4.5    (tiny global state)
howler                        # ^2.2    (ambient music + SFX)
lucide-react                  # icons in the UI

# Dev-time asset compression (see §5)
@gltf-transform/cli           # draco + ktx2 compression for models
```

Install with `npm install`; if peer-dep noise, `npm install --force`.

**Rendering config (non-negotiable for the realistic look):**
- `<Canvas shadows dpr={[1, 2]} gl={{ antialias: true }}>`
- ACES Filmic tone mapping + sRGB output (three r152+ defaults are good; set
  `gl.toneMapping = ACESFilmicToneMapping`, `toneMappingExposure ≈ 1.1`).
- Colour management on (default in modern three).

---

## 3. Free asset sources (use these, credit where required)

**3D models (prefer CC0 / low-poly-but-clean):**
- Poly Pizza — https://poly.pizza (huge free library, mostly CC0)
- Kenney — https://kenney.nl/assets (CC0 game asset packs: Nature Kit, City Kit)
- Quaternius — https://quaternius.com (CC0 stylized model packs)
- Sketchfab — https://sketchfab.com (filter license = CC0 / downloadable)

**Textures & HDRIs (all CC0):**
- Poly Haven — https://polyhaven.com (HDRIs for lighting + PBR textures)
- ambientCG — https://ambientcg.com (PBR material textures)

**Audio (CC0 / free):**
- Kenney audio packs, Freesound (CC0 filter), Pixabay music.

**Fonts:** Google Fonts (Fraunces, Inter). **Icons:** lucide-react.
**Hosting:** Vercel / Netlify / GitHub Pages (all free tiers).

> Keep a `CREDITS.md` listing each asset + author + license.

---

## 4. Architecture / file structure

```
src/
  data/
    content.js          # ALL my text/links (already provided — see §6)
    world.js            # zone definitions: id, label, position, model, trigger radius
  store.js              # zustand: player position, active zone, open panel, audio on/off
  App.jsx
  main.jsx
  index.css
  world/
    Experience.jsx      # <Canvas> + lights + env + post + physics <Physics>
    Terrain.jsx         # the island/ground (real textured mesh or GLB)
    Environment.jsx     # sky, HDRI, fog, clouds
    Lighting.jsx        # sun + fill + shadows
    Player.jsx          # ecctrl character (or vehicle) + camera follow
    Zone.jsx            # reusable point-of-interest: model + glow ring + proximity trigger
    Zones.jsx           # places all zones from world.js
    Decor.jsx           # instanced trees/rocks/grass
    Effects.jsx         # <EffectComposer> stack
    Audio.jsx           # Howler ambient + positional SFX
  ui/
    UI.jsx              # overlay root
    Panel.jsx           # sliding info panel
    Hud.jsx             # brand, hint, controls legend, audio toggle
    Minimap.jsx         # optional top-down map
    MobileControls.jsx  # ecctrl joystick wrapper
    Loader.jsx          # progress screen
public/
  models/    textures/    hdri/    audio/     # compressed assets live here
```

Keep components small and single-purpose. All content flows from `data/`.

---

## 5. Asset pipeline (this is what makes it fast AND pretty)

1. Download models as `.glb`. Put raw files in a `raw/` folder (git-ignored).
2. **Compress** before shipping — big win for load time:
   ```bash
   # geometry (Draco) + textures (KTX2/Basis)
   npx @gltf-transform/cli optimize raw/tree.glb public/models/tree.glb \
     --compress draco --texture-compress ktx2
   ```
3. Load with `useGLTF('/models/tree.glb')`; call `useGLTF.preload(...)`.
4. For many repeated objects (trees, grass, rocks) use **instancing**
   (`<Instances>` / `<Merged>` from drei) — never place hundreds of separate meshes.
5. Add a Draco + KTX2 loader setup (drei's `useGLTF` supports Draco; enable KTX2
   via `useGLTF(url, true)` / `GLTFLoader` with `KTX2Loader`).

**Texture budget:** keep individual textures ≤ 2K; reuse materials.

---

## 6. My content (source of truth)

Put this in `src/data/content.js` (already in the starter). Everything on the
site reads from here.

```js
export const content = {
  name: 'Md. Sakibul Hasan Rohan',
  role: 'Frontend & WordPress Developer',
  location: 'Mirpur 12, Dhaka, Bangladesh',

  about: {
    title: "Hi, I'm Rohan 👋",
    paragraphs: [
      "Results-driven Frontend & WordPress Developer with 2+ years of experience, currently a Junior Frontend Developer at Startise Ltd. (Templately).",
      "I build fast, responsive websites with WordPress, Elementor, Gutenberg, HTML, CSS, JavaScript and Tailwind. Delivered 90+ client projects and published a plugin on WordPress.org.",
      "I also use AI-assisted development to ship faster without cutting corners on quality.",
    ],
    skills: ['WordPress (Elementor)','HTML5','CSS3','JavaScript','Tailwind CSS','Bootstrap 5','React / Next.js','AI-assisted dev'],
    languages: ['English','Bengali','Hindi'],
  },

  work: {
    intro: 'A couple I’m proud of — plus 90+ client sites delivered.',
    featured: [
      { title: 'ParkXpot — Smart Parking Marketplace', stack: 'Next.js · React · Tailwind · Leaflet', desc: 'A modern parking marketplace to discover, book and manage spaces via an interactive map. AI-assisted build.', link: 'https://park-xpot.vercel.app/', linkLabel: 'Live demo' },
      { title: 'Tukify — AI Shopping Assistant', stack: 'WordPress · PHP · WooCommerce · AI APIs', desc: 'A published WordPress.org plugin adding AI shopping assistance to WooCommerce stores.', link: 'https://wordpress.org/plugins/tukify/', linkLabel: 'View plugin' },
    ],
    note: 'Also delivered: E-commerce, blogs, LMS, service sites & theme customization.',
  },

  experience: {
    jobs: [
      { role: 'Jr. Frontend Developer', org: 'Startise Ltd. (Templately)', period: 'Jan 2026 — Present', points: ['Build responsive templates with WordPress, Elementor & Gutenberg.','Convert Figma designs into pixel-perfect, reusable templates.'] },
      { role: 'WordPress Developer', org: 'SM Technology', period: 'Oct 2024 — Nov 2025', points: ['Built custom WordPress sites with Elementor Pro.','Integrated SEO, speed, forms & e-commerce plugins.'] },
      { role: 'Intern — WordPress Developer', org: 'bdCalling Academy', period: 'Jul 2024 — Oct 2024', points: ['Hands-on training in Elementor, theme customization & plugins.','Built real-world projects under expert guidance.'] },
    ],
    education: { degree: 'Diploma in Computer Science & Technology', school: 'Kushtia Polytechnic Institute', period: '2020 — 2024' },
  },

  contact: {
    intro: 'Open to freelance work and collaborations. Reach me at:',
    links: [
      { label: 'Email', detail: 'sh.rohan.personal@gmail.com', href: 'mailto:sh.rohan.personal@gmail.com' },
      { label: 'Phone', detail: '+880 1747-582013', href: 'tel:+8801747582013' },
      { label: 'WordPress.org', detail: 'Tukify plugin', href: 'https://wordpress.org/plugins/tukify/' },
      { label: 'GitHub', detail: 'add your handle', href: '#' },
      { label: 'LinkedIn', detail: 'add your handle', href: '#' },
    ],
  },
}
```

---

## 7. Build plan (phases — do in order, verify each)

### Phase 0 — Foundation
- Scaffold Vite + React + R3F (or open the starter). Confirm `npm run dev` works.
- Set up rendering config from §2 (tone mapping, dpr, shadows).
- Add `data/content.js` and `data/world.js`.
**Done when:** a lit empty scene renders with correct colour/tone mapping.

### Phase 1 — Realistic static world (biggest visual jump)
- **Terrain:** a larger island (≈ 2–3× the starter). Either a textured
  displacement plane or a CC0 terrain/island GLB. Add a PBR grass/ground texture
  (Poly Haven / ambientCG) with normal + roughness maps.
- **Lighting:** `<Environment>` with a sunset HDRI (Poly Haven) for IBL +
  reflections; one warm directional "sun" casting **soft shadows**
  (`<SoftShadows>` or `<AccumulativeShadows>`); a cool fill light.
- **Atmosphere:** `<Sky>` or gradient background, `<fog>`, drifting `<Cloud>`,
  `<Sparkles>` for dust/fireflies.
- **Decor:** real tree / rock / grass / bush models, **instanced**, scattered
  naturally (not a grid). Add small buildings/props for the 4 zones.
- **Post-processing (`Effects.jsx`):** `Bloom` (mipmapBlur, threshold ~1),
  `SSAO` or `N8AO` for contact darkening, `DepthOfField` (subtle), `Vignette`,
  a touch of `ToneMapping`. Keep it tasteful.
**Done when:** the world looks premium and realistic in a static orbit; 60fps on
desktop.

### Phase 2 — Exploration (the "Bruno" part)
- Wrap the world in `<Physics>` (@react-three/rapier). Give the terrain and props
  colliders.
- **Player:** use **`ecctrl`** for a third-person character controller
  (handles physics capsule, WASD/arrows, jump, and a follow-camera). Load a free
  rigged character GLB (Quaternius/Mixamo-CC0) with idle/walk/run animations via
  `useAnimations`.
  - *Alternative (closer to Bruno):* a small drivable **vehicle** using Rapier's
    dynamic body + wheels. Character is simpler; pick character unless I ask for a car.
- **Camera:** smooth follow, collision-aware, gentle damping.
- **Mobile:** `ecctrl`'s `EcctrlJoystick` for on-screen controls; jump button.
**Done when:** I can freely move around the whole island on desktop and mobile,
camera feels good, nothing falls through the floor.

### Phase 3 — Interaction + content reveal
- **Zones:** each of About / Work / Experience / Contact is a structure in the
  world (house, workshop, signpost, mailbox — or nicer real models). Define them
  in `data/world.js` (position, radius, label, panel id).
- **Proximity trigger:** when the player enters a zone's radius → glow ring
  brightens, a floating `Html` label appears, and (on key press "E" / tap, or on
  entering) the matching **panel slides in**. Leaving closes it.
- **Panels:** dark-glass sliding panels (reuse starter styles) rendering the
  content from §6. Fraunces titles, Inter body, skill chips, project cards,
  experience timeline, contact list. Esc/close button/tap-away to dismiss.
**Done when:** driving/walking up to each structure cleanly reveals correct info,
on desktop and mobile.

### Phase 4 — Polish
- **Audio (`Audio.jsx`):** Howler ambient loop (soft, low volume) + positional
  SFX (footsteps, a chime when a zone opens). Mute toggle in the HUD, off by default.
- **HUD:** brand (name/role), a controls legend, audio toggle, optional
  **minimap** showing zones + player dot.
- **Loading:** branded progress screen (drei `useProgress`), fade out on ready.
- **Perf:** `PerformanceMonitor` to scale `dpr`/effects on weak devices;
  frustum culling; preload; lazy-load heavy zones if needed.
- **A11y & UX:** keyboard focus states, `prefers-reduced-motion` (disable bob,
  auto-motion, DOF), reduced-motion fallback that still lets you read all content.
**Done when:** it feels finished — loads fast, sounds nice, works on a phone.

### Phase 5 — Ship
- `npm run build`, test the production build (`npm run preview`).
- Deploy free on **Vercel** (push repo → import → deploy). Add custom domain later.
- Write `README.md` (run/edit/deploy) and `CREDITS.md` (asset licenses).
**Done when:** a public URL works on desktop + mobile.

---

## 8. World layout (`data/world.js`)

Define zones as data so placement is easy to tweak:

```js
export const zones = [
  { id: 'about',      label: 'About me',   position: [-8, 0,  6], radius: 4, model: '/models/house.glb',    accent: '#ffc98a' },
  { id: 'work',       label: 'My work',    position: [ 9, 0,  4], radius: 4, model: '/models/workshop.glb', accent: '#ffd27a' },
  { id: 'experience', label: 'Experience', position: [ 2, 0, -9], radius: 4, model: '/models/signpost.glb', accent: '#9bd0ff' },
  { id: 'contact',    label: 'Contact',    position: [-7, 0, -7], radius: 4, model: '/models/mailbox.glb',  accent: '#ec8a76' },
]
```

Spread zones so exploring between them feels like a journey. Add a path / small
props (lanterns, fences) connecting them for a "designed" feel.

---

## 9. Performance budget (hard requirements)

- Desktop: **60 fps**; mid mobile: **≥ 30 fps**.
- Initial load: compressed models + KTX2 textures; total initial payload target
  **< 8–10 MB**. Lazy-load anything non-essential.
- `dpr` capped at 2; drop to 1.5/1 on weak devices via `PerformanceMonitor`.
- Instance all repeated decor. One shared material per repeated model.
- Use BVH (`@react-three/drei` `Bvh` / three-mesh-bvh) if raycasting gets heavy.

---

## 10. Post-processing recipe (tasteful, not overdone)

```
EffectComposer (multisampling on)
 ├─ N8AO or SSAO        // soft ambient occlusion — big realism boost
 ├─ Bloom               // mipmapBlur, luminanceThreshold ~1, intensity ~0.5
 ├─ DepthOfField        // subtle; focus on player, gentle bokeh at distance
 ├─ Vignette            // offset ~0.25, darkness ~0.6
 └─ (optional) SMAA     // clean edges
```

Golden rule: effects should be **felt, not seen**. If it looks like a filter,
dial it back.

---

## 11. Mobile & accessibility

- On-screen joystick + jump (ecctrl). Larger tap targets. Bottom-sheet panels.
- Respect `prefers-reduced-motion`: disable auto-motion, floating bob, DOF; keep
  everything readable and navigable.
- All content reachable and legible; panels keyboard-operable (Tab/Esc); visible
  focus rings. Provide a plain **"View résumé (text)"** link as a non-3D fallback.

---

## 12. Quality checklist (definition of done)

- [ ] Looks realistic & premium (real models, PBR, IBL, soft shadows, post-fx) — not cartoon.
- [ ] Island is noticeably larger; you can freely explore it.
- [ ] Smooth character/vehicle movement + follow camera, desktop **and** mobile.
- [ ] All 4 zones reveal the correct About / Work / Experience / Contact content.
- [ ] 60 fps desktop / ≥30 fps mobile; initial load < ~10 MB.
- [ ] Branded loading screen; tasteful audio with a mute toggle (off by default).
- [ ] `prefers-reduced-motion` respected; keyboard + focus accessible; text fallback.
- [ ] Builds clean (`npm run build`), deployed to a public URL.
- [ ] `README.md` + `CREDITS.md` present; all content still driven by `data/`.

---

## 13. Copy-paste prompts for Claude Code (run in sequence)

1. *"Read BUILD_BRIEF.md. If the rohan-portfolio starter is present, we'll evolve
   it. Set up the rendering config from §2 (ACES tone mapping, dpr, shadows) and
   confirm it builds. Then summarize your plan for Phase 1."*
2. *"Do Phase 1: bigger textured island, HDRI environment lighting, soft shadows,
   atmosphere, instanced real tree/rock decor from Poly Pizza/Quaternius (CC0),
   and the post-processing stack from §10. Compress all models with gltf-transform.
   Keep it 60fps."*
3. *"Do Phase 2: add Rapier physics and an ecctrl third-person character with a
   free rigged GLB (idle/walk/run) and follow camera. Add the mobile joystick.
   Make sure nothing falls through the terrain."*
4. *"Do Phase 3: zones from data/world.js with proximity triggers that reveal the
   sliding info panels using my content. Wire up About/Work/Experience/Contact."*
5. *"Do Phase 4 polish: Howler audio + mute toggle, HUD + minimap, branded loader,
   PerformanceMonitor scaling, reduced-motion + accessibility."*
6. *"Do Phase 5: production build, then deploy to Vercel and give me the steps.
   Write README.md and CREDITS.md."*

At each step: *"Show me a screenshot / run the dev server, and list what you'd
improve next."*

---

## 14. Gotchas & tips

- **Colour looks washed out?** Check tone mapping + that textures use correct
  colour space (albedo = sRGB; normal/roughness = linear).
- **Everything's dark?** Your HDRI/Environment isn't loading, or exposure too low.
- **Janky physics / falling through floor?** Terrain needs a proper collider
  (trimesh or a simplified collision mesh), and fixed timestep for physics.
- **Slow load?** You skipped compression (§5) or aren't instancing decor.
- **Don't gold-plate early.** Get Phase 1–2 genuinely good first; that's 80% of
  the "wow." Photorealism on the web has real limits — stylized realism is the win.
- Keep commits per phase so we can roll back.

— End of brief. Build something I'll be proud to put my name on.
