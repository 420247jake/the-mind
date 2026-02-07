import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CATEGORY_COLORS } from '../types'
import type { ThoughtCategory } from '../types'

interface ClusterCloudProps {
  id: string
  name: string
  category: string
  center: [number, number, number]
  thoughtCount: number
}

/**
 * Translucent nebula sphere representing a cluster of related thoughts.
 * Sized by thought count, colored by category, gently pulsing.
 */
export default function ClusterCloud({ name: _name, category, center, thoughtCount }: ClusterCloudProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, [])

  // Base radius scales with thought count (min 5, max 25)
  const baseRadius = useMemo(() => {
    return Math.min(25, Math.max(5, Math.sqrt(thoughtCount) * 3))
  }, [thoughtCount])

  const color = CATEGORY_COLORS[category as ThoughtCategory] || CATEGORY_COLORS.other

  // Gentle pulsing animation
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t = clock.getElapsedTime()
    const pulse = 1 + Math.sin(t * 0.3 + phaseOffset) * 0.05
    meshRef.current.scale.setScalar(pulse)
  })

  return (
    <group position={center}>
      {/* Outer glow sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[baseRadius, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner core — slightly brighter */}
      <mesh>
        <sphereGeometry args={[baseRadius * 0.5, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.06}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Cluster label (only visible when close) */}
      {/* We skip 3D text here for performance — the nebula glow is the visual cue */}
    </group>
  )
}
