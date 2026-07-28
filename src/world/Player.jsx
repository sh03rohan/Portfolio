import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import Ecctrl, { EcctrlAnimation } from 'ecctrl'
import { Vector3 } from 'three'
import { spawn, island } from '../data/world.js'
import { useModel } from './assets.js'
import { terrainHeight } from './heightfield.js'
import { usePlayerPosition } from './player-position.js'

const CHARACTER_URL = '/models/character.glb'

/**
 * One-time yaw correction for the character mesh.
 *
 * ecctrl turns the whole rig toward the velocity every frame, so the model only
 * ever needs a fixed offset for whichever way its "front" was authored.
 * RobotExpressive faces +Z, which is already the direction ecctrl drives
 * toward — so the offset is zero. A Math.PI here is what made it moonwalk:
 * the rig turned the right way and the mesh then spun 180° back.
 *
 * Swapping in a different GLB? This is the only value to change — try
 * Math.PI, then ±Math.PI / 2 if its front sits on X.
 */
const MODEL_YAW_OFFSET = 0

/**
 * Capsule the character rides in. Total height is 2 * (half + radius) = 1.3,
 * against a model that stands 1.70 units tall — the head is meant to sit above
 * the capsule, the same way it does in most third-person games.
 */
const CAPSULE_HALF_HEIGHT = 0.35
const CAPSULE_RADIUS = 0.3
const FLOAT_HEIGHT = 0.3

/**
 * Nominal distance from the rig's origin down to the model's feet, used while
 * the character is airborne. On the ground the offset is solved per frame
 * instead — see `useGroundedFeet`.
 */
const MODEL_FOOT_OFFSET = -0.6

/** How far from nominal we'll still treat the character as standing. */
const GROUNDED_TOLERANCE = 0.35

/**
 * Maps ecctrl's movement states onto the clips in the character glTF.
 * RobotExpressive ships more clips than we need; these are the four that
 * matter for walking an island.
 */
const ANIMATION_SET = {
  idle: 'Idle',
  walk: 'Walking',
  run: 'Running',
  jump: 'Jump',
  jumpIdle: 'Jump',
  jumpLand: 'Idle',
  fall: 'Jump',
  action1: 'Wave',
}

/**
 * Plants the feet on the terrain every frame.
 *
 * ecctrl rides the capsule on a spring so it can climb steps, which means the
 * rig's origin is never at a fixed height above the ground — it settles a bit,
 * and any residual oscillation in that spring shows up as the character
 * bobbing while standing still. Cancelling the spring entirely would cost the
 * step-climbing, so instead the *model* is offset by however far the rig
 * currently is from the ground, which absorbs the wobble and puts the soles
 * exactly on the surface on flat ground and slopes alike.
 *
 * This leans on a property of this particular world: the terrain heightfield
 * is the only collider the player can stand on (rocks and buildings are
 * decorative), so `terrainHeight()` really is the ground beneath the feet.
 *
 * Off the ground — jumping, or falling off a ledge — it eases back to the
 * nominal offset so the legs don't stretch toward the island below.
 */
function useGroundedFeet(rigRef, offsetRef) {
  const world = useRef(new Vector3())

  useFrame((_, delta) => {
    const rig = rigRef.current
    const offset = offsetRef.current
    if (!rig || !offset) return

    rig.getWorldPosition(world.current)
    const ground = terrainHeight(world.current.x, world.current.z)
    const solved = ground - world.current.y

    const grounded = Math.abs(solved - MODEL_FOOT_OFFSET) < GROUNDED_TOLERANCE
    const target = grounded ? solved : MODEL_FOOT_OFFSET

    // Snappy enough to track a slope, slow enough to swallow spring jitter.
    offset.position.y += (target - offset.position.y) * Math.min(1, delta * 14)

    if (import.meta.env.DEV) {
      // Positive = hovering, negative = sunk into the ground.
      window.__feet = { clearance: world.current.y + offset.position.y - ground, grounded }
    }
  })
}

function CharacterModel(props) {
  const group = useRef()
  const offset = useRef()
  const { scene, animations } = useModel(CHARACTER_URL)

  // Clone through SkeletonUtils so the skinned mesh keeps a working skeleton.
  const model = useMemo(() => cloneSkinned(scene), [scene])
  const { actions } = useAnimations(animations, group)

  useEffect(() => {
    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        child.frustumCulled = false
      }
    })
  }, [model])

  useGroundedFeet(group, offset)

  return (
    <group ref={group} {...props} dispose={null}>
      <group ref={offset} rotation={[0, MODEL_YAW_OFFSET, 0]} position={[0, MODEL_FOOT_OFFSET, 0]}>
        <primitive object={model} scale={0.38} />
      </group>
    </group>
  )
}

/**
 * Publishes the player's world position every frame without going through
 * React state — proximity checks, the minimap and the DOF focus all read it
 * from a shared vector, so walking around never triggers a re-render.
 */
function PositionReporter({ bodyRef }) {
  const setPosition = usePlayerPosition((s) => s.set)
  const world = useRef(new Vector3())

  useFrame(() => {
    // ecctrl's imperative handle exposes the Rapier body as `.group`.
    const rigid = bodyRef.current?.group
    if (!rigid) return
    const { x, y, z } = rigid.translation()
    setPosition(world.current.set(x, y, z))

    if (import.meta.env.DEV) {
      // Lets the screenshot harness compare where the player actually is
      // against where the terrain function says the ground should be.
      window.__player = { x, y, z, ground: terrainHeight(x, z) }
    }
  })

  return null
}

/**
 * The third-person character: a Rapier capsule driven by ecctrl, with a
 * damped follow camera that avoids clipping through terrain.
 */
export default function Player() {
  const body = useRef()

  // Drop in above the ground so the first physics step settles, not tunnels.
  // `?at=x,z` in dev drops you anywhere on the island, which beats walking
  // across it to check one corner.
  const start = useMemo(() => {
    let [x, , z] = spawn
    if (import.meta.env.DEV) {
      const at = new URLSearchParams(window.location.search).get('at')
      const parts = at?.split(',').map(Number)
      if (parts?.length === 2 && parts.every(Number.isFinite)) [x, z] = parts
    }
    return [x, terrainHeight(x, z) + 3, z]
  }, [])

  // If the player ever ends up in the sea or off the edge, put them back.
  useFrame(() => {
    const rigid = body.current?.group
    if (!rigid) return
    const p = rigid.translation()
    if (p.y > island.seaLevel - 8 && Math.hypot(p.x, p.z) < island.radius * 2.4) return
    rigid.setTranslation({ x: start[0], y: start[1], z: start[2] }, true)
    rigid.setLinvel({ x: 0, y: 0, z: 0 }, true)
    rigid.setAngvel({ x: 0, y: 0, z: 0 }, true)
  })

  return (
    <>
      <Ecctrl
        ref={body}
        animated
        position={start}
        // Belt and braces against tunnelling on a frame spike.
        ccd
        capsuleHalfHeight={CAPSULE_HALF_HEIGHT}
        capsuleRadius={CAPSULE_RADIUS}
        floatHeight={FLOAT_HEIGHT}
        characterInitDir={0}
        // Movement feel: brisk but not twitchy, with a real sprint.
        maxVelLimit={4.2}
        sprintMult={1.9}
        turnSpeed={16}
        jumpVel={4.4}
        slopeMaxAngle={0.9}
        // Camera: close third person, collision-aware, gently damped.
        camInitDis={-7}
        camMinDis={-2.4}
        camMaxDis={-16}
        camInitDir={{ x: 0.22, y: Math.PI * 0.85 }}
        camUpLimit={1.2}
        camLowLimit={-0.4}
        camCollision
        camCollisionOffset={0.8}
        camFollowMult={9}
        camLerpMult={22}
        camMoveSpeed={0.9}
        camTargetPos={{ x: 0, y: 0.55, z: 0 }}
        // The idle bob was an underdamped float spring: ecctrl rides the
        // capsule on a spring so it can climb steps, and at the stock damping
        // it never settles. Softer spring, much heavier damping.
        springK={1.2}
        dampingC={0.28}
        autoBalance
        autoBalanceSpringK={0.4}
        autoBalanceDampingC={0.03}
        autoBalanceSpringOnY={0.5}
        autoBalanceDampingOnY={0.05}
      >
        <EcctrlAnimation characterURL={CHARACTER_URL} animationSet={ANIMATION_SET}>
          <CharacterModel />
        </EcctrlAnimation>
      </Ecctrl>
      <PositionReporter bodyRef={body} />
    </>
  )
}
