import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Realistic neuron with branching dendrites
// Matches reference images with organic cell body and long extending branches

interface NeuronNodeProps {
  position: [number, number, number]
  color: string
  scale?: number
  activation?: number
  seed?: number
}

// Generate a branching dendrite tree recursively
function generateDendriteBranches(
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  length: number,
  thickness: number,
  depth: number,
  seed: number,
  branches: Array<{ start: THREE.Vector3; end: THREE.Vector3; thickness: number }>
) {
  if (depth <= 0 || length < 0.1) return
  
  // Create this branch segment
  const end = origin.clone().add(direction.clone().multiplyScalar(length))
  branches.push({ start: origin.clone(), end: end.clone(), thickness })
  
  // Pseudo-random based on seed
  const rand = (s: number) => {
    const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453
    return x - Math.floor(x)
  }
  
  // Spawn child branches
  const numChildren = depth > 1 ? Math.floor(rand(seed + depth) * 2) + 1 : 0
  
  for (let i = 0; i < numChildren; i++) {
    // Vary the direction
    const childSeed = seed + i * 100 + depth * 10
    const angleX = (rand(childSeed) - 0.5) * Math.PI * 0.6
    const angleY = (rand(childSeed + 1) - 0.5) * Math.PI * 0.6
    
    const childDir = direction.clone()
    childDir.applyAxisAngle(new THREE.Vector3(1, 0, 0), angleX)
    childDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angleY)
    childDir.normalize()
    
    generateDendriteBranches(
      end,
      childDir,
      length * (0.5 + rand(childSeed + 2) * 0.3),
      thickness * 0.6,
      depth - 1,
      childSeed,
      branches
    )
  }
}

export default function NeuronNode({ 
  position, 
  color, 
  scale = 1, 
  activation = 0.3,
  seed = 0,
}: NeuronNodeProps) {
  const groupRef = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const bodyRef = useRef<THREE.Mesh>(null)
  const outerGlowRef = useRef<THREE.Mesh>(null)
  
  const brightColor = useMemo(() => new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5), [color])
  
  // Generate all dendrite branches
  const dendriteBranches = useMemo(() => {
    const branches: Array<{ start: THREE.Vector3; end: THREE.Vector3; thickness: number }> = []
    
    // Pseudo-random
    const rand = (s: number) => {
      const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453
      return x - Math.floor(x)
    }
    
    // Generate 4-6 main dendrite stems
    const numStems = 4 + Math.floor(rand(seed * 1000) * 3)
    
    for (let i = 0; i < numStems; i++) {
      const stemSeed = seed * 1000 + i * 137
      
      // Distribute stems around the cell body
      const theta = (i / numStems) * Math.PI * 2 + rand(stemSeed) * 0.5
      const phi = Math.PI * 0.3 + rand(stemSeed + 1) * Math.PI * 0.4
      
      const direction = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      ).normalize()
      
      // Start from cell body surface
      const startPoint = direction.clone().multiplyScalar(0.5 * scale)
      
      // Main stem length
      const stemLength = (1.5 + rand(stemSeed + 2) * 1.5) * scale
      
      generateDendriteBranches(
        startPoint,
        direction,
        stemLength,
        0.08 * scale,
        3, // depth - creates branching
        stemSeed,
        branches
      )
    }
    
    return branches
  }, [seed, scale])
  
  // Create tube geometries for dendrites
  const dendriteGeometries = useMemo(() => {
    return dendriteBranches.map(branch => {
      const curve = new THREE.LineCurve3(branch.start, branch.end)
      return {
        geometry: new THREE.TubeGeometry(curve, 4, branch.thickness, 6, false),
        thickness: branch.thickness
      }
    })
  }, [dendriteBranches])
  
  useFrame((state) => {
    const t = state.clock.elapsedTime
    
    // Pulse the bright core
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 3 + seed * 10) * 0.15 * activation
      coreRef.current.scale.setScalar(pulse)
      const mat = coreRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.6 + activation * 0.4
    }
    
    // Subtle body pulse
    if (bodyRef.current) {
      const breath = 1 + Math.sin(t * 2 + seed * 5) * 0.05 * activation
      bodyRef.current.scale.setScalar(breath)
    }
    
    // Outer glow breathe
    if (outerGlowRef.current) {
      const breath = 1 + Math.sin(t * 1.5) * 0.1
      outerGlowRef.current.scale.setScalar(breath)
      const mat = outerGlowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.08 + activation * 0.12
    }
  })
  
  return (
    <group ref={groupRef} position={position}>
      {/* Large outer glow - volumetric feel */}
      <mesh ref={outerGlowRef} scale={2.5 * scale}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.12}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Cell body - irregular shape using icosahedron */}
      <mesh ref={bodyRef} scale={0.6 * scale}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3 + activation * 0.4}
          transparent
          opacity={0.85}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
      
      {/* Inner glow layer */}
      <mesh scale={0.5 * scale}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4 + activation * 0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Bright core */}
      <mesh ref={coreRef} scale={0.25 * scale}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial
          color={brightColor}
          transparent
          opacity={0.8}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Dendrite branches */}
      {dendriteGeometries.map((item, i) => (
        <mesh key={i} geometry={item.geometry}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5 + activation * 0.3}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
      
      {/* Synaptic terminals at branch ends */}
      {dendriteBranches
        .filter((_, i) => i % 3 === 0) // Only some branches get terminals
        .map((branch, i) => (
          <mesh 
            key={`terminal-${i}`} 
            position={[branch.end.x, branch.end.y, branch.end.z]}
            scale={0.06 * scale}
          >
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial
              color={brightColor}
              transparent
              opacity={0.6 + activation * 0.3}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}
    </group>
  )
}
