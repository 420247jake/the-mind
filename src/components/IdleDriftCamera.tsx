import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useIdleStore } from '../stores/idleStore'
import { useWallpaperStore } from '../stores/wallpaperStore'

/**
 * IdleDriftCamera - Gentle screensaver-like drift when user is idle.
 *
 * Reuses the same orbit/drift math as WallpaperCamera but:
 * - Activates on idle timeout (not F10)
 * - Does NOT enter wallpaper mode (no window embedding)
 * - Smooth lerps back to saved position when input resumes
 * - Mutually exclusive with wallpaper mode (wallpaper takes priority)
 */
export default function IdleDriftCamera() {
  const { camera } = useThree()
  const isIdle = useIdleStore(s => s.isIdle)
  const isWallpaperMode = useWallpaperStore(s => s.isWallpaperMode)
  const { orbitSpeed, driftAmount } = useWallpaperStore()

  const timeRef = useRef(0)
  const activeRef = useRef(false)
  const returningRef = useRef(false)

  // Saved camera state before drift started
  const savedPos = useRef(new THREE.Vector3())
  const savedQuat = useRef(new THREE.Quaternion())

  // Orbit parameters
  const orbitCenter = useRef(new THREE.Vector3())
  const orbitRadius = useRef(30)
  const baseAngle = useRef(0)
  const baseY = useRef(0)

  // Activate/deactivate drift
  useEffect(() => {
    const shouldDrift = isIdle && !isWallpaperMode

    if (shouldDrift && !activeRef.current) {
      // Save current camera state
      savedPos.current.copy(camera.position)
      savedQuat.current.copy(camera.quaternion)

      // Calculate orbit center — point 30 units in front of camera
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      orbitCenter.current.set(
        camera.position.x + direction.x * 30,
        camera.position.y + direction.y * 30,
        camera.position.z + direction.z * 30
      )

      // Calculate starting angle from camera to center (XZ plane)
      const toCamera = new THREE.Vector3(
        camera.position.x - orbitCenter.current.x,
        0,
        camera.position.z - orbitCenter.current.z
      )
      baseAngle.current = Math.atan2(toCamera.x, toCamera.z)
      baseY.current = camera.position.y
      orbitRadius.current = 30

      activeRef.current = true
      returningRef.current = false
      timeRef.current = 0
    }

    if (!shouldDrift && activeRef.current) {
      // Start returning to saved position
      activeRef.current = false
      returningRef.current = true
    }
  }, [isIdle, isWallpaperMode, camera])

  useFrame((_, delta) => {
    // Smooth return to saved position
    if (returningRef.current) {
      camera.position.lerp(savedPos.current, 0.08)
      camera.quaternion.slerp(savedQuat.current, 0.08)

      // Close enough — snap and stop
      if (camera.position.distanceTo(savedPos.current) < 0.1) {
        camera.position.copy(savedPos.current)
        camera.quaternion.copy(savedQuat.current)
        returningRef.current = false
      }
      return
    }

    if (!activeRef.current) return

    timeRef.current += delta
    const t = timeRef.current

    // Slow orbit around the center point
    const angle = baseAngle.current + t * orbitSpeed

    // Gentle vertical drift (sine wave)
    const verticalDrift = Math.sin(t * 0.1) * driftAmount * 0.5

    // Subtle radial breathing (in/out)
    const radiusVariation = Math.sin(t * 0.15) * driftAmount * 0.3
    const currentRadius = orbitRadius.current + radiusVariation

    // Calculate target position
    const newX = orbitCenter.current.x + Math.sin(angle) * currentRadius
    const newY = baseY.current + verticalDrift
    const newZ = orbitCenter.current.z + Math.cos(angle) * currentRadius

    // Smooth interpolation for buttery movement
    camera.position.x += (newX - camera.position.x) * 0.02
    camera.position.y += (newY - camera.position.y) * 0.02
    camera.position.z += (newZ - camera.position.z) * 0.02

    // Always look at the center with slight vertical variation
    const lookTarget = new THREE.Vector3(
      orbitCenter.current.x,
      orbitCenter.current.y + Math.sin(t * 0.08) * 2,
      orbitCenter.current.z
    )

    // Smooth look-at
    const currentLookDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    const targetLookDir = lookTarget.clone().sub(camera.position).normalize()
    currentLookDir.lerp(targetLookDir, 0.02)
    camera.lookAt(camera.position.clone().add(currentLookDir.multiplyScalar(10)))
  })

  return null
}
