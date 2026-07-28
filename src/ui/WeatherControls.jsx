import { useEffect } from 'react'
import { Sun, Sunset, Moon, CloudRain, Cloud, Snowflake, CloudFog, Repeat } from 'lucide-react'
import { useStore } from '../store.js'
import { WEATHER, CYCLE_MS } from '../data/weather.js'

const ICONS = { Sun, Sunset, Moon, CloudRain, Cloud, Snowflake, CloudFog }

/**
 * Corner weather switcher, plus the auto-cycle timer.
 *
 * Picking a preset by hand turns auto off — having the scene wander away from
 * what someone just chose would be obnoxious. The Auto button turns it back on.
 */
export default function WeatherControls() {
  const index = useStore((s) => s.weatherIndex)
  const auto = useStore((s) => s.autoWeather)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const setWeather = useStore((s) => s.setWeather)
  const nextWeather = useStore((s) => s.nextWeather)
  const toggleAuto = useStore((s) => s.toggleAuto)

  // Weather that changes itself is exactly the kind of unrequested motion
  // prefers-reduced-motion is asking us to stop. The switcher stays.
  useEffect(() => {
    if (!auto || reducedMotion) return
    const id = setInterval(nextWeather, CYCLE_MS)
    return () => clearInterval(id)
  }, [auto, reducedMotion, nextWeather])

  return (
    <div className="weather-ctrl">
      <button
        type="button"
        className={`wc-auto${auto && !reducedMotion ? ' on' : ''}`}
        onClick={toggleAuto}
        aria-pressed={auto && !reducedMotion}
        title={
          reducedMotion
            ? 'Auto weather is off while your system asks for reduced motion'
            : auto
              ? 'Auto weather: on'
              : 'Auto weather: off'
        }
      >
        <Repeat size={14} aria-hidden="true" />
        <span>Auto</span>
      </button>

      <div className="wc-icons" role="group" aria-label="Weather">
        {WEATHER.map((weather, i) => {
          const Icon = ICONS[weather.icon]
          const isActive = i === index
          return (
            <button
              key={weather.key}
              type="button"
              className={`wc-btn${isActive ? ' active' : ''}`}
              title={weather.label}
              aria-label={weather.label}
              aria-pressed={isActive}
              onClick={() => {
                setWeather(i)
                if (auto) toggleAuto()
              }}
            >
              <Icon size={17} aria-hidden="true" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
