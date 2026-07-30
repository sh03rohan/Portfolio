/**
 * The twelve lantern-sparks hidden around the island, and the one grove that
 * isn't on the list.
 *
 * Positions are XZ only, like everything else in `world.js` — the height comes
 * from the heightfield at runtime so none of them can float or sink. Every one
 * was checked against `isPlantable()` for slope and tide, kept 4.5+ units clear
 * of the nearest structure so it reads as *behind* the building rather than
 * part of it, and kept 1.8+ units off the nearest trunk so it isn't buried
 * inside a tree.
 *
 * Moving one is safe: edit the position and the collider, the glow and the
 * counter all follow. If you put one somewhere unreachable, the dev build says
 * so in the console rather than letting it sit there uncollectable.
 */

/** How close you have to get. Generous enough that you can't walk through one. */
export const COLLECT_RADIUS = 1.3

/** How far above the ground each one hovers. */
export const HOVER_HEIGHT = 0.85

export const collectibles = [
  { id: 'cabin-back', label: 'Behind the cabin', position: [-26, 17] },
  { id: 'workshop-back', label: 'Behind the workshop', position: [27, 12] },
  { id: 'signpost-back', label: 'Behind the signpost', position: [5, -29] },
  { id: 'mailbox-back', label: 'Behind the mailbox', position: [-22, -23] },
  { id: 'north-wood', label: 'In the northern trees', position: [-6, -33] },
  { id: 'east-wood', label: 'In the eastern trees', position: [33.5, -9.5] },
  { id: 'south-shore', label: 'On the south shore', position: [2, 34] },
  { id: 'west-shore', label: 'On the west shore', position: [-34, -4] },
  { id: 'hollow', label: 'In the hollow', position: [14, 20] },
  { id: 'hilltop', label: 'Between the hills', position: [-12, -6] },
  { id: 'north-east', label: 'Out on the point', position: [24, -24] },
  { id: 'west-rise', label: 'On the western rise', position: [-26, 26] },
]

export const collectibleCount = collectibles.length

/**
 * The hidden grove — the most enclosed clearing on the island, found by
 * searching the tree scatter for the spot with the most trunks within seven
 * units that's still standable and a long way from every structure. Nothing
 * marks it and it isn't part of the count; you only find it by wandering.
 *
 * `note` is yours to rewrite — it's the one place on the site that talks to
 * somebody who went looking.
 */
export const hiddenGrove = {
  position: [-35, -12],
  /** Where the note starts to fade in. */
  radius: 4.2,
  note: {
    title: 'You went looking',
    body:
      'Most people never come out this far. Thanks for wandering — ' +
      'if you want to say hello, the mailbox on the far side has my details.',
    sign: '— Rohan',
  },
}

/** Clicks on the character, in a row, that earn a little spin. */
export const EMOTE_CLICKS = 5
