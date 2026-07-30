/**
 * World layout — single source of truth for island scale, spawn point and the
 * four points of interest. Positions are XZ only; the Y is resolved at runtime
 * from the terrain heightfield so nothing ever floats or sinks.
 */

// Island footprint. The visual mesh, the physics collider and every scattered
// prop are all derived from these numbers.
export const island = {
  radius: 46, // hard edge of the landmass
  shoreRadius: 40, // beyond this the ground falls away to the sea
  segments: 192, // heightfield resolution (visual + collider)
  seaLevel: -1.6,
}

// Where the player drops in.
export const spawn = [0, 6, 18]

export const zones = [
  {
    id: 'about',
    label: 'About me',
    hint: 'Who I am',
    position: [-22, 0, 13],
    rotation: 0.6,
    radius: 6.5,
    accent: '#ffc98a',
    structure: 'house',
  },
  {
    id: 'work',
    label: 'My work',
    hint: 'Things I built',
    position: [23, 0, 9],
    rotation: -0.7,
    radius: 6.5,
    accent: '#ffd27a',
    structure: 'workshop',
  },
  {
    id: 'experience',
    label: 'Experience',
    hint: 'Where I have been',
    position: [7, 0, -25],
    rotation: 0.25,
    radius: 6.5,
    accent: '#9bd0ff',
    structure: 'signpost',
  },
  {
    id: 'contact',
    label: 'Contact',
    hint: 'Say hello',
    position: [-19, 0, -19],
    rotation: -0.4,
    radius: 6.5,
    accent: '#ec8a76',
    structure: 'mailbox',
  },
  {
    id: 'guestbook',
    label: 'Sky lanterns',
    hint: 'Leave a wish',
    // Out on the south shore, away from the four content zones — the sky above
    // it needs to be empty, and a launch platform under the tree line would
    // hide the thing it exists to show.
    position: [8, 0, 29],
    rotation: -0.35,
    radius: 6.5,
    accent: '#ffb066',
    structure: 'platform',
    /** Opens a DOM panel rather than a fan of content cards. */
    panel: 'guestbook',
  },
]

/**
 * A soft dirt path threaded through the zones so exploring feels designed
 * rather than random. Used to flatten terrain, tint the ground and place
 * lanterns.
 */
export const pathNodes = [
  [0, 16],
  [-10, 15],
  [-20, 12],
  [-22, 2],
  [-20, -14],
  [-12, -22],
  [2, -24],
  [12, -18],
  [20, -6],
  [23, 6],
  [14, 12],
  [2, 14],
]

export const pathWidth = 3.4

export const zoneById = Object.fromEntries(zones.map((z) => [z.id, z]))
