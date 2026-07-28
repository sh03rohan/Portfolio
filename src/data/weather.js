/**
 * Weather presets.
 *
 * Two deliberate differences from a stock weather setup:
 *
 * 1. `sky` carries the five stops of the gradient sky shader
 *    (src/world/SkyDome.jsx) rather than a single flat background colour. The
 *    sky is the whole mood of this scene, so each preset repaints the ramp
 *    instead of hiding it behind a solid fill. `bg` is kept as the clear
 *    colour behind the dome.
 *
 * 2. Fog distances are scaled to this island — it's ~92 units across with
 *    sightlines out to 250. The same numbers that read as "cosy haze" in a
 *    small room would put your own feet in cloud here.
 *
 * Every value here is lerped, never snapped — see src/world/Weather.jsx.
 */

export const WEATHER = [
  {
    key: 'day',
    label: 'Day',
    icon: 'Sun',
    bg: '#8fb6e8',
    sky: { zenith: '#2f6fc4', high: '#4f92d8', mid: '#8fbde8', horizon: '#cfe3f2', glow: '#fff6d8' },
    fogColor: '#c2dbf0',
    fogNear: 60,
    fogFar: 265,
    sunColor: '#fff2d6',
    sunIntensity: 3.0,
    ambientIntensity: 0.7,
    envIntensity: 1.0,
    sunPos: [38, 62, 24],
    seaColor: '#1d3f74',
    stars: 0,
    clouds: 0.35,
    rain: 0,
    snow: 0,
  },
  {
    key: 'sunset',
    label: 'Sunset',
    icon: 'Sunset',
    bg: '#e0906f',
    sky: { zenith: '#1f1a44', high: '#443a76', mid: '#6d5490', horizon: '#d4836d', glow: '#ffc98a' },
    fogColor: '#8f7aa8',
    fogNear: 55,
    fogFar: 240,
    sunColor: '#ffb877',
    sunIntensity: 3.8,
    ambientIntensity: 0.28,
    envIntensity: 0.6,
    sunPos: [-52, 26, -34],
    seaColor: '#1b2347',
    stars: 0,
    clouds: 0.32,
    rain: 0,
    snow: 0,
  },
  {
    key: 'night',
    label: 'Night',
    icon: 'Moon',
    bg: '#0e1030',
    sky: { zenith: '#05060f', high: '#0b1030', mid: '#16204a', horizon: '#2b3560', glow: '#7f93d8' },
    // Night air is clear — a tight fog would hide the stars and read as smog.
    fogColor: '#141a3c',
    fogNear: 55,
    fogFar: 300,
    sunColor: '#9db2ff',
    sunIntensity: 0.35,
    ambientIntensity: 0.1,
    envIntensity: 0.12,
    sunPos: [-30, 44, -28],
    seaColor: '#080c22',
    stars: 1,
    clouds: 0.12,
    rain: 0,
    snow: 0,
  },
  {
    key: 'rain',
    label: 'Rain',
    icon: 'CloudRain',
    bg: '#586170',
    sky: { zenith: '#2e3540', high: '#3f4854', mid: '#545d6a', horizon: '#6a7480', glow: '#98a4b0' },
    fogColor: '#6b7480',
    fogNear: 24,
    fogFar: 110,
    sunColor: '#b7c2cf',
    sunIntensity: 0.8,
    ambientIntensity: 0.55,
    envIntensity: 0.5,
    sunPos: [26, 52, 20],
    seaColor: '#2b323d',
    stars: 0,
    clouds: 1,
    rain: 1,
    snow: 0,
  },
  {
    key: 'cloudy',
    label: 'Cloudy',
    icon: 'Cloud',
    bg: '#8a93a3',
    sky: { zenith: '#4a5464', high: '#66707f', mid: '#838d9b', horizon: '#a4adb9', glow: '#cfd6de' },
    fogColor: '#9aa3b2',
    fogNear: 45,
    fogFar: 200,
    sunColor: '#e8ecf2',
    sunIntensity: 1.3,
    ambientIntensity: 0.72,
    envIntensity: 0.72,
    sunPos: [24, 56, 22],
    seaColor: '#3b4552',
    stars: 0,
    clouds: 0.9,
    rain: 0,
    snow: 0,
  },
  {
    key: 'winter',
    label: 'Winter',
    icon: 'Snowflake',
    bg: '#c3d0dc',
    sky: { zenith: '#4a6484', high: '#7290ac', mid: '#a3bcd0', horizon: '#d3e0e9', glow: '#f2f8ff' },
    fogColor: '#d6e0e8',
    fogNear: 30,
    fogFar: 150,
    sunColor: '#eaf2ff',
    sunIntensity: 1.6,
    ambientIntensity: 0.82,
    envIntensity: 0.78,
    sunPos: [30, 50, 22],
    seaColor: '#4a5c6e',
    stars: 0,
    clouds: 0.7,
    rain: 0,
    snow: 1,
  },
  {
    key: 'fog',
    label: 'Fog',
    icon: 'CloudFog',
    bg: '#b9b6ad',
    sky: { zenith: '#8a8779', high: '#a09d90', mid: '#b5b2a6', horizon: '#c9c6bb', glow: '#ddd9cd' },
    fogColor: '#c3c0b6',
    fogNear: 10,
    fogFar: 58,
    sunColor: '#d8d2c4',
    sunIntensity: 0.9,
    ambientIntensity: 0.62,
    envIntensity: 0.55,
    sunPos: [22, 46, 18],
    seaColor: '#7d7a70',
    stars: 0,
    clouds: 0.2,
    rain: 0,
    snow: 0,
  },
]

/** How long each preset holds before the auto-cycle advances. */
export const CYCLE_MS = 25000

export const weatherByKey = Object.fromEntries(WEATHER.map((w, i) => [w.key, { ...w, index: i }]))
