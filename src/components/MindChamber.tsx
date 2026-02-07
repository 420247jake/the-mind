import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Create brain-shaped geometry
function createBrainGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  
  const segments = 64
  const rings = 48
  const vertices: number[] = []
  const indices: number[] = []
  const normals: number[] = []
  
  const height = 35
  const width = 60
  const depth = 45
  
  for (let ring = 0; ring <= rings; ring++) {
    const v = ring / rings
    const phi = v * Math.PI
    
    for (let seg = 0; seg <= segments; seg++) {
      const u = seg / segments
      const theta = u * Math.PI * 2
      
      let x = Math.sin(phi) * Math.cos(theta) * width
      let y = Math.cos(phi) * height
      let z = Math.sin(phi) * Math.sin(theta) * depth
      
      // Central fissure
      const fissureDepth = 8
      const fissureWidth = 0.15
      const fissureInfluence = Math.exp(-Math.pow(Math.abs(theta - Math.PI) / fissureWidth, 2))
      const fissureInfluence2 = Math.exp(-Math.pow(Math.abs(theta) / fissureWidth, 2))
      const topInfluence = Math.max(0, 1 - Math.abs(phi - 0.3) * 3)
      
      if (phi < Math.PI * 0.7) {
        y -= (fissureInfluence + fissureInfluence2) * fissureDepth * topInfluence
      }
      
      // Subtle wrinkles
      const wrinkleFreq1 = 6
      const wrinkleFreq2 = 8
      const wrinkleAmp = 2
      const wrinkle = Math.sin(theta * wrinkleFreq1 + phi * 3) * 
                      Math.sin(phi * wrinkleFreq2) * 
                      wrinkleAmp * Math.sin(phi)
      
      const normalX = Math.sin(phi) * Math.cos(theta)
      const normalY = Math.cos(phi) * 0.6
      const normalZ = Math.sin(phi) * Math.sin(theta)
      
      x += normalX * wrinkle
      y += normalY * wrinkle * 0.5
      z += normalZ * wrinkle
      
      if (phi > Math.PI * 0.85) {
        const flattenFactor = (phi - Math.PI * 0.85) / (Math.PI * 0.15)
        y = y * (1 - flattenFactor * 0.5) - flattenFactor * 10
      }
      
      vertices.push(x, y, z)
      normals.push(normalX, normalY, normalZ)
    }
  }
  
  for (let ring = 0; ring < rings; ring++) {
    for (let seg = 0; seg < segments; seg++) {
      const a = ring * (segments + 1) + seg
      const b = a + segments + 1
      const c = a + 1
      const d = b + 1
      
      indices.push(a, b, c)
      indices.push(b, d, c)
    }
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  
  return geometry
}

// Get a point on the brain surface
function getBrainSurfacePoint(theta: number, phi: number, offset: number = 0): THREE.Vector3 {
  const height = 35 + offset
  const width = 60 + offset
  const depth = 45 + offset
  
  let x = Math.sin(phi) * Math.cos(theta) * width
  let y = Math.cos(phi) * height
  let z = Math.sin(phi) * Math.sin(theta) * depth
  
  // Apply same fissure logic
  const fissureDepth = 8
  const fissureWidth = 0.15
  const fissureInfluence = Math.exp(-Math.pow(Math.abs(theta - Math.PI) / fissureWidth, 2))
  const fissureInfluence2 = Math.exp(-Math.pow(Math.abs(theta) / fissureWidth, 2))
  const topInfluence = Math.max(0, 1 - Math.abs(phi - 0.3) * 3)
  
  if (phi < Math.PI * 0.7) {
    y -= (fissureInfluence + fissureInfluence2) * fissureDepth * topInfluence
  }
  
  return new THREE.Vector3(x, y, z)
}

// Brain wireframe
function BrainWireframe() {
  const meshRef = useRef<THREE.LineSegments>(null)
  const geometry = useMemo(() => {
    const brainGeo = createBrainGeometry()
    return new THREE.WireframeGeometry(brainGeo)
  }, [])
  
  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime
      const scale = 1 + Math.sin(t * 0.2) * 0.003
      meshRef.current.scale.setScalar(scale)
      
      const mat = meshRef.current.material as THREE.LineBasicMaterial
      mat.opacity = 0.05 + Math.sin(t * 0.3) * 0.01
    }
  })
  
  return (
    <lineSegments ref={meshRef} geometry={geometry}>
      <lineBasicMaterial color="#3B82F6" transparent opacity={0.06} />
    </lineSegments>
  )
}

// Surface lightning - crawls along the OUTSIDE of the brain
function SurfaceLightning({ id }: { id: number }) {
  const lineRef = useRef<THREE.Line>(null)
  const pointsRef = useRef<THREE.Vector3[]>([])
  const timeRef = useRef(0)
  const lifetimeRef = useRef(2 + Math.random() * 3) // Longer lifetime, slower
  const activeRef = useRef(Math.random() > 0.5)
  const startThetaRef = useRef(Math.random() * Math.PI * 2)
  const startPhiRef = useRef(0.3 + Math.random() * 0.5 * Math.PI)
  
  const colors = ['#00ffff', '#3B82F6', '#8B5CF6', '#00ff88']
  const color = colors[id % colors.length]
  
  // Generate path along brain surface
  const generateSurfacePath = () => {
    const points: THREE.Vector3[] = []
    const segments = 12
    
    let theta = startThetaRef.current
    let phi = startPhiRef.current
    
    for (let i = 0; i < segments; i++) {
      // Get point slightly outside brain surface
      const point = getBrainSurfacePoint(theta, phi, 2)
      points.push(point)
      
      // Crawl along surface
      theta += (Math.random() - 0.5) * 0.4
      phi += (Math.random() - 0.5) * 0.2
      phi = Math.max(0.2, Math.min(Math.PI * 0.8, phi))
    }
    
    return points
  }
  
  useMemo(() => {
    pointsRef.current = generateSurfacePath()
  }, [])
  
  useFrame((state, delta) => {
    timeRef.current += delta
    
    if (timeRef.current > lifetimeRef.current) {
      timeRef.current = 0
      lifetimeRef.current = 2 + Math.random() * 4
      startThetaRef.current = Math.random() * Math.PI * 2
      startPhiRef.current = 0.3 + Math.random() * 0.5 * Math.PI
      pointsRef.current = generateSurfacePath()
      activeRef.current = Math.random() > 0.6 // 40% chance to be active
      
      if (lineRef.current) {
        const positions = new Float32Array(pointsRef.current.flatMap(p => [p.x, p.y, p.z]))
        lineRef.current.geometry.setAttribute('position', 
          new THREE.Float32BufferAttribute(positions, 3))
      }
    }
    
    if (lineRef.current) {
      const mat = lineRef.current.material as THREE.LineBasicMaterial
      // Gentle pulse when active
      const pulse = activeRef.current ? 0.15 + Math.sin(state.clock.elapsedTime * 3 + id) * 0.1 : 0
      mat.opacity = pulse
    }
  })
  
  return (
    <primitive object={new THREE.Line()} ref={lineRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={pointsRef.current.length || 1}
          array={new Float32Array(pointsRef.current.length ? pointsRef.current.flatMap(p => [p.x, p.y, p.z]) : [0,0,0])}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color={color} 
        transparent
        opacity={0.2}
        blending={THREE.AdditiveBlending}
      />
    </primitive>
  )
}

// Surface electrical activity
function SurfaceActivity({ count = 5 }: { count?: number }) {
  return (
    <group>
      {Array.from({ length: count }, (_, i) => (
        <SurfaceLightning key={i} id={i} />
      ))}
    </group>
  )
}

// Sparse ambient particles
function BrainParticles({ count = 30 }: { count?: number }) {
  const particlesRef = useRef<THREE.Points>(null)
  
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      const r = Math.random() * 25
      
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r * 1.1
      pos[i * 3 + 1] = Math.cos(phi) * r * 0.6
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r * 0.8
    }
    
    return pos
  }, [count])
  
  useFrame((state) => {
    if (particlesRef.current) {
      const t = state.clock.elapsedTime
      particlesRef.current.rotation.y = t * 0.008
      
      const mat = particlesRef.current.material as THREE.PointsMaterial
      mat.opacity = 0.2 + Math.sin(t * 0.4) * 0.08
    }
  })
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#8B5CF6"
        size={0.1}
        transparent
        opacity={0.25}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// Main Brain Chamber
export default function MindChamber() {
  return (
    <group>
      <fog attach="fog" args={['#050508', 50, 140]} />
      
      <ambientLight intensity={0.1} />
      
      <pointLight position={[0, 25, 0]} intensity={0.25} color="#8B5CF6" distance={80} />
      <pointLight position={[35, 0, 0]} intensity={0.15} color="#3B82F6" distance={60} />
      <pointLight position={[-35, 0, 0]} intensity={0.15} color="#3B82F6" distance={60} />
      <pointLight position={[0, -20, 25]} intensity={0.1} color="#10B981" distance={50} />
      
      <BrainWireframe />
      <SurfaceActivity count={5} />
      <BrainParticles count={30} />
    </group>
  )
}
