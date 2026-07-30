import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useAnimations, useKeyboardControls } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import Ecctrl, { EcctrlAnimation, useJoystickControls } from 'ecctrl'
import { Vector3, AdditiveBlending } from 'three'
import { spawn, island, zoneById } from '../data/world.js'
import { EMOTE_CLICKS, collectibleCount } from '../data/collectibles.js'
import { useModel, MODELS } from './assets.js'
import { terrainHeight } from './heightfield.js'
import { useBeforePhysicsStep } from '@react-three/rapier'
import { usePlayerPosition, playerMotion } from './player-position.js'
import { sfx } from './sfx.js'
import { useStore } from '../store.js'

/** How long a full emote turn takes. */
const EMOTE_SECONDS = 0.9

/** Clicks have to land inside this of each other to count as a run. */
const EMOTE_WINDOW_MS = 1400

const CHARACTER_URL = MODELS.character

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
const CAPSULE_HALF_HEIGHT = 0.42
const CAPSULE_RADIUS = 0.34
const FLOAT_HEIGHT = 0.36

/**
 * Nominal distance from the rig's origin down to the model's feet, used while
 * the character is airborne. On the ground the offset is solved per frame
 * instead — see `useGroundedFeet`.
 */
const MODEL_FOOT_OFFSET = -0.63

/** How far from nominal we'll still treat the character as standing. */
const GROUNDED_TOLERANCE = 0.35

/**
 * Where the capsule's origin settles above the ground once the float spring
 * reaches equilibrium. Measured, not derived — the spring compresses a little
 * under the body's own weight, so it isn't simply capsuleRadius + floatHeight.
 *
 * Spawning at exactly this height means unpausing physics moves the character
 * by nothing. It used to drop in from 3 units up, which is a visible fall the
 * moment the loading screen lifts.
 */
const REST_HEIGHT = 0.76

/**
 * Below this horizontal speed, with no input, the character is considered
 * stopped and its sideways velocity is zeroed outright.
 *
 * Well under a walk (~4/s), so it can never interfere with actually moving —
 * and it's only ever applied when nothing is being pressed, so it can't stop
 * the character accelerating away from rest either.
 */
const IDLE_SPEED = 0.8

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

/**
 * Before you click in, the character is the thing to look at: a warm pool of
 * light under it and a slow turn on the spot.
 *
 * The rotation is applied to the offset group rather than the rig, so ecctrl
 * still owns facing once play starts and there's nothing to unwind.
 */
function useIdleShowcase(offsetRef, ringRef, emoteRef) {
  const entered = useStore((s) => s.entered)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const spin = useRef(0)

  useFrame((_, delta) => {
    const offset = offsetRef.current
    const ring = ringRef.current
    if (!offset) return

    if (!entered && !reducedMotion) spin.current += delta * 0.5
    // Unwind to face forward once play starts, so ecctrl takes over cleanly.
    else if (entered) spin.current += (0 - spin.current) * Math.min(1, delta * 4)

    /**
     * The emote turn. Added here rather than written anywhere else because this
     * is already the one thing that owns `offset.rotation.y` — two writers would
     * just fight. A full turn ends exactly where it started, so there's nothing
     * to unwind afterwards and ecctrl's facing is untouched throughout.
     */
    let emoteSpin = 0
    const emote = emoteRef.current
    if (emote.running) {
      emote.elapsed += delta
      const t = Math.min(1, emote.elapsed / EMOTE_SECONDS)
      // Ease in and out, so it reads as a deliberate spin rather than a glitch.
      emoteSpin = (t * t * (3 - 2 * t)) * Math.PI * 2
      if (t >= 1) {
        emote.running = false
        emote.elapsed = 0
      }
    }

    offset.rotation.y = MODEL_YAW_OFFSET + spin.current + emoteSpin

    if (ring) {
      const target = entered ? 0 : 1
      ring.material.opacity += (target - ring.material.opacity) * Math.min(1, delta * 3)
      ring.visible = ring.material.opacity > 0.01
    }
  })
}

function CharacterModel(props) {
  const group = useRef()
  const offset = useRef()
  const ring = useRef()
  const aura = useRef()
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

  /**
   * Five clicks in a row earns a spin.
   *
   * Kept in a ref rather than the store: a click on the character shouldn't
   * re-render the scene, and the run has to reset on its own if you wander off
   * mid-way. The window is per-click, so a slow tapper never gets there — which
   * is the point of it being an easter egg.
   */
  const clicks = useRef({ count: 0, last: 0 })
  const emote = useRef({ running: false, elapsed: 0 })

  const onCharacterClick = (event) => {
    event.stopPropagation()
    if (!useStore.getState().entered) return

    const now = performance.now()
    clicks.current.count = now - clicks.current.last < EMOTE_WINDOW_MS ? clicks.current.count + 1 : 1
    clicks.current.last = now

    if (clicks.current.count >= EMOTE_CLICKS && !emote.current.running) {
      clicks.current.count = 0
      emote.current = { running: true, elapsed: 0 }
      sfx.emit('discover')
    }

    if (import.meta.env.DEV) {
      window.__emote = { clicks: clicks.current.count, running: emote.current.running }
    }
  }

  useGroundedFeet(group, offset)
  useIdleShowcase(offset, ring, emote)

  // A warm pool that stays lit once every spark has been found.
  const found = useStore((s) => s.found)
  const complete = found.length >= collectibleCount
  useFrame((_, delta) => {
    const mesh = aura.current
    if (!mesh) return
    const target = complete ? 0.42 : 0
    mesh.material.opacity += (target - mesh.material.opacity) * Math.min(1, delta * 2)
    mesh.visible = mesh.material.opacity > 0.01
  })

  return (
    <group ref={group} {...props} dispose={null}>
      <group ref={offset} rotation={[0, MODEL_YAW_OFFSET, 0]} position={[0, MODEL_FOOT_OFFSET, 0]}>
        <primitive object={model} scale={0.38} />
      </group>

      {/* The click target. A capsule rather than the model itself: raycasting a
          skinned mesh means walking its skeleton on every click, and this is a
          shape that can't miss the middle of the character. Transparent rather
          than `visible={false}`, because an invisible object is still a
          raycast target in three but the two behave differently enough across
          versions that it isn't worth relying on. */}
      <mesh onClick={onCharacterClick} position={[0, MODEL_FOOT_OFFSET + 0.85, 0]}>
        <capsuleGeometry args={[0.42, 0.9, 4, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Spotlight pool, only while waiting to be clicked. */}
      <mesh
        ref={ring}
        position={[0, MODEL_FOOT_OFFSET + 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={3}
      >
        <circleGeometry args={[1.15, 48]} />
        <meshBasicMaterial
          color="#ffc98a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      {/* The reward glow. Same trick, different colour and it never fades out. */}
      <mesh
        ref={aura}
        position={[0, MODEL_FOOT_OFFSET + 0.03, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
        visible={false}
      >
        <circleGeometry args={[0.95, 40]} />
        <meshBasicMaterial
          color="#ffd98a"
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
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

    // Straight off the body rather than differenced from the position above:
    // the float spring and the physics interpolation both show up in position
    // deltas, and footsteps keyed to those would tick while standing still.
    const v = rigid.linvel()
    playerMotion.speed = Math.hypot(v.x, v.z)
    playerMotion.grounded = y - terrainHeight(x, z) < REST_HEIGHT + 0.45

    if (import.meta.env.DEV) {
      // Lets the screenshot harness compare where the player actually is
      // against where the terrain function says the ground should be.
      window.__player = { x, y, z, ground: terrainHeight(x, z) }

      // Per-frame peak-to-peak over a rolling window. Sampling window.__player
      // from outside can't see this — the shake happens between frames, and a
      // slow poll just aliases it away.
      const w = (window.__jitterWindow ??= [])
      w.push([x, y, z])
      if (w.length > 90) w.shift()
      const span = (i) => Math.max(...w.map((p) => p[i])) - Math.min(...w.map((p) => p[i]))
      window.__jitter = { x: span(0), y: span(1), z: span(2), frames: w.length }
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
  const [, getKeys] = useKeyboardControls()

  /**
   * Movement is switched off while a zone's DOM panel is open.
   *
   * The guestbook is a form, and drei's KeyboardControls keeps recording WASD
   * and Space no matter where focus is — so typing a message used to walk the
   * character off the platform and jump. `isTyping()` guards the handlers that
   * *subscribe* to keys; this stops the one that reads them every frame.
   *
   * ecctrl's `disableControl` returns out of its frame loop after the camera
   * work, so the follow camera still tracks and dragging to look around still
   * works — which matters here, because the lanterns are overhead.
   */
  const openZone = useStore((s) => s.openZone)
  const panelOpen = Boolean(zoneById[openZone]?.panel)

  // Spawn already standing. `?at=x,z` in dev drops you anywhere on the island,
  // which beats walking across it to check one corner.
  const start = useMemo(() => {
    let [x, , z] = spawn
    if (import.meta.env.DEV) {
      const at = new URLSearchParams(window.location.search).get('at')
      const parts = at?.split(',').map(Number)
      if (parts?.length === 2 && parts.every(Number.isFinite)) [x, z] = parts
    }
    return [x, terrainHeight(x, z) + REST_HEIGHT, z]
  }, [])

  /**
   * Bring a genuinely idle character to a dead stop, once per *physics step*.
   *
   * ecctrl floats the capsule on a ray instead of resting it on the ground, so
   * nothing is touching anything and there's no contact friction. On a slope
   * the only brake is a drag impulse, and drag settles into equilibrium with
   * gravity rather than reaching zero — so the character creeps, the follow
   * camera creeps with it, and the whole world looks like it's drifting.
   *
   * This has to run per step rather than per frame: physics can take several
   * steps between renders, and anything applied per frame lets it slide
   * through the steps in between.
   */
  useBeforePhysicsStep(() => {
    const rigid = body.current?.group
    if (!rigid) return

    const keys = getKeys()
    if (keys.forward || keys.backward || keys.leftward || keys.rightward) return
    if (useJoystickControls.getState().curJoystickDis) return

    const v = rigid.linvel()
    const flat = Math.hypot(v.x, v.z)
    if (flat > 0 && flat < IDLE_SPEED) rigid.setLinvel({ x: 0, y: v.y, z: 0 }, false)
  })

  // If the player ends up in the sea, off the edge, or launched skyward, put
  // them back. The ceiling matters as much as the floor: a jump clears about
  // 1.5 units, so anything past 25 above the ground is the float spring having
  // gone unstable, and left alone it carries the camera up into the clouds.
  useFrame(() => {
    const rigid = body.current?.group
    if (!rigid) return

    const p = rigid.translation()
    const v = rigid.linvel()
    const speed = Math.hypot(v.x, v.y, v.z)


    // Kill a divergence in place before it becomes a launch.
    if (speed > 40) {
      rigid.setLinvel({ x: 0, y: 0, z: 0 }, true)
      return
    }

    const tooHigh = p.y > terrainHeight(p.x, p.z) + 25
    const drowned = p.y <= island.seaLevel - 8
    const strayed = Math.hypot(p.x, p.z) >= island.radius * 2.4
    if (!tooHigh && !drowned && !strayed) return

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
        disableControl={panelOpen}
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
        // The vertical spring is left exactly as it was through phases 2-5.
        // It isn't scaled by frame time, so stiffening it to chase idle motion
        // made it pump energy in rather than out on any hitch: the capsule
        // climbed 0.7 -> 2 -> 4 -> 8 -> 300 units in seconds and took the
        // camera into the cloud layer. Measured idle wobble on this axis is
        // 0.0013 units, so there is nothing here to fix anyway.
        springK={1.5}
        dampingC={0.16}

        // The idle shake was horizontal, not vertical: 0.30 on X and 0.24 on
        // Z. ecctrl floats the capsule on a ray rather than resting it on the
        // ground, so it has no contact friction and drifts down any slope.
        // This drag is the only thing braking it, and at the stock 0.15 it
        // was far too weak. Applied solely when there's no movement input and
        // the character is grounded, so walking is untouched.
        dragDampingC={0.42}

        // Off, not merely softened. ecctrl locks the body's rotations
        // outright when auto-balance is disabled, so the capsule is upright by
        // construction and there's no balance torque left to hunt. Facing
        // still works — that's driven on the character model, not the body.
        autoBalance={false}
      >
        <EcctrlAnimation characterURL={CHARACTER_URL} animationSet={ANIMATION_SET}>
          <CharacterModel />
        </EcctrlAnimation>
      </Ecctrl>
      <PositionReporter bodyRef={body} />
    </>
  )
}
