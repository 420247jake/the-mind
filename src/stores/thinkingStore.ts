import { create } from 'zustand'

// Thinking Path State - tracks the "reasoning trail" visualization
export interface ThinkingState {
  // Active thinking path - ordered list of thought IDs being traversed
  activePath: string[]
  
  // Current position in the path (for sequential animation)
  pathProgress: number
  
  // Is the AI currently "thinking"?
  isThinking: boolean
  
  // The final/synthesized thought ID (endpoint of reasoning)
  synthesisId: string | null
  
  // Timestamp when thinking started (for timing animations)
  thinkingStartTime: number | null
  
  // Speed of path traversal (nodes per second)
  traversalSpeed: number
  
  // Actions
  startThinking: (pathIds: string[], synthesisId?: string) => void
  advancePath: () => void
  stopThinking: () => void
  setTraversalSpeed: (speed: number) => void
  
  // Check if a specific thought is in the active path
  isInPath: (thoughtId: string) => boolean
  
  // Get the "activation level" of a thought (0-1, for visual intensity)
  getActivation: (thoughtId: string) => number
}

export const useThinkingStore = create<ThinkingState>((set, get) => ({
  activePath: [],
  pathProgress: 0,
  isThinking: false,
  synthesisId: null,
  thinkingStartTime: null,
  traversalSpeed: 2, // 2 nodes per second default
  
  startThinking: (pathIds: string[], synthesisId?: string) => {
    console.log('🧠 Starting thinking path:', pathIds)
    set({
      activePath: pathIds,
      pathProgress: 0,
      isThinking: true,
      synthesisId: synthesisId || null,
      thinkingStartTime: Date.now(),
    })
    
    // Auto-advance the path
    const advanceInterval = setInterval(() => {
      const state = get()
      if (!state.isThinking) {
        clearInterval(advanceInterval)
        return
      }
      
      const nextProgress = state.pathProgress + 1
      if (nextProgress >= state.activePath.length) {
        // Reached the end - keep path lit for a moment, then fade
        setTimeout(() => {
          set({ isThinking: false })
        }, 2000) // Keep final state for 2 seconds
        clearInterval(advanceInterval)
      } else {
        set({ pathProgress: nextProgress })
      }
    }, 1000 / get().traversalSpeed)
  },
  
  advancePath: () => {
    const { pathProgress, activePath } = get()
    if (pathProgress < activePath.length - 1) {
      set({ pathProgress: pathProgress + 1 })
    }
  },
  
  stopThinking: () => {
    set({
      isThinking: false,
      activePath: [],
      pathProgress: 0,
      synthesisId: null,
      thinkingStartTime: null,
    })
  },
  
  setTraversalSpeed: (speed: number) => {
    set({ traversalSpeed: Math.max(0.5, Math.min(10, speed)) })
  },
  
  isInPath: (thoughtId: string) => {
    return get().activePath.includes(thoughtId)
  },
  
  getActivation: (thoughtId: string) => {
    const { activePath, pathProgress, isThinking, synthesisId } = get()
    
    if (!isThinking && activePath.length === 0) return 0
    
    const index = activePath.indexOf(thoughtId)
    if (index === -1) return 0
    
    // Synthesis node gets special treatment
    if (thoughtId === synthesisId) {
      // Pulse brightly when we reach it
      return pathProgress >= activePath.length - 1 ? 1 : 0.3
    }
    
    // Nodes behind the progress point are "activated"
    if (index <= pathProgress) {
      // Closer to current position = brighter
      const distanceFromHead = pathProgress - index
      const falloff = Math.max(0.4, 1 - (distanceFromHead * 0.15))
      return falloff
    }
    
    // Nodes ahead are dimly visible (foreshadowing)
    return 0.15
  },
}))

// Helper to trigger a thinking visualization from anywhere
export function triggerThinkingPath(pathIds: string[], synthesisId?: string) {
  useThinkingStore.getState().startThinking(pathIds, synthesisId)
}
