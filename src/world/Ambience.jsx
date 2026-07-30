import { WindClock } from './wind.js'
import Birds from './Birds.jsx'
import Smoke from './Smoke.jsx'
import Fireflies from './Fireflies.jsx'
import Collectibles from './Collectibles.jsx'
import Fireworks from './Fireworks.jsx'
import HiddenGrove from './HiddenGrove.jsx'

/**
 * The things that make the island feel inhabited rather than modelled.
 *
 * None of these are interactive and none of them touch React state on the
 * frame loop — each is a single instanced draw whose motion lives entirely in
 * a vertex shader, driven by the one clock in `wind.js`.
 *
 * The clock is mounted unconditionally, outside every tier check: the quality
 * tiers switch individual layers off, and if the clock lived inside one of them
 * then dropping to low would freeze the trees along with the birds.
 *
 * The collectibles and the two easter eggs live here as well. They're
 * interactive, so strictly they're not ambience — but they're built out of
 * exactly the same parts (one instanced draw, motion in a vertex shader, the
 * shared clock) and keeping them together is what stops a second, subtly
 * different copy of that machinery growing elsewhere.
 */
export default function Ambience() {
  return (
    <>
      <WindClock />
      <Birds />
      <Smoke />
      <Fireflies />
      <Collectibles />
      <Fireworks />
      <HiddenGrove />
    </>
  )
}
