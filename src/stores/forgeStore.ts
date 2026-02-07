import { create } from 'zustand'
import type { ForgeContext } from '../types'

const isTauri = () => {
  return typeof window !== 'undefined' &&
    ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<T>(cmd, args)
  }
  throw new Error('Not running in Tauri environment')
}

interface ForgeState {
  available: boolean
  cache: Map<string, ForgeContext>
  loading: Set<string>

  checkAvailability: () => Promise<void>
  fetchContext: (thoughtId: string, content: string) => Promise<ForgeContext | null>
  clearCache: () => void
}

export const useForgeStore = create<ForgeState>((set, get) => ({
  available: false,
  cache: new Map(),
  loading: new Set(),

  checkAvailability: async () => {
    if (!isTauri()) {
      set({ available: false })
      return
    }
    try {
      const available = await invoke<boolean>('get_forge_available')
      set({ available })
      if (available) {
        console.log('🔗 session-forge data detected')
      }
    } catch {
      set({ available: false })
    }
  },

  fetchContext: async (thoughtId: string, content: string) => {
    const { cache, loading } = get()

    // Return cached result
    if (cache.has(thoughtId)) return cache.get(thoughtId)!

    // Already loading this thought
    if (loading.has(thoughtId)) return null

    // Mark as loading
    set(s => {
      const newLoading = new Set(s.loading)
      newLoading.add(thoughtId)
      return { loading: newLoading }
    })

    try {
      const result = await invoke<ForgeContext>('get_forge_context', { query: content })

      set(s => {
        const newCache = new Map(s.cache)
        newCache.set(thoughtId, result)
        const newLoading = new Set(s.loading)
        newLoading.delete(thoughtId)
        return { cache: newCache, loading: newLoading }
      })

      return result
    } catch (err) {
      console.error('Failed to fetch forge context:', err)
      set(s => {
        const newLoading = new Set(s.loading)
        newLoading.delete(thoughtId)
        return { loading: newLoading }
      })
      return null
    }
  },

  clearCache: () => set({ cache: new Map() }),
}))
