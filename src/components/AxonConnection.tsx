import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useActivationStore } from '../stores/activationStore'
import { useThinkingStore } from '../stores/thinkingStore'

// Simplified organic axon connection between neurons
// Uses basic materials for reliability

interface AxonConnectionProps {
  start: [number, number, number]
  end: [number, number, number]
  startColor: string
  endColor: string
  connectionId: string
  fromThoughtId: string
  toThoughtId: string
  strength?: number
}

export default function AxonConnection({
  start,
  end,
  startColor,
  endColor,
  connectionId,
  fromThoughtId,
  toThoughtId,
  strength = 0.5
}: AxonConnectionProps) {
  const tubeRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const particlesRef = useRef<THREE.Points>(null)
  
  // Get activation state
  const { getActivation: getNodeActivation } = useActivationStore()
  const { activePath, isThinking } = useThinkingStore()
  
  // Mix the colors
  const mixedColor = useMemo(() => {
    const c1 = new THREE.Color(startColor)
    const c2 = new THREE.Color(endColor)
    return c1.lerp(c2, 0.5)
  }, [startColor, endColor])
  
  // Create organic curved path
  const { curve, particleCount } = useMemo(() => {
    const startVec = new THREE.Vector3(...start)
    const endVec = new THREE.Vector3(...end)
    const distance = startVec.distanceTo(endVec)

    // Mid point with offset for curve
    const mid = new THREE.Vector3().lerpVectors(startVec, endVec, 0.5)

    // Use connectionId to seed the curve variation
    let seedNum = 0
    for (let i = 0; i < connectionId.length; i++) {
      seedNum = ((seedNum << 5) - seedNum) + connectionId.charCodeAt(i)
      seedNum |= 0
    }
    const seedFrac = Math.abs(seedNum % 1000) / 1000

    // Add organic offset to midpoint
    mid.x += (seedFrac - 0.5) * distance * 0.2
    mid.y += ((seedFrac * 2) % 1 - 0.5) * distance * 0.15
    mid.z += ((seedFrac * 3) % 1 - 0.5) * distance * 0.15

    const curve = new THREE.QuadraticBezierCurve3(startVec, mid, endVec)

    // More particles for stronger connections
    const baseParticles = 10
    const strengthParticles = Math.floor(strength * 20)

    return { curve, particleCount: baseParticles + strengthParticles }
  }, [start, end, connectionId, strength])
  
  // Check if this connection is in the thinking path
  const isInThinkingPath = useMemo(() => {
    if (!isThinking || activePath.length < 2) return false
    
    for (let i = 0; i < activePath.length - 1; i++) {
      if ((activePath[i] === fromThoughtId && activePath[i + 1] === toThoughtId) ||
          (activePath[i] === toThoughtId && activePath[i + 1] === fromThoughtId)) {
        return true
      }
    }
    return false
  }, [isThinking, activePath, fromThoughtId, toThoughtId])
  
  // Particle positions state
  const particlePositionsRef = useRef(new Float32Array(particleCount * 3))
  
  useFrame((state) => {
    const t = state.clock.elapsedTime
    
    // Get activation from connected nodes
    const fromActivation = getNodeActivation(fromThoughtId)
    const toActivation = getNodeActivation(toThoughtId)
    const nodeActivation = (fromActivation + toActivation) / 2
    
    // Thinking path boost
    const thinkingBoost = isInThinkingPath ? 1.0 : 0
    
    // Combined activation
    const combinedActivation = Math.max(0.1, nodeActivation, thinkingBoost)
    
    // Update tube opacity
    if (tubeRef.current) {
      const mat = tubeRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.15 + combinedActivation * 0.35
    }
    
    // Update glow
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.05 + combinedActivation * 0.1
    }
    
    // Animate particles flowing along the connection
    if (particlesRef.current) {
      const positions = particlePositionsRef.current
      const speed = 0.2 + combinedActivation * 0.3
      
      for (let i = 0; i < particleCount; i++) {
        const baseT = i / particleCount
        const animatedT = (baseT + t * speed) % 1
        const point = curve.getPoint(animatedT)
        
        positions[i * 3] = point.x
        positions[i * 3 + 1] = point.y
        positions[i * 3 + 2] = point.z
      }
      
      particlesRef.current.geometry.attributes.position.needsUpdate = true
      
      const mat = particlesRef.current.material as THREE.PointsMaterial
      mat.opacity = 0.3 + combinedActivation * 0.5
      mat.size = 0.08 + combinedActivation * 0.08
      
      // White particles when in thinking path
      if (isInThinkingPath) {
        mat.color.setHex(0xffffff)
      } else {
        mat.color.copy(mixedColor)
      }
    }
  })
  
  // Initialize particle positions
  const initialParticlePositions = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    for (let i = 0; i < particleCount; i++) {
      const t = i / particleCount
      const point = curve.getPoint(t)
      positions[i * 3] = point.x
      positions[i * 3 + 1] = point.y
      positions[i * 3 + 2] = point.z
    }
    particlePositionsRef.current = positions
    return positions
  }, [curve, particleCount])
  
  // Scale tube radius with strength (stronger = thicker)
  const tubeRadius = 0.02 + strength * 0.06

  // More glow for stronger connections
  const glowMultiplier = 2.5 + strength * 2

  return (
    <group>
      {/* Outer glow tube - larger for strong connections */}
      <mesh ref={glowRef}>
        <tubeGeometry args={[curve, 20, tubeRadius * glowMultiplier, 6, false]} />
        <meshBasicMaterial
          color={mixedColor}
          transparent
          opacity={0.05 + strength * 0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Main tube */}
      <mesh ref={tubeRef}>
        <tubeGeometry args={[curve, 32, tubeRadius, 8, false]} />
        <meshBasicMaterial
          color={mixedColor}
          transparent
          opacity={0.2 + strength * 0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Energy particles flowing along */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={initialParticlePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          color={mixedColor}
          size={0.12}
          transparent
          opacity={0.6}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  )
}
