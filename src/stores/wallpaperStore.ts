import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { invoke } from '@tauri-apps/api/core'

interface WallpaperPosition {
  x: number
  y: number
  z: number
}

interface WallpaperRotation {
  x: number
  y: number
}

export interface MonitorInfo {
  id: number
  name: string
  x: number
  y: number
  width: number
  height: number
  is_primary: boolean
}

export type DisplayMode = 'all' | number // 'all' for all monitors, or specific monitor ID

interface WallpaperState {
  // Mode state
  isWallpaperMode: boolean

  // Saved camera position/rotation
  savedPosition: WallpaperPosition
  savedRotation: WallpaperRotation

  // Animation settings
  orbitSpeed: number
  driftAmount: number

  // Multi-monitor settings
  displayMode: DisplayMode
  monitors: MonitorInfo[]
  selectedMonitorBounds: { x: number; y: number; width: number; height: number } | null

  // Actions
  enterWallpaperMode: (position: WallpaperPosition, rotation: WallpaperRotation) => Promise<void>
  exitWallpaperMode: () => Promise<void>
  toggleWallpaperMode: (position?: WallpaperPosition, rotation?: WallpaperRotation) => Promise<void>
  setOrbitSpeed: (speed: number) => void
  setDriftAmount: (amount: number) => void
  setDisplayMode: (mode: DisplayMode, bounds?: { x: number; y: number; width: number; height: number } | null) => void
  refreshMonitors: () => Promise<void>
}

export const useWallpaperStore = create<WallpaperState>()(
  persist(
    (set, get) => ({
      isWallpaperMode: false,

      savedPosition: { x: 0, y: 0, z: 50 },
      savedRotation: { x: 0, y: 0 },

      orbitSpeed: 0.02,
      driftAmount: 5,

      displayMode: 'all',
      monitors: [],
      selectedMonitorBounds: null,

      enterWallpaperMode: async (position, rotation) => {
        try {
          const { selectedMonitorBounds, displayMode, monitors } = get()

          console.log('🖼️ enterWallpaperMode called')
          console.log('🖼️ displayMode:', displayMode)
          console.log('🖼️ selectedMonitorBounds:', selectedMonitorBounds)
          console.log('🖼️ monitors:', monitors)

          // Call Tauri to embed window as wallpaper
          if (displayMode === 'all' || !selectedMonitorBounds) {
            console.log('🖼️ Using all monitors mode')
            await invoke('enter_wallpaper_mode')
          } else {
            // Use the saved bounds directly
            console.log('🖼️ Using specific bounds: x=', selectedMonitorBounds.x, 'y=', selectedMonitorBounds.y, 'w=', selectedMonitorBounds.width, 'h=', selectedMonitorBounds.height)
            await invoke('enter_wallpaper_mode_with_bounds', {
              x: selectedMonitorBounds.x,
              y: selectedMonitorBounds.y,
              width: selectedMonitorBounds.width,
              height: selectedMonitorBounds.height,
            })
          }

          set({
            isWallpaperMode: true,
            savedPosition: position,
            savedRotation: rotation,
          })
          console.log('🖼️ Wallpaper mode state set to true')
        } catch (error) {
          console.error('Failed to enter wallpaper mode:', error)
        }
      },

      exitWallpaperMode: async () => {
        try {
          // Call Tauri to restore normal window
          await invoke('exit_wallpaper_mode')

          set({ isWallpaperMode: false })
          console.log('🖼️ Wallpaper mode deactivated')
        } catch (error) {
          console.error('Failed to exit wallpaper mode:', error)
        }
      },

      toggleWallpaperMode: async (position, rotation) => {
        const { isWallpaperMode, savedPosition, savedRotation, enterWallpaperMode, exitWallpaperMode } = get()

        if (isWallpaperMode) {
          await exitWallpaperMode()
        } else {
          await enterWallpaperMode(
            position || savedPosition,
            rotation || savedRotation
          )
        }
      },

      setOrbitSpeed: (speed) => set({ orbitSpeed: speed }),
      setDriftAmount: (amount) => set({ driftAmount: amount }),
      setDisplayMode: (mode, bounds) => {
        console.log('🖼️ setDisplayMode called: mode=', mode, 'bounds=', bounds)
        set({ displayMode: mode, selectedMonitorBounds: bounds || null })
      },

      refreshMonitors: async () => {
        try {
          const monitors = await invoke<MonitorInfo[]>('get_monitors')
          console.log('🖥️ Detected monitors:', monitors)

          // Just update the monitors list - don't touch selectedMonitorBounds
          // The bounds are set when user clicks a monitor and should not change
          // unless the user explicitly selects a different monitor
          const { displayMode, selectedMonitorBounds } = get()

          // If we have bounds selected, check if they still correspond to a valid monitor
          if (displayMode !== 'all' && selectedMonitorBounds) {
            const boundsMatch = monitors.some(m =>
              m.x === selectedMonitorBounds.x &&
              m.y === selectedMonitorBounds.y &&
              m.width === selectedMonitorBounds.width &&
              m.height === selectedMonitorBounds.height
            )
            if (!boundsMatch) {
              console.log('🖥️ Saved bounds no longer match any monitor, resetting to all')
              set({ monitors, displayMode: 'all', selectedMonitorBounds: null })
            } else {
              console.log('🖥️ Saved bounds still valid')
              set({ monitors })
            }
          } else {
            set({ monitors })
          }
        } catch (error) {
          console.error('Failed to get monitors:', error)
        }
      },
    }),
    {
      name: 'wallpaper-settings',
      partialize: (state) => ({
        orbitSpeed: state.orbitSpeed,
        driftAmount: state.driftAmount,
        displayMode: state.displayMode,
        selectedMonitorBounds: state.selectedMonitorBounds,
      }),
    }
  )
)
