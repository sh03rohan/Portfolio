import { useEffect, useRef } from 'react'
import { useStore } from '../store.js'

/**
 * Ambience, synthesised rather than streamed.
 *
 * The brief suggested a CC0 audio loop played through Howler, but none of the
 * free libraries expose a machine-verifiable licence per file, and shipping
 * audio we can't attribute correctly in CREDITS.md isn't worth it. The Web
 * Audio API gets us a warm evening drone and a chime for nothing: no
 * download, no licence, no attribution.
 *
 * To swap in real files later, replace the two builders below with Howler
 * instances — the on/off plumbing and the mute toggle stay exactly the same.
 */

/** Filtered noise, shaped slowly — reads as distant surf and wind. */
function createWind(ctx, destination) {
  const seconds = 4
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  // Brown noise: smoother and far less hissy than white.
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    last = (last + 0.02 * white) / 1.02
    data[i] = last * 3.5
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 420
  filter.Q.value = 0.6

  // Slow swell so it breathes instead of sitting flat.
  const swell = ctx.createGain()
  swell.gain.value = 0.55
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.06
  const lfoDepth = ctx.createGain()
  lfoDepth.gain.value = 0.3
  lfo.connect(lfoDepth).connect(swell.gain)

  source.connect(filter).connect(swell).connect(destination)
  source.start()
  lfo.start()
  return () => {
    source.stop()
    lfo.stop()
  }
}

/** A quiet, slightly detuned drone in the key the chime resolves to. */
function createDrone(ctx, destination) {
  const gain = ctx.createGain()
  gain.gain.value = 0.055
  gain.connect(destination)

  const stops = []
  // A minor-ninth-ish stack: warm, unresolved, easy to ignore.
  for (const [freq, detune] of [
    [110, -4],
    [164.81, 5],
    [246.94, -7],
  ]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    osc.detune.value = detune

    const voice = ctx.createGain()
    voice.gain.value = 0.34

    // Each voice drifts at its own rate so the chord never sits still.
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.03 + Math.random() * 0.04
    const depth = ctx.createGain()
    depth.gain.value = 0.16
    lfo.connect(depth).connect(voice.gain)

    osc.connect(voice).connect(gain)
    osc.start()
    lfo.start()
    stops.push(() => {
      osc.stop()
      lfo.stop()
    })
  }

  return () => stops.forEach((stop) => stop())
}

/** A soft bell struck when a panel opens. */
function chime(ctx, destination) {
  const now = ctx.currentTime
  for (const [freq, delay, level] of [
    [880, 0, 0.16],
    [1318.5, 0.07, 0.1],
    [1760, 0.13, 0.05],
  ]) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq

    const env = ctx.createGain()
    env.gain.setValueAtTime(0, now + delay)
    env.gain.linearRampToValueAtTime(level, now + delay + 0.012)
    env.gain.exponentialRampToValueAtTime(0.0001, now + delay + 1.5)

    osc.connect(env).connect(destination)
    osc.start(now + delay)
    osc.stop(now + delay + 1.6)
  }
}

export default function Audio() {
  const audioOn = useStore((s) => s.audioOn)
  const openPanel = useStore((s) => s.openPanel)
  const context = useRef(null)
  const master = useRef(null)
  const teardown = useRef([])

  // Start and stop the bed with the toggle. The context is only created on
  // first enable, which is always inside a user gesture.
  useEffect(() => {
    if (!audioOn) {
      teardown.current.forEach((stop) => stop())
      teardown.current = []
      context.current?.close()
      context.current = null
      master.current = null
      return
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return

    const ctx = new AudioContextClass()
    const gain = ctx.createGain()
    gain.gain.value = 0
    gain.connect(ctx.destination)
    // Fade in — a bed that snaps on is startling.
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 2.2)

    context.current = ctx
    master.current = gain
    teardown.current = [createWind(ctx, gain), createDrone(ctx, gain)]

    return () => {
      teardown.current.forEach((stop) => stop())
      teardown.current = []
      ctx.close()
    }
  }, [audioOn])

  // Ring the bell when a panel opens (not when it closes).
  useEffect(() => {
    if (!openPanel || !context.current || !master.current) return
    chime(context.current, master.current)
  }, [openPanel])

  return null
}
