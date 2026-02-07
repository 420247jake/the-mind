import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useWallpaperStore } from '../stores/wallpaperStore'

/**
 * WallpaperCamera - Takes over camera control when in wallpaper mode
 *
 * Creates a slow, dreamy orbit/drift around the saved position
 * while keeping the general view of the mind space.
 */
export default function WallpaperCamera() {
  const { camera } = useThree()
  const { isWallpaperMode, savedPosition, savedRotation, orbitSpeed, driftAmount } = useWallpaperStore()

  const timeRef = useRef(0)
  const initializedRef = useRef(false)

  // Store the center point we orbit around (slightly in front of saved position)
  const orbitCenter = useRef(new THREE.Vector3())
  const orbitRadius = useRef(0)
  const baseAngle = useRef(0)

  // Initialize orbit parameters when entering wallpaper mode
  useEffect(() => {
    if (isWallpaperMode && !initializedRef.current) {
      // Calculate orbit center - point we were looking at
      const direction = new THREE.Vector3(0, 0, -1)
      direction.applyEuler(new THREE.Euler(
        savedRotation.x * Math.PI / 180,
        savedRotation.y * Math.PI / 180,
        0,
        'YXZ'
      ))

      // Center is about 30 units in front of saved position
      orbitCenter.current.set(
        savedPosition.x + direction.x * 30,
        savedPosition.y + direction.y * 30,
        savedPosition.z + direction.z * 30
      )

      // Orbit radius is distance from saved position to center
      orbitRadius.current = 30

      // Calculate starting angle
      const toCamera = new THREE.Vector3(
        savedPosition.x - orbitCenter.current.x,
        0,
        savedPosition.z - orbitCenter.current.z
      )
      baseAngle.current = Math.atan2(toCamera.x, toCamera.z)

      // Set camera to saved position
      camera.position.set(savedPosition.x, savedPosition.y, savedPosition.z)

      initializedRef.current = true
      timeRef.current = 0

      console.log('🎬 Wallpaper camera initialized:', {
        position: savedPosition,
        center: orbitCenter.current,
        radius: orbitRadius.current
      })
    }

    if (!isWallpaperMode) {
      initializedRef.current = false
    }
  }, [isWallpaperMode, savedPosition, savedRotation, camera])

  useFrame((_, delta) => {
    if (!isWallpaperMode || !initializedRef.current) return

    timeRef.current += delta
    const t = timeRef.current

    // Slow orbit around the center point
    const angle = baseAngle.current + t * orbitSpeed

    // Add gentle vertical drift (sine wave)
    const verticalDrift = Math.sin(t * 0.1) * driftAmount * 0.5

    // Add subtle radial breathing (in/out)
    const radiusVariation = Math.sin(t * 0.15) * driftAmount * 0.3
    const currentRadius = orbitRadius.current + radiusVariation

    // Calculate new position
    const newX = orbitCenter.current.x + Math.sin(angle) * currentRadius
    const newY = savedPosition.y + verticalDrift
    const newZ = orbitCenter.current.z + Math.cos(angle) * currentRadius

    // Smooth interpolation for buttery movement
    camera.position.x += (newX - camera.position.x) * 0.02
    camera.position.y += (newY - camera.position.y) * 0.02
    camera.position.z += (newZ - camera.position.z) * 0.02

    // Always look at the center with slight up/down variation
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
