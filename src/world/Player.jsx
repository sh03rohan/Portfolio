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

function CharacterModel(props) {
  const group = useRef()
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

  return (
    <group ref={group} {...props} dispose={null}>
      {/* Feet on the floor of the physics capsule, facing forward. */}
      <primitive object={model} scale={0.38} position={[0, -0.85, 0]} rotation={[0, Math.PI, 0]} />
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
        capsuleHalfHeight={0.42}
        capsuleRadius={0.34}
        floatHeight={0.36}
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
        springK={1.5}
        dampingC={0.16}
      >
        <EcctrlAnimation characterURL={CHARACTER_URL} animationSet={ANIMATION_SET}>
          <CharacterModel />
        </EcctrlAnimation>
      </Ecctrl>
      <PositionReporter bodyRef={body} />
    </>
  )
}
