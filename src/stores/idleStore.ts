import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface IdleState {
  // State
  lastInputTime: number
  isIdle: boolean
  idleTimeoutMs: number // default 5 minutes

  // Actions
  resetActivity: () => void
  checkIdle: () => void
  setIdleTimeout: (ms: number) => void
}

const DEFAULT_IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

export const useIdleStore = create<IdleState>()(
  persist(
    (set, get) => ({
      lastInputTime: Date.now(),
      isIdle: false,
      idleTimeoutMs: DEFAULT_IDLE_TIMEOUT,

      resetActivity: () => {
        const { isIdle } = get()
        set({ lastInputTime: Date.now(), isIdle: false })
        if (isIdle) {
          console.log('💤 Idle drift ended — input detected')
        }
      },

      checkIdle: () => {
        const { lastInputTime, isIdle, idleTimeoutMs } = get()
        const shouldBeIdle = Date.now() - lastInputTime > idleTimeoutMs
        if (shouldBeIdle && !isIdle) {
          console.log('💤 Entering idle drift mode')
          set({ isIdle: true })
        }
      },

      setIdleTimeout: (ms: number) => set({ idleTimeoutMs: ms }),
    }),
    {
      name: 'idle-settings',
      partialize: (state) => ({
        idleTimeoutMs: state.idleTimeoutMs,
      }),
    }
  )
)
