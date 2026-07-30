import { WindClock } from './wind.js'
import Birds from './Birds.jsx'
import Smoke from './Smoke.jsx'
import Fireflies from './Fireflies.jsx'

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
 */
export default function Ambience() {
  return (
    <>
      <WindClock />
      <Birds />
      <Smoke />
      <Fireflies />
    </>
  )
}
