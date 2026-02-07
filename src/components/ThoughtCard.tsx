import { useState, useRef, useMemo, useEffect } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Thought } from '../types'
import { CATEGORY_COLORS } from '../types'
import { useThinkingStore } from '../stores/thinkingStore'
import { useActivationStore } from '../stores/activationStore'
import { useDreamStore } from '../stores/dreamStore'
import { useTimelineStore } from '../stores/timelineStore'
import NeuronNode from './NeuronNode'
import { triggerPulse } from './ThoughtPulse'

interface ThoughtCardProps {
  thought: Thought
  onClick?: () => void
  isHighlighted?: boolean
  isFocused?: boolean
  isUIOpen?: boolean
}

const CATEGORY_ICONS: Record<string, string> = {
  work: '💼',
  personal: '👤',
  technical: '⚙️',
  creative: '✨',
  other: '💭',
}

// Distance thresholds
const DISTANCE = {
  PANEL_FULL: 12,        // Panel fully visible, node hidden
  PANEL_FADE_START: 25,  // Panel starts fading in (was 15 - now earlier)
  NODE_FADE_START: 20,   // Node starts fading out (was 12)
  MAX_VISIBLE: 150,      // Beyond this, everything fades
}

export default function ThoughtCard({ thought, onClick, isHighlighted: _isHighlighted = false, isFocused = false, isUIOpen = false }: ThoughtCardProps) {
  const [hovered, setHovered] = useState(false)
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  
  // Get thinking state (for path visualization)
  const { getActivation: getThinkingActivation, synthesisId } = useThinkingStore()
  const thinkingActivation = getThinkingActivation(thought.id)
  const isSynthesis = thought.id === synthesisId
  
  // Get activation state (motion-activated lights)
  const { getActivation: getNodeActivation, setProximityActivation, tick: tickActivation } = useActivationStore()
  
  // Get dream state
  const { isActive: isDreaming, getDriftOffset, getGlitchOffset } = useDreamStore()
  
  // Get timeline state
  const { isActive: isTimeline, isVisible: isTimelineVisible, getVisibility: getTimelineVisibility } = useTimelineStore()
  const timelineVisibility = getTimelineVisibility(thought.createdAt)

  // State for visibility - must be before any conditional returns
  const [nodeOpacity, setNodeOpacity] = useState(1)
  const [panelOpacity, setPanelOpacity] = useState(0)
  const [, setDistance] = useState(100)

  const color = CATEGORY_COLORS[thought.category]
  const seed = useMemo(() => {
    let hash = 0
    for (let i = 0; i < thought.id.length; i++) {
      hash = ((hash << 5) - hash) + thought.id.charCodeAt(i)
      hash |= 0
    }
    return Math.abs(hash % 1000) / 1000
  }, [thought.id])
  
  // Base scale from importance
  const baseScale = 0.8 + thought.importance * 0.8
  
  // Recency glow - newer thoughts are brighter
  const recencyGlow = useMemo(() => {
    const age = Date.now() - new Date(thought.createdAt).getTime()
    const hoursSinceCreated = age / (1000 * 60 * 60)
    return Math.max(0.7, 1 - hoursSinceCreated / 72)
  }, [thought.createdAt])
  
  useFrame((state) => {
    if (!groupRef.current) return
    
    const t = state.clock.elapsedTime
    
    // Tick activation decay
    tickActivation()
    
    // Calculate distance
    const position = new THREE.Vector3(thought.position.x, thought.position.y, thought.position.z)
    const dist = camera.position.distanceTo(position)
    setDistance(dist)
    
    // Set proximity activation
    setProximityActivation(thought.id, dist)
    
    // Get combined activation
    const nodeActivation = getNodeActivation(thought.id)
    const dormantLevel = 0.15
    const combinedActivation = Math.max(dormantLevel, nodeActivation, thinkingActivation)
    
    // Dream drift
    const dreamDrift = getDriftOffset(seed, t)
    const glitchOffset = getGlitchOffset(t)
    
    // Apply position with drift
    const dreamScale = isDreaming ? 1 : 0
    
    groupRef.current.position.x = thought.position.x + dreamDrift.x * dreamScale + glitchOffset.x
    groupRef.current.position.y = thought.position.y + dreamDrift.y * dreamScale + glitchOffset.y
    groupRef.current.position.z = thought.position.z + dreamDrift.z * dreamScale + glitchOffset.z
    
    // Calculate opacities based on distance
    let newNodeOpacity = 1
    if (dist < DISTANCE.PANEL_FULL) {
      newNodeOpacity = 0
    } else if (dist < DISTANCE.NODE_FADE_START) {
      newNodeOpacity = (dist - DISTANCE.PANEL_FULL) / (DISTANCE.NODE_FADE_START - DISTANCE.PANEL_FULL)
    } else if (dist > DISTANCE.MAX_VISIBLE) {
      newNodeOpacity = Math.max(0, 1 - (dist - DISTANCE.MAX_VISIBLE) / 50)
    }
    
    let newPanelOpacity = 0
    if (dist < DISTANCE.PANEL_FULL) {
      newPanelOpacity = 1
    } else if (dist < DISTANCE.PANEL_FADE_START) {
      newPanelOpacity = 1 - (dist - DISTANCE.PANEL_FULL) / (DISTANCE.PANEL_FADE_START - DISTANCE.PANEL_FULL)
    }
    
    // Override for focused
    if (isFocused) {
      newNodeOpacity = 0
      newPanelOpacity = 1
    }
    
    // Highly activated nodes stay visible
    if (combinedActivation > 0.3) {
      newNodeOpacity = Math.max(newNodeOpacity, 0.7 * combinedActivation)
    }
    
    // Apply timeline visibility
    if (isTimeline) {
      newNodeOpacity *= timelineVisibility
      newPanelOpacity *= timelineVisibility
    }
    
    setNodeOpacity(newNodeOpacity)
    setPanelOpacity(newPanelOpacity)
    
    // Scale group based on activation
    const activationScale = 0.7 + combinedActivation * 0.3
    groupRef.current.scale.setScalar(activationScale)
  })
  
  // Get combined activation for NeuronNode
  const nodeActivation = getNodeActivation(thought.id)
  const combinedActivation = Math.max(0.15, nodeActivation, thinkingActivation)

  // Track previous activation to detect spikes
  const prevActivationRef = useRef(0)

  // Trigger pulse when activation spikes (thought becomes highly active)
  useEffect(() => {
    const wasLow = prevActivationRef.current < 0.4
    const isHigh = combinedActivation > 0.6

    if (wasLow && isHigh) {
      // Thought just became highly active - send a pulse!
      triggerPulse(thought.position, color)
    }

    prevActivationRef.current = combinedActivation
  }, [combinedActivation, thought.position, color])

  // If in timeline mode and this thought hasn't appeared yet, don't render
  // This check must be AFTER all hooks are called
  if (isTimeline && !isTimelineVisible(thought.createdAt)) {
    return null
  }

  // Set userData on the group so raycasts can identify this thought
  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.userData.thoughtId = thought.id
      // Also set on all children recursively
      groupRef.current.traverse((child) => {
        child.userData.thoughtId = thought.id
      })
    }
  }, [thought.id])

  return (
    <group ref={groupRef} position={[thought.position.x, thought.position.y, thought.position.z]}>
      {/* Organic Neuron Node */}
      {nodeOpacity > 0 && (
        <group
          onClick={(e) => {
            e.stopPropagation()
            onClick?.()
          }}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <NeuronNode
            position={[0, 0, 0]}
            color={color}
            scale={baseScale * (hovered ? 1.1 : 1) * (isSynthesis ? 1.3 : 1)}
            activation={combinedActivation * nodeOpacity * recencyGlow}
            seed={seed}
          />
          
          {/* Thinking ring for path visualization */}
          {thinkingActivation > 0.3 && (
            <mesh rotation={[Math.PI / 2, 0, 0]} scale={baseScale * 2}>
              <torusGeometry args={[1.2, 0.05, 8, 32]} />
              <meshBasicMaterial
                color={isSynthesis ? '#FFD700' : '#FFFFFF'}
                transparent
                opacity={thinkingActivation * 0.6 * nodeOpacity}
                depthWrite={false}
              />
            </mesh>
          )}
        </group>
      )}
      
      {/* Info panel when close */}
      {panelOpacity > 0 && !isUIOpen && (
        <Html
          center
          distanceFactor={15}
          style={{
            opacity: panelOpacity,
            transition: 'opacity 0.3s',
            pointerEvents: 'none', // Disable pointer events on panels - click through to canvas
          }}
        >
          <div 
            className="relative p-4 rounded-2xl backdrop-blur-xl bg-black/60 border border-white/10 shadow-2xl"
            style={{
              width: '280px',
              transform: 'translateZ(0)',
            }}
          >
            {/* Category indicator */}
            <div 
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-lg"
              style={{ 
                background: `linear-gradient(135deg, ${color}, ${color}88)`,
                boxShadow: `0 0 20px ${color}66`
              }}
            >
              {CATEGORY_ICONS[thought.category]}
            </div>
            
            {/* Content */}
            <p className="text-white/90 text-sm leading-relaxed font-medium mb-3">
              {thought.content}
            </p>
            
            {/* Meta info */}
            <div className="flex items-center gap-2 text-xs text-white/40">
              <span 
                className="px-2 py-0.5 rounded-full text-white/70"
                style={{ background: `${color}33` }}
              >
                {thought.category}
              </span>
              <span>•</span>
              <span>{Math.round(thought.importance * 100)}% importance</span>
            </div>
            
            {/* Decorative glow */}
            <div 
              className="absolute inset-0 -z-10 rounded-2xl opacity-30 blur-xl"
              style={{ background: color }}
            />
          </div>
        </Html>
      )}
    </group>
  )
}
