import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface AmbientParticlesProps {
  count?: number
  bounds?: number
  color?: string
}

// Floating particles that represent background cognitive activity
// They drift slowly, occasionally sparking brighter when near active thoughts
export default function AmbientParticles({
  count = 500,
  bounds = 80,
  color = '#4488ff'
}: AmbientParticlesProps) {
  const meshRef = useRef<THREE.Points>(null)
  const timeRef = useRef(0)

  // Create particle positions and attributes
  const { positions, velocities, phases, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      // Random position in sphere
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = Math.random() * bounds

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Slow drift velocity
      velocities[i * 3] = (Math.random() - 0.5) * 0.02
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02

      // Random phase for twinkling
      phases[i] = Math.random() * Math.PI * 2

      // Random size variation
      sizes[i] = 0.5 + Math.random() * 1.5
    }

    return { positions, velocities, phases, sizes }
  }, [count, bounds])

  // Custom shader for particles with glow
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(color) },
        opacity: { value: 0.6 }
      },
      vertexShader: `
        attribute float phase;
        attribute float size;
        varying float vAlpha;
        uniform float time;

        void main() {
          vAlpha = 0.3 + 0.7 * (0.5 + 0.5 * sin(time * 0.5 + phase * 6.28));

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        varying float vAlpha;

        void main() {
          // Soft circle with glow falloff
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;

          float alpha = smoothstep(0.5, 0.0, dist) * vAlpha * opacity;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  }, [color])

  useFrame((_, delta) => {
    if (!meshRef.current) return

    timeRef.current += delta
    shaderMaterial.uniforms.time.value = timeRef.current

    const positions = meshRef.current.geometry.attributes.position.array as Float32Array

    // Drift particles slowly
    for (let i = 0; i < count; i++) {
      positions[i * 3] += velocities[i * 3]
      positions[i * 3 + 1] += velocities[i * 3 + 1]
      positions[i * 3 + 2] += velocities[i * 3 + 2]

      // Wrap around bounds
      for (let j = 0; j < 3; j++) {
        if (Math.abs(positions[i * 3 + j]) > bounds) {
          positions[i * 3 + j] *= -0.9
        }
      }
    }

    meshRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={meshRef} material={shaderMaterial}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-phase"
          count={count}
          array={phases}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
    </points>
  )
}
