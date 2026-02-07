import { useState, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Crosshair states based on what we're looking at
type CrosshairState = 'idle' | 'sensing' | 'focusing' | 'locked'

interface MindCrosshairProps {
  onTargetChange?: (target: string | null, distance: number) => void
}

// The crosshair lives in screen space (HTML overlay)
export default function MindCrosshair({ onTargetChange }: MindCrosshairProps) {
  const [state, setState] = useState<CrosshairState>('idle')
  const [targetName, setTargetName] = useState<string | null>(null)
  const [distance, setDistance] = useState(100)
  const [pulsePhase, setPulsePhase] = useState(0)

  // Expose state globally so 3D components can update it
  useEffect(() => {
    // @ts-ignore
    window.updateCrosshair = (newState: CrosshairState, name: string | null, dist: number) => {
      setState(newState)
      setTargetName(name)
      setDistance(dist)
      onTargetChange?.(name, dist)
    }

    return () => {
      // @ts-ignore
      delete window.updateCrosshair
    }
  }, [onTargetChange])

  // Animate pulse
  useEffect(() => {
    let frame: number
    const animate = () => {
      setPulsePhase(p => (p + 0.05) % (Math.PI * 2))
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  const pulse = Math.sin(pulsePhase) * 0.5 + 0.5

  // Different visual states
  const getStateStyles = () => {
    switch (state) {
      case 'idle':
        // Minimal dot - just existing
        return {
          innerSize: 4,
          outerSize: 0,
          ringSize: 0,
          rotation: 0,
          opacity: 0.3,
          color: '#ffffff',
          glow: 0,
        }
      case 'sensing':
        // Something nearby - expanding awareness
        return {
          innerSize: 3,
          outerSize: 20 + pulse * 5,
          ringSize: 0,
          rotation: pulsePhase * 30,
          opacity: 0.5,
          color: '#88aaff',
          glow: 5,
        }
      case 'focusing':
        // Locking onto something - contracting
        return {
          innerSize: 5,
          outerSize: 15,
          ringSize: 25 + pulse * 3,
          rotation: -pulsePhase * 60,
          opacity: 0.7,
          color: '#44ddff',
          glow: 10,
        }
      case 'locked':
        // Fully focused - tight and bright
        return {
          innerSize: 6,
          outerSize: 12,
          ringSize: 18,
          rotation: pulsePhase * 90,
          opacity: 1,
          color: '#00ffaa',
          glow: 15,
        }
    }
  }

  const styles = getStateStyles()

  return (
    <div className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center">
      {/* Main crosshair container */}
      <div
        className="relative"
        style={{
          filter: `drop-shadow(0 0 ${styles.glow}px ${styles.color})`,
          transition: 'filter 0.3s ease-out',
        }}
      >
        {/* Center dot */}
        <div
          className="absolute rounded-full"
          style={{
            width: styles.innerSize,
            height: styles.innerSize,
            backgroundColor: styles.color,
            opacity: styles.opacity,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            transition: 'all 0.2s ease-out',
          }}
        />

        {/* Outer segments - 4 curved lines */}
        {styles.outerSize > 0 && (
          <div
            className="absolute"
            style={{
              width: styles.outerSize * 2,
              height: styles.outerSize * 2,
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) rotate(${styles.rotation}deg)`,
              transition: 'width 0.3s, height 0.3s',
            }}
          >
            {[0, 90, 180, 270].map((angle) => (
              <div
                key={angle}
                className="absolute"
                style={{
                  width: 2,
                  height: styles.outerSize * 0.4,
                  backgroundColor: styles.color,
                  opacity: styles.opacity * 0.8,
                  left: '50%',
                  top: '50%',
                  transformOrigin: 'center top',
                  transform: `translateX(-50%) rotate(${angle}deg) translateY(-${styles.outerSize * 0.3}px)`,
                  borderRadius: 1,
                  transition: 'all 0.2s ease-out',
                }}
              />
            ))}
          </div>
        )}

        {/* Focus ring - appears when focusing/locked */}
        {styles.ringSize > 0 && (
          <div
            className="absolute border-2 rounded-full"
            style={{
              width: styles.ringSize * 2,
              height: styles.ringSize * 2,
              borderColor: styles.color,
              opacity: styles.opacity * 0.5,
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) rotate(${-styles.rotation * 0.5}deg)`,
              transition: 'all 0.3s ease-out',
              borderStyle: state === 'locked' ? 'solid' : 'dashed',
            }}
          />
        )}

        {/* Corner brackets when locked */}
        {state === 'locked' && (
          <>
            {[
              { top: -20, left: -20, rotate: 0 },
              { top: -20, right: -20, rotate: 90 },
              { bottom: -20, right: -20, rotate: 180 },
              { bottom: -20, left: -20, rotate: 270 },
            ].map((pos, i) => {
              const { rotate, ...restPos } = pos
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    ...restPos,
                    width: 8,
                    height: 8,
                    borderLeft: `2px solid ${styles.color}`,
                    borderTop: `2px solid ${styles.color}`,
                    opacity: styles.opacity,
                    transform: `rotate(${rotate}deg)`,
                  }}
                />
              )
            })}
          </>
        )}

        {/* Thinking dots animation when sensing/focusing */}
        {(state === 'sensing' || state === 'focusing') && (
          <div className="absolute" style={{ left: '50%', top: '50%' }}>
            {[0, 1, 2].map((i) => {
              const angle = (pulsePhase + i * (Math.PI * 2 / 3))
              const radius = state === 'focusing' ? 30 : 35
              const x = Math.cos(angle) * radius
              const y = Math.sin(angle) * radius
              const dotOpacity = (Math.sin(angle * 2) * 0.5 + 0.5) * styles.opacity

              return (
                <div
                  key={i}
                  className="absolute rounded-full"
                  style={{
                    width: 4,
                    height: 4,
                    backgroundColor: styles.color,
                    opacity: dotOpacity,
                    transform: `translate(${x - 2}px, ${y - 2}px)`,
                    transition: 'opacity 0.1s',
                  }}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Target info label */}
      {targetName && state !== 'idle' && (
        <div
          className="absolute text-xs font-mono tracking-wider"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(30px, -50%)',
            color: styles.color,
            opacity: styles.opacity * 0.8,
            textShadow: `0 0 10px ${styles.color}`,
            whiteSpace: 'nowrap',
          }}
        >
          <div className="opacity-60">{distance.toFixed(1)}m</div>
        </div>
      )}
    </div>
  )
}

// Global crosshair target - stores the thought ID currently being aimed at
// This bridges the 3D raycaster with click handling outside the canvas
export const crosshairTarget = {
  thoughtId: null as string | null,
  distance: 100,
  state: 'idle' as CrosshairState,
}

// Helper component that goes inside Canvas to do raycasting
export function CrosshairRaycaster() {
  const { camera, scene } = useThree()
  const raycaster = useRef(new THREE.Raycaster())
  const prevState = useRef<CrosshairState>('idle')

  useFrame(() => {
    // Raycast from center of screen
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera)
    const intersects = raycaster.current.intersectObjects(scene.children, true)

    // Find first valid hit
    const validHit = intersects.find(hit =>
      hit.distance > 2 &&
      hit.object.type !== 'Line' &&
      hit.object.type !== 'Points' &&
      hit.object.visible
    )

    let newState: CrosshairState = 'idle'
    let targetName: string | null = null
    let distance = 100
    let thoughtId: string | null = null

    if (validHit) {
      distance = validHit.distance
      targetName = validHit.object.name || validHit.object.parent?.name || null

      // Walk up the scene graph to find a thoughtId in userData
      let obj: THREE.Object3D | null = validHit.object
      while (obj) {
        if (obj.userData?.thoughtId) {
          thoughtId = obj.userData.thoughtId
          break
        }
        obj = obj.parent
      }

      // Determine state based on distance
      if (distance < 8) {
        newState = 'locked'
      } else if (distance < 15) {
        newState = 'focusing'
      } else if (distance < 40) {
        newState = 'sensing'
      }
    }

    // Update global crosshair target
    crosshairTarget.thoughtId = thoughtId
    crosshairTarget.distance = distance
    crosshairTarget.state = newState

    // Update crosshair state
    // @ts-ignore
    if (window.updateCrosshair) {
      // @ts-ignore
      window.updateCrosshair(newState, targetName, distance)
    }

    prevState.current = newState
  })

  return null
}
