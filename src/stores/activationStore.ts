import { create } from 'zustand'

// Node Activation System - "Motion-activated lights" for thoughts
// Nodes light up when accessed/created, then fade back to dormant over time

export interface NodeActivation {
  thoughtId: string
  level: number        // 0-1, current activation level
  lastActivatedAt: number  // timestamp
  decayStartsAt: number    // when to start fading
}

export interface ActivationState {
  // Map of thought ID -> activation data
  activations: Map<string, NodeActivation>
  
  // Global settings
  glowDuration: number      // How long node stays fully lit (ms) - default 30s
  decayDuration: number     // How long fade takes (ms) - default 60s
  proximityBoost: number    // Extra activation when camera is near (0-1)
  
  // Actions
  activateNode: (thoughtId: string, intensity?: number) => void
  activateNodes: (thoughtIds: string[], intensity?: number) => void
  setProximityActivation: (thoughtId: string, distance: number) => void
  getActivation: (thoughtId: string) => number
  tick: () => void  // Called each frame to decay activations
  
  // Settings
  setGlowDuration: (ms: number) => void
  setDecayDuration: (ms: number) => void
}

export const useActivationStore = create<ActivationState>((set, get) => ({
  activations: new Map(),
  glowDuration: 30000,    // 30 seconds fully lit
  decayDuration: 60000,   // 60 seconds to fade out
  proximityBoost: 0.3,    // 30% boost when close
  
  activateNode: (thoughtId: string, intensity: number = 1) => {
    const now = Date.now()
    const { glowDuration, activations } = get()
    
    const newActivations = new Map(activations)
    newActivations.set(thoughtId, {
      thoughtId,
      level: Math.min(1, intensity),
      lastActivatedAt: now,
      decayStartsAt: now + glowDuration,
    })
    
    set({ activations: newActivations })
  },
  
  activateNodes: (thoughtIds: string[], intensity: number = 1) => {
    const now = Date.now()
    const { glowDuration, activations } = get()
    
    const newActivations = new Map(activations)
    
    // Stagger activation slightly for visual effect
    thoughtIds.forEach((thoughtId, index) => {
      const staggerDelay = index * 200 // 200ms between each
      newActivations.set(thoughtId, {
        thoughtId,
        level: Math.min(1, intensity),
        lastActivatedAt: now + staggerDelay,
        decayStartsAt: now + staggerDelay + glowDuration,
      })
    })
    
    set({ activations: newActivations })
  },
  
  setProximityActivation: (thoughtId: string, distance: number) => {
    const { proximityBoost, activations } = get()
    const existing = activations.get(thoughtId)
    
    // Only apply proximity boost if not already highly activated
    // Closer = more boost (inverse relationship with distance)
    const maxProximityDistance = 20 // Units at which proximity starts affecting
    
    if (distance < maxProximityDistance) {
      const proximityLevel = (1 - (distance / maxProximityDistance)) * proximityBoost
      
      // Only update if proximity would increase current level
      if (!existing || existing.level < proximityLevel) {
        const now = Date.now()
        const newActivations = new Map(activations)
        newActivations.set(thoughtId, {
          thoughtId,
          level: Math.max(existing?.level || 0, proximityLevel),
          lastActivatedAt: existing?.lastActivatedAt || now,
          decayStartsAt: now + 2000, // Quick decay for proximity (2 seconds)
        })
        set({ activations: newActivations })
      }
    }
  },
  
  getActivation: (thoughtId: string) => {
    const { activations, decayDuration } = get()
    const activation = activations.get(thoughtId)
    
    if (!activation) return 0
    
    const now = Date.now()
    
    // Still in glow period
    if (now < activation.decayStartsAt) {
      return activation.level
    }
    
    // In decay period
    const decayElapsed = now - activation.decayStartsAt
    const decayProgress = Math.min(1, decayElapsed / decayDuration)
    
    // Smooth decay curve (ease out)
    const easedDecay = 1 - Math.pow(decayProgress, 2)
    
    return activation.level * easedDecay
  },
  
  tick: () => {
    // Clean up fully decayed activations
    const { activations, decayDuration } = get()
    const now = Date.now()
    
    let needsCleanup = false
    activations.forEach((activation) => {
      const decayElapsed = now - activation.decayStartsAt
      if (decayElapsed > decayDuration) {
        needsCleanup = true
      }
    })
    
    if (needsCleanup) {
      const newActivations = new Map<string, NodeActivation>()
      activations.forEach((activation, id) => {
        const decayElapsed = now - activation.decayStartsAt
        if (decayElapsed < decayDuration) {
          newActivations.set(id, activation)
        }
      })
      set({ activations: newActivations })
    }
  },
  
  setGlowDuration: (ms: number) => {
    set({ glowDuration: Math.max(1000, Math.min(300000, ms)) }) // 1s to 5min
  },
  
  setDecayDuration: (ms: number) => {
    set({ decayDuration: Math.max(1000, Math.min(300000, ms)) }) // 1s to 5min
  },
}))

// Helper to trigger activation from anywhere
export function activateThought(thoughtId: string, intensity?: number) {
  useActivationStore.getState().activateNode(thoughtId, intensity)
}

export function activateThoughts(thoughtIds: string[], intensity?: number) {
  useActivationStore.getState().activateNodes(thoughtIds, intensity)
}
