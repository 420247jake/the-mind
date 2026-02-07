import { useEffect, useCallback, useRef } from 'react'
import { useMindStore } from '../stores/mindStore'

// Check if running in Tauri
const isTauri = () => {
  return typeof window !== 'undefined' &&
    ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

interface DbVersion {
  thought_max_id: number
  connection_max_id: number
}

/**
 * Smart database sync — polls get_db_version (cheap rowid check) every 500ms.
 * Only triggers a full loadFromDatabase when data actually changes.
 * When spatial loading is active, triggers loadNearCamera instead of full load.
 */
export function useDatabaseSync(intervalMs = 500) {
  const { loadFromDatabase, loadNearCamera, useSpatialLoading } = useMindStore()
  const lastVersionRef = useRef<DbVersion>({ thought_max_id: -1, connection_max_id: -1 })
  // Track spatial loading flag in a ref so the callback stays stable
  const spatialRef = useRef(useSpatialLoading)
  spatialRef.current = useSpatialLoading

  const checkForUpdates = useCallback(async () => {
    if (!isTauri()) return

    try {
      const { invoke } = await import('@tauri-apps/api/core')

      // Cheap check — just gets max rowids
      const version = await invoke<DbVersion>('get_db_version')

      const prev = lastVersionRef.current
      if (version.thought_max_id !== prev.thought_max_id ||
          version.connection_max_id !== prev.connection_max_id) {
        console.log(`Database changed: thoughts ${prev.thought_max_id}->${version.thought_max_id}, connections ${prev.connection_max_id}->${version.connection_max_id}`)
        lastVersionRef.current = version

        if (spatialRef.current) {
          // In spatial mode, reload at origin (MindSpace's useFrame will handle camera-position reloads)
          // This ensures new MCP-added thoughts at least appear if they're nearby
          await loadNearCamera(0, 0, 50)
        } else {
          await loadFromDatabase()
        }
      }
    } catch (err) {
      // Fallback: if get_db_version doesn't exist yet (old binary), use full load
      try {
        await loadFromDatabase()
      } catch {
        console.error('Failed to check for updates:', err)
      }
    }
  }, [loadFromDatabase, loadNearCamera])

  useEffect(() => {
    if (!isTauri()) return

    // Initial sync
    checkForUpdates()

    // Set up polling interval
    const interval = setInterval(checkForUpdates, intervalMs)

    return () => clearInterval(interval)
  }, [checkForUpdates, intervalMs])
}

/**
 * Hook to listen for Tauri events (for future real-time updates)
 */
export function useTauriEvents() {
  const { addThought, addConnection } = useMindStore()

  useEffect(() => {
    if (!isTauri()) return

    let unlisten: (() => void) | undefined

    const setupListeners = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event')

        const unlistenThought = await listen<unknown>('thought-added', (event: { payload: unknown }) => {
          console.log('New thought from MCP:', event.payload)
        })

        const unlistenConnection = await listen<unknown>('connection-added', (event: { payload: unknown }) => {
          console.log('New connection from MCP:', event.payload)
        })

        unlisten = () => {
          unlistenThought()
          unlistenConnection()
        }
      } catch (err) {
        console.error('Failed to set up event listeners:', err)
      }
    }

    setupListeners()

    return () => {
      if (unlisten) unlisten()
    }
  }, [addThought, addConnection])
}
