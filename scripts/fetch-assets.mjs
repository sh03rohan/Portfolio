#!/usr/bin/env node
/**
 * Downloads every asset in assets.config.js from Poly Haven (CC0) and
 * compresses it for the web.
 *
 *   node scripts/fetch-assets.mjs            # everything
 *   node scripts/fetch-assets.mjs textures   # one group: hdri | textures | models
 *
 * Raw downloads land in raw/ (git-ignored); shipped artefacts land in public/.
 * Re-running is cheap — anything already downloaded is reused.
 */
import { mkdir, writeFile, readFile, stat, readdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import sharp from 'sharp'
import { hdri, textures, models, modelTextures, externalModels, mapAliases } from './assets.config.js'

const run = promisify(execFile)
const ROOT = path.resolve(import.meta.dirname, '..')
const RAW = path.join(ROOT, 'raw')
const PUB = path.join(ROOT, 'public')
const API = 'https://api.polyhaven.com'

const exists = (p) => stat(p).then(() => true, () => false)
const mb = (n) => `${(n / 1048576).toFixed(2)} MB`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The Poly Haven CDN throws the occasional 5xx; back off and try again. */
async function download(url, dest, attempts = 5) {
  if (await exists(dest)) return dest
  await mkdir(path.dirname(dest), { recursive: true })
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      await writeFile(dest, Buffer.from(await res.arrayBuffer()))
      return dest
    } catch (err) {
      if (i >= attempts) throw err
      console.warn(`    retry ${i}/${attempts - 1}: ${err.message}`)
      await sleep(1200 * i)
    }
  }
}

const filesFor = async (slug) => {
  const res = await fetch(`${API}/files/${slug}`)
  if (!res.ok) throw new Error(`no such asset: ${slug} (${res.status})`)
  return res.json()
}

/** sharp comes along with @gltf-transform/cli, so no extra native dep. */
async function toWebp(src, dest, size, quality = 82) {
  if (await exists(dest)) return dest
  await mkdir(path.dirname(dest), { recursive: true })
  await sharp(src).resize(size, size, { fit: 'fill' }).webp({ quality }).toFile(dest)
  return dest
}

/** Poly Haven names the same map differently across assets. */
const pickMap = (files, map) => {
  for (const key of mapAliases[map] ?? [map]) {
    const entry = files[key]?.['1k']?.jpg ?? files[key]?.['1k']?.png
    if (entry) return entry
  }
  return null
}

// ---------------------------------------------------------------- HDRI ------
async function doHdri() {
  const files = await filesFor(hdri.slug)
  const { url, size } = files.hdri[hdri.res].hdr
  const dest = path.join(PUB, 'hdri', hdri.out)
  await download(url, dest)
  console.log(`  hdri/${hdri.out}  ${mb(size)}  <- ${hdri.slug}`)
}

// ------------------------------------------------------------ TEXTURES ------
async function doTextures() {
  for (const tex of textures) {
    const files = await filesFor(tex.slug)
    for (const map of tex.maps) {
      const entry = pickMap(files, map)
      if (!entry) {
        console.warn(`  ! ${tex.slug}: no 1k map "${map}" — skipped`)
        continue
      }
      const raw = path.join(RAW, 'textures', `${tex.slug}_${map}.jpg`)
      await download(entry.url, raw)
      const out = path.join(PUB, 'textures', `${tex.out}_${map}.webp`)
      // Normal maps carry direction, not colour — encode them a bit richer.
      await toWebp(raw, out, tex.size, map === 'normal' ? 92 : 82)
      const { size } = await stat(out)
      console.log(`  textures/${tex.out}_${map}.webp  ${mb(size)}`)
    }
  }
}

// ------------------------------------------------- TEXTURES FROM MODELS -----
/**
 * Pull individual maps out of a *model* asset. The leaf atlas we build the
 * procedural canopies from lives inside island_tree_01, not in the texture
 * library, and its alpha is a separate PNG that must stay lossless.
 */
async function doModelTextures() {
  for (const tex of modelTextures) {
    const files = await filesFor(tex.slug)
    for (const [name, key] of Object.entries(tex.maps)) {
      const entry = files[key]?.['1k']?.png ?? files[key]?.['1k']?.jpg
      if (!entry) {
        console.warn(`  ! ${tex.slug}: no 1k map "${key}" — skipped`)
        continue
      }
      const ext = entry.url.endsWith('.png') ? 'png' : 'jpg'
      const raw = path.join(RAW, 'textures', `${tex.slug}_${key}.${ext}`)
      await download(entry.url, raw)
      const out = path.join(PUB, 'textures', `${tex.out}_${name}.webp`)
      // A cutout mask must stay crisp or the leaves fringe.
      await toWebp(raw, out, tex.size, name === 'alpha' ? 100 : 88)
      const { size } = await stat(out)
      console.log(`  textures/${tex.out}_${name}.webp  ${mb(size)}`)
    }
  }
}

// -------------------------------------------------------------- MODELS ------
async function doModels() {
  for (const model of models) {
    const out = path.join(PUB, 'models', `${model.out}.glb`)
    if (await exists(out)) {
      console.log(`  models/${model.out}.glb  (cached)`)
      continue
    }

    const files = await filesFor(model.slug)
    const gltf = files.gltf?.[model.res]?.gltf
    if (!gltf) {
      console.warn(`  ! ${model.slug}: no ${model.res} gltf — skipped`)
      continue
    }

    // Poly Haven ships .gltf + external textures; mirror that layout locally
    // so the loader resolves relative URIs.
    const dir = path.join(RAW, 'models', model.slug)
    const entry = path.join(dir, `${model.slug}.gltf`)
    await download(gltf.url, entry)
    for (const [rel, file] of Object.entries(gltf.include ?? {})) {
      await download(file.url, path.join(dir, rel))
    }

    await mkdir(path.dirname(out), { recursive: true })
    await run(
      'npx',
      [
        'gltf-transform', 'optimize', entry, out,
        '--compress', 'draco',
        '--texture-compress', 'webp',
        '--texture-size', String(model.size),
        '--simplify', 'true',
        '--simplify-ratio', String(model.ratio),
        '--simplify-error', '0.05',
        ...(model.join === false ? ['--join', 'false'] : []),
      ],
      { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 },
    )
    const { size } = await stat(out)
    console.log(`  models/${model.out}.glb  ${mb(size)}  <- ${model.slug}`)
  }
}

// ----------------------------------------------------- EXTERNAL MODELS -----
async function doExternalModels() {
  for (const model of externalModels) {
    const out = path.join(PUB, 'models', `${model.out}.glb`)
    if (await exists(out)) {
      console.log(`  models/${model.out}.glb  (cached)`)
      continue
    }

    const raw = path.join(RAW, 'models', `${model.out}.glb`)
    await download(model.url, raw)
    await mkdir(path.dirname(out), { recursive: true })
    await run(
      'npx',
      [
        'gltf-transform', 'optimize', raw, out,
        '--compress', 'draco',
        '--texture-compress', 'webp',
        '--texture-size', String(model.size),
        '--simplify', model.simplify === false ? 'false' : 'true',
        // Joining meshes would collapse the skeleton's separate parts.
        '--join', 'false',
      ],
      { cwd: ROOT, maxBuffer: 32 * 1024 * 1024 },
    )
    const { size } = await stat(out)
    console.log(`  models/${model.out}.glb  ${mb(size)}`)
  }
}

// ---------------------------------------------------------------- main ------
async function total() {
  let bytes = 0
  for (const sub of ['models', 'textures', 'hdri', 'audio']) {
    const dir = path.join(PUB, sub)
    if (!(await exists(dir))) continue
    for (const f of await readdir(dir)) {
      const s = await stat(path.join(dir, f))
      if (s.isFile()) bytes += s.size
    }
  }
  return bytes
}

const only = process.argv[2]
const groups = {
  hdri: doHdri,
  textures: doTextures,
  modelTextures: doModelTextures,
  models: doModels,
  externalModels: doExternalModels,
}

for (const [name, fn] of Object.entries(groups)) {
  if (only && only !== name) continue
  console.log(`\n${name}:`)
  await fn()
}

console.log(`\nshipped asset payload: ${mb(await total())}`)
