import { create } from 'zustand'

// Timeline Mode - Scrub through time to see how your mind evolved
// Watch thoughts appear chronologically, connections form

export interface TimelineState {
  // Is timeline mode active?
  isActive: boolean
  
  // Current point in time (timestamp)
  currentTime: number
  
  // Time range
  startTime: number  // Earliest thought
  endTime: number    // Latest thought (or now)
  
  // Playback
  isPlaying: boolean
  playbackSpeed: number  // 1 = real-time, 10 = 10x speed, etc.
  
  // Actions
  enterTimeline: (thoughts: { createdAt: Date | string }[]) => void
  exitTimeline: () => void
  setCurrentTime: (time: number) => void
  setPlaybackSpeed: (speed: number) => void
  play: () => void
  pause: () => void
  togglePlayback: () => void
  tick: (delta: number) => void  // Advance time during playback
  
  // Helpers
  getProgress: () => number  // 0-1 progress through timeline
  setProgress: (progress: number) => void  // Set by progress 0-1
  isVisible: (createdAt: Date | string) => boolean  // Should this item be shown?
  getVisibility: (createdAt: Date | string) => number  // 0-1 fade for items near current time
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  isActive: false,
  currentTime: Date.now(),
  startTime: Date.now(),
  endTime: Date.now(),
  isPlaying: false,
  playbackSpeed: 100,  // Default: 100x speed (1 second = 100 seconds of timeline)
  
  enterTimeline: (thoughts) => {
    if (thoughts.length === 0) {
      console.log('📅 No thoughts to build timeline from')
      return
    }
    
    // Find time range from thoughts
    const times = thoughts.map(t => 
      t.createdAt instanceof Date ? t.createdAt.getTime() : new Date(t.createdAt).getTime()
    )
    const startTime = Math.min(...times)
    const endTime = Math.max(...times, Date.now())
    
    console.log(`📅 Entering timeline: ${new Date(startTime).toLocaleDateString()} - ${new Date(endTime).toLocaleDateString()}`)
    
    set({
      isActive: true,
      startTime,
      endTime,
      currentTime: startTime,  // Start at the beginning
      isPlaying: false,
    })
  },
  
  exitTimeline: () => {
    console.log('📅 Exiting timeline')
    set({
      isActive: false,
      isPlaying: false,
      currentTime: Date.now(),
    })
  },
  
  setCurrentTime: (time: number) => {
    const { startTime, endTime } = get()
    // Clamp to valid range
    const clampedTime = Math.max(startTime, Math.min(endTime, time))
    set({ currentTime: clampedTime })
  },
  
  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: Math.max(1, Math.min(1000, speed)) })
  },
  
  play: () => {
    set({ isPlaying: true })
  },
  
  pause: () => {
    set({ isPlaying: false })
  },
  
  togglePlayback: () => {
    const { isPlaying, currentTime, endTime, startTime } = get()
    
    // If at end, restart from beginning
    if (!isPlaying && currentTime >= endTime) {
      set({ currentTime: startTime, isPlaying: true })
    } else {
      set({ isPlaying: !isPlaying })
    }
  },
  
  tick: (delta: number) => {
    const { isActive, isPlaying, currentTime, endTime, playbackSpeed } = get()
    
    if (!isActive || !isPlaying) return
    
    // Advance time based on playback speed
    // delta is in seconds, playbackSpeed is multiplier
    const advance = delta * 1000 * playbackSpeed  // Convert to ms and apply speed
    const newTime = currentTime + advance
    
    if (newTime >= endTime) {
      // Reached the end
      set({ currentTime: endTime, isPlaying: false })
    } else {
      set({ currentTime: newTime })
    }
  },
  
  getProgress: () => {
    const { currentTime, startTime, endTime } = get()
    if (endTime === startTime) return 1
    return (currentTime - startTime) / (endTime - startTime)
  },
  
  setProgress: (progress: number) => {
    const { startTime, endTime } = get()
    const clampedProgress = Math.max(0, Math.min(1, progress))
    const newTime = startTime + (endTime - startTime) * clampedProgress
    set({ currentTime: newTime })
  },
  
  isVisible: (createdAt: Date | string) => {
    const { isActive, currentTime } = get()
    if (!isActive) return true  // Show everything when not in timeline mode
    
    const itemTime = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime()
    return itemTime <= currentTime
  },
  
  getVisibility: (createdAt: Date | string) => {
    const { isActive, currentTime } = get()
    if (!isActive) return 1  // Full visibility when not in timeline mode
    
    const itemTime = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime()
    
    if (itemTime > currentTime) {
      return 0  // Not yet visible
    }
    
    // Fade in effect for recently appeared items
    const fadeWindow = 2000  // 2 seconds (in timeline time) to fade in
    const timeSinceAppeared = currentTime - itemTime
    
    if (timeSinceAppeared < fadeWindow) {
      return timeSinceAppeared / fadeWindow
    }
    
    return 1  // Fully visible
  },
}))

// Helper to format time for display
export function formatTimelineTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

// Helper to format duration
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}
