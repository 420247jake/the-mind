import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface PulseRing {
  id: string
  position: THREE.Vector3
  color: string
  startTime: number
  scale: number
}

// Expanding ring effect when thoughts activate
function PulseRing({ position, color, startTime, onComplete }: {
  position: THREE.Vector3
  color: string
  startTime: number
  onComplete: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)

  const shaderMaterial = useRef(
    new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(color) },
        progress: { value: 0 },
        thickness: { value: 0.15 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float progress;
        uniform float thickness;
        varying vec2 vUv;

        void main() {
          vec2 center = vec2(0.5);
          float dist = length(vUv - center) * 2.0;

          // Ring expands outward
          float ringPos = progress;
          float ring = smoothstep(ringPos - thickness, ringPos, dist) *
                       smoothstep(ringPos + thickness, ringPos, dist);

          // Fade out as it expands
          float alpha = ring * (1.0 - progress) * 2.0;

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    })
  ).current

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime - startTime
    const duration = 1.5 // seconds
    const progress = Math.min(elapsed / duration, 1)

    shaderMaterial.uniforms.progress.value = progress

    if (meshRef.current) {
      // Scale up as it expands
      const scale = 2 + progress * 15
      meshRef.current.scale.setScalar(scale)

      // Always face camera
      meshRef.current.quaternion.copy(state.camera.quaternion)
    }

    if (progress >= 1) {
      onComplete()
    }
  })

  return (
    <mesh ref={meshRef} position={position} material={shaderMaterial}>
      <planeGeometry args={[1, 1, 1, 1]} />
    </mesh>
  )
}

// Manager component that creates pulses
export default function ThoughtPulseManager() {
  const [pulses, setPulses] = useState<PulseRing[]>([])
  const clockRef = useRef<THREE.Clock | null>(null)

  // Expose trigger function globally
  useEffect(() => {
    // @ts-ignore - Global pulse trigger
    window.triggerThoughtPulse = (x: number, y: number, z: number, color: string) => {
      const id = Math.random().toString(36).substr(2, 9)
      const position = new THREE.Vector3(x, y, z)

      setPulses(prev => [...prev, {
        id,
        position,
        color,
        startTime: clockRef.current?.elapsedTime || 0,
        scale: 1
      }])
    }

    return () => {
      // @ts-ignore
      delete window.triggerThoughtPulse
    }
  }, [])

  useFrame((state) => {
    if (!clockRef.current) {
      clockRef.current = state.clock
    }
  })

  const removePulse = (id: string) => {
    setPulses(prev => prev.filter(p => p.id !== id))
  }

  return (
    <group>
      {pulses.map(pulse => (
        <PulseRing
          key={pulse.id}
          position={pulse.position}
          color={pulse.color}
          startTime={pulse.startTime}
          onComplete={() => removePulse(pulse.id)}
        />
      ))}
    </group>
  )
}

// Helper to trigger pulse from anywhere
export function triggerPulse(position: { x: number, y: number, z: number }, color: string) {
  // @ts-ignore
  if (window.triggerThoughtPulse) {
    // @ts-ignore
    window.triggerThoughtPulse(position.x, position.y, position.z, color)
  }
}
