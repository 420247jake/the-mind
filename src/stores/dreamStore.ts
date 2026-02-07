import { create } from 'zustand'
import { useActivationStore } from './activationStore'

// Dream Mode - Ambient visualization where thoughts drift and spark randomly
// Like watching your mind dream - memories surfacing on their own

export type DreamIntensity = 'calm' | 'vivid' | 'nightmare'

export interface DreamState {
  // Is dream mode active?
  isActive: boolean
  
  // Dream intensity level
  intensity: DreamIntensity
  
  // How often random thoughts spark (ms)
  sparkInterval: number
  
  // How many thoughts spark at once
  sparkCount: number
  
  // Drift speed multiplier
  driftSpeed: number
  
  // Connection pulse rate
  pulseRate: number
  
  // Nightmare-specific
  glitchEnabled: boolean
  chaosLevel: number  // 0-1, affects randomness
  
  // Internal state
  lastSparkTime: number
  activeSparkIds: string[]
  
  // Actions
  enterDream: (intensity?: DreamIntensity) => void
  exitDream: () => void
  setIntensity: (intensity: DreamIntensity) => void
  tick: (thoughtIds: string[], delta: number) => void
  
  // Getters
  getDriftOffset: (seed: number, time: number) => { x: number; y: number; z: number }
  getGlitchOffset: (time: number) => { x: number; y: number; z: number }
}

// Intensity presets
const INTENSITY_PRESETS: Record<DreamIntensity, {
  sparkInterval: number
  sparkCount: number
  driftSpeed: number
  pulseRate: number
  glitchEnabled: boolean
  chaosLevel: number
}> = {
  calm: {
    sparkInterval: 5000,    // Spark every 5 seconds
    sparkCount: 1,          // One thought at a time
    driftSpeed: 0.3,        // Slow, gentle drift
    pulseRate: 0.5,         // Slow pulse
    glitchEnabled: false,
    chaosLevel: 0,
  },
  vivid: {
    sparkInterval: 2500,    // Spark every 2.5 seconds
    sparkCount: 2,          // Two thoughts at a time
    driftSpeed: 0.6,        // Moderate drift
    pulseRate: 1.0,         // Normal pulse
    glitchEnabled: false,
    chaosLevel: 0.2,
  },
  nightmare: {
    sparkInterval: 800,     // Rapid sparking
    sparkCount: 4,          // Multiple thoughts firing
    driftSpeed: 1.5,        // Fast, erratic drift
    pulseRate: 2.5,         // Rapid pulse
    glitchEnabled: true,    // Glitch effects
    chaosLevel: 0.8,        // High chaos
  },
}

export const useDreamStore = create<DreamState>((set, get) => ({
  isActive: false,
  intensity: 'calm',
  sparkInterval: 5000,
  sparkCount: 1,
  driftSpeed: 0.3,
  pulseRate: 0.5,
  glitchEnabled: false,
  chaosLevel: 0,
  lastSparkTime: 0,
  activeSparkIds: [],
  
  enterDream: (intensity: DreamIntensity = 'calm') => {
    const preset = INTENSITY_PRESETS[intensity]
    set({
      isActive: true,
      intensity,
      ...preset,
      lastSparkTime: Date.now(),
      activeSparkIds: [],
    })
    console.log(`🌙 Entering dream mode: ${intensity}`)
  },
  
  exitDream: () => {
    set({
      isActive: false,
      activeSparkIds: [],
    })
    console.log('☀️ Exiting dream mode')
  },
  
  setIntensity: (intensity: DreamIntensity) => {
    const preset = INTENSITY_PRESETS[intensity]
    set({
      intensity,
      ...preset,
    })
    console.log(`🌙 Dream intensity changed to: ${intensity}`)
  },
  
  tick: (thoughtIds: string[], _delta: number) => {
    const state = get()
    if (!state.isActive || thoughtIds.length === 0) return
    
    const now = Date.now()
    const timeSinceLastSpark = now - state.lastSparkTime
    
    // Time to spark random thoughts?
    if (timeSinceLastSpark >= state.sparkInterval) {
      // Pick random thoughts to spark
      const shuffled = [...thoughtIds].sort(() => Math.random() - 0.5)
      const toSpark = shuffled.slice(0, Math.min(state.sparkCount, shuffled.length))
      
      // Activate them with varying intensities
      const activationStore = useActivationStore.getState()
      toSpark.forEach((id, index) => {
        // Stagger activation slightly
        setTimeout(() => {
          const intensity = state.intensity === 'nightmare' 
            ? 0.7 + Math.random() * 0.3  // High intensity for nightmare
            : 0.4 + Math.random() * 0.4  // Moderate for calm/vivid
          activationStore.activateNode(id, intensity)
        }, index * 150)
      })
      
      set({
        lastSparkTime: now,
        activeSparkIds: toSpark,
      })
    }
  },
  
  getDriftOffset: (seed: number, time: number) => {
    const state = get()
    if (!state.isActive) return { x: 0, y: 0, z: 0 }
    
    const speed = state.driftSpeed
    const chaos = state.chaosLevel
    
    // Base drift - smooth sine waves
    const baseX = Math.sin(time * 0.1 * speed + seed) * 2
    const baseY = Math.sin(time * 0.13 * speed + seed * 2) * 1.5
    const baseZ = Math.sin(time * 0.11 * speed + seed * 3) * 1
    
    // Add chaos for nightmare mode
    const chaosX = chaos * Math.sin(time * 2.3 + seed * 4) * 1.5
    const chaosY = chaos * Math.sin(time * 2.7 + seed * 5) * 1.5
    const chaosZ = chaos * Math.sin(time * 2.1 + seed * 6) * 1
    
    return {
      x: baseX + chaosX,
      y: baseY + chaosY,
      z: baseZ + chaosZ,
    }
  },
  
  getGlitchOffset: (time: number) => {
    const state = get()
    if (!state.isActive || !state.glitchEnabled) return { x: 0, y: 0, z: 0 }
    
    // Random glitch that triggers occasionally
    const glitchChance = Math.sin(time * 17) * Math.sin(time * 23)
    if (glitchChance > 0.95) {
      return {
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2,
        z: (Math.random() - 0.5) * 1,
      }
    }
    
    return { x: 0, y: 0, z: 0 }
  },
}))

// Helper to toggle dream mode
export function toggleDreamMode(intensity?: DreamIntensity) {
  const state = useDreamStore.getState()
  if (state.isActive) {
    state.exitDream()
  } else {
    state.enterDream(intensity)
  }
}
