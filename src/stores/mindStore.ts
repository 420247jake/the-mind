import { create } from 'zustand'
import type { MindState, Thought, Connection, Session, Cluster, ThoughtCategory } from '../types'
import { useThinkingStore } from './thinkingStore'
import { useActivationStore } from './activationStore'

// Check if running in Tauri
const isTauri = () => {
  return typeof window !== 'undefined' && 
    ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
}

// Tauri invoke wrapper
async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core')
    return invoke<T>(cmd, args)
  }
  throw new Error('Not running in Tauri environment')
}

// Types matching Rust backend
interface RustThought {
  id: string
  content: string
  role: string | null
  category: string
  importance: number
  position_x: number
  position_y: number
  position_z: number
  created_at: string
  last_referenced: string
}

interface RustConnection {
  id: string
  from_thought: string
  to_thought: string
  strength: number
  reason: string
  created_at: string
}

interface RustCluster {
  id: string
  name: string
  category: string
  center_x: number
  center_y: number
  center_z: number
  thought_count: number
  created_at: string
}

function rustToCluster(rust: RustCluster): Cluster {
  return {
    id: rust.id,
    name: rust.name,
    center: {
      x: rust.center_x,
      y: rust.center_y,
      z: rust.center_z,
    },
    color: rust.category, // We'll resolve to actual color in the component
    createdAt: new Date(rust.created_at),
    category: rust.category,
    thoughtCount: rust.thought_count,
  }
}

// Convert Rust thought to frontend thought
function rustToThought(rust: RustThought): Thought {
  return {
    id: rust.id,
    content: rust.content,
    role: rust.role as Thought['role'],
    category: rust.category as ThoughtCategory,
    importance: rust.importance,
    position: {
      x: rust.position_x,
      y: rust.position_y,
      z: rust.position_z,
    },
    createdAt: new Date(rust.created_at),
    lastReferenced: new Date(rust.last_referenced),
  }
}

// Convert frontend thought to Rust thought
function thoughtToRust(thought: Thought): RustThought {
  return {
    id: thought.id,
    content: thought.content,
    role: thought.role || null,
    category: thought.category,
    importance: thought.importance,
    position_x: thought.position.x,
    position_y: thought.position.y,
    position_z: thought.position.z,
    created_at: thought.createdAt.toISOString(),
    last_referenced: thought.lastReferenced.toISOString(),
  }
}

// Convert Rust connection to frontend connection
function rustToConnection(rust: RustConnection): Connection {
  return {
    id: rust.id,
    fromThought: rust.from_thought,
    toThought: rust.to_thought,
    strength: rust.strength,
    reason: rust.reason,
    createdAt: new Date(rust.created_at),
  }
}

// Convert frontend connection to Rust connection
function connectionToRust(conn: Connection): RustConnection {
  return {
    id: conn.id,
    from_thought: conn.fromThought,
    to_thought: conn.toThought,
    strength: conn.strength,
    reason: conn.reason,
    created_at: conn.createdAt.toISOString(),
  }
}

// Find a reasoning path from existing thoughts to a new thought
// This creates the "watch it think" visualization path
function findReasoningPath(
  newThoughtId: string,
  thoughts: Thought[],
  connections: Connection[]
): string[] {
  // Find thoughts connected to the new thought
  const connectedToNew = connections.filter(
    c => c.toThought === newThoughtId || c.fromThought === newThoughtId
  )
  
  if (connectedToNew.length === 0) {
    // No connections yet, just return the new thought
    return [newThoughtId]
  }
  
  // Sort by connection strength (strongest first)
  const sortedConnections = [...connectedToNew].sort((a, b) => b.strength - a.strength)
  
  // Build a path: start from strongest connection, work toward new thought
  const path: string[] = []
  
  // Take up to 4 connected thoughts to form the reasoning chain
  const maxPathLength = 4
  for (let i = 0; i < Math.min(sortedConnections.length, maxPathLength - 1); i++) {
    const conn = sortedConnections[i]
    const connectedId = conn.fromThought === newThoughtId ? conn.toThought : conn.fromThought
    
    // Add to path if the thought exists
    const thought = thoughts.find(t => t.id === connectedId)
    if (thought && !path.includes(connectedId)) {
      path.push(connectedId)
    }
  }
  
  // Add the new thought at the end (the synthesis)
  path.push(newThoughtId)
  
  return path
}

// Demo data for development/browser mode
const demoThoughts: Thought[] = [
  {
    id: '1',
    content: 'The Mind: A 3D visualization of AI thought',
    category: 'creative',
    importance: 0.9,
    position: { x: 0, y: 0, z: 0 },
    createdAt: new Date(),
    lastReferenced: new Date(),
  },
  {
    id: '2',
    content: 'MCP Protocol integration with Claude Desktop',
    category: 'technical',
    importance: 0.8,
    position: { x: 10, y: 5, z: -5 },
    createdAt: new Date(),
    lastReferenced: new Date(),
  },
  {
    id: '3',
    content: 'React Three Fiber for 3D rendering',
    category: 'technical',
    importance: 0.7,
    position: { x: -8, y: 3, z: 8 },
    createdAt: new Date(),
    lastReferenced: new Date(),
  },
  {
    id: '4',
    content: 'SQLite database for thought persistence',
    category: 'work',
    importance: 0.6,
    position: { x: 5, y: -7, z: 3 },
    createdAt: new Date(),
    lastReferenced: new Date(),
  },
  {
    id: '5',
    content: 'User experience and visual design',
    category: 'personal',
    importance: 0.5,
    position: { x: -12, y: 8, z: -10 },
    createdAt: new Date(),
    lastReferenced: new Date(),
  },
]

const demoConnections: Connection[] = [
  {
    id: 'c1',
    fromThought: '1',
    toThought: '2',
    strength: 0.8,
    reason: 'Core architecture',
    createdAt: new Date(),
  },
  {
    id: 'c2',
    fromThought: '1',
    toThought: '3',
    strength: 0.7,
    reason: 'Visualization layer',
    createdAt: new Date(),
  },
  {
    id: 'c3',
    fromThought: '2',
    toThought: '4',
    strength: 0.6,
    reason: 'Data persistence',
    createdAt: new Date(),
  },
  {
    id: 'c4',
    fromThought: '3',
    toThought: '5',
    strength: 0.5,
    reason: 'Design considerations',
    createdAt: new Date(),
  },
]

// Spatial loading threshold — above this count, switch to camera-based loading
const SPATIAL_THRESHOLD = 500
const DEFAULT_SPATIAL_RADIUS = 80
const DEFAULT_SPATIAL_LIMIT = 300

export const useMindStore = create<MindState>((set, _get) => ({
  thoughts: [],
  connections: [],
  sessions: [],
  clusters: [],
  currentSession: null,
  useSpatialLoading: false,
  totalThoughtCount: 0,
  
  addThought: async (thought: Thought) => {
    const state = _get()
    
    // Find connected thoughts to create a "reasoning path"
    // This simulates the AI "thinking through" related concepts
    const connectedIds = findReasoningPath(thought.id, state.thoughts, state.connections)
    
    // Trigger the thinking visualization if we have a path
    if (connectedIds.length > 1) {
      useThinkingStore.getState().startThinking(connectedIds, thought.id)
    }
    
    // ACTIVATE THE NEW THOUGHT (motion-activated light)
    // The new thought lights up at full intensity
    useActivationStore.getState().activateNode(thought.id, 1.0)
    
    // Also activate connected thoughts at lower intensity
    // (they're being "referenced" by this new thought)
    const connectedThoughts = state.connections
      .filter(c => c.fromThought === thought.id || c.toThought === thought.id)
      .map(c => c.fromThought === thought.id ? c.toThought : c.fromThought)
    
    if (connectedThoughts.length > 0) {
      useActivationStore.getState().activateNodes(connectedThoughts, 0.6)
    }
    
    // Optimistically update UI
    set((state) => ({
      thoughts: [...state.thoughts, thought]
    }))
    
    // Persist to database if in Tauri
    if (isTauri()) {
      try {
        await invoke('add_thought', { thought: thoughtToRust(thought) })
      } catch (err) {
        console.error('Failed to persist thought:', err)
      }
    }
  },
  
  addConnection: async (connection: Connection) => {
    // ACTIVATE BOTH CONNECTED THOUGHTS
    // When a connection is made, both nodes "light up"
    useActivationStore.getState().activateNodes(
      [connection.fromThought, connection.toThought], 
      0.8
    )
    
    // Optimistically update UI
    set((state) => ({
      connections: [...state.connections, connection]
    }))
    
    // Persist to database if in Tauri
    if (isTauri()) {
      try {
        await invoke('add_connection', { connection: connectionToRust(connection) })
      } catch (err) {
        console.error('Failed to persist connection:', err)
      }
    }
  },
  
  updateThought: (id: string, updates: Partial<Thought>) => {
    set((state) => ({
      thoughts: state.thoughts.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      )
    }))
  },
  
  setCurrentSession: (session: Session | null) => {
    set({ currentSession: session })
  },
  
  loadFromDatabase: async () => {
    if (isTauri()) {
      try {
        console.log('Loading from Tauri database...')

        // Check total thought count to decide loading strategy
        let totalCount = 0
        try {
          totalCount = await invoke<number>('get_thought_count')
        } catch {
          // Old binary without get_thought_count, fall through to full load
        }

        const shouldUseSpatial = totalCount > SPATIAL_THRESHOLD

        if (shouldUseSpatial) {
          console.log(`${totalCount} thoughts detected — spatial loading enabled (threshold: ${SPATIAL_THRESHOLD})`)
          set({ useSpatialLoading: true, totalThoughtCount: totalCount })
          // Don't load all — let MindSpace trigger loadNearCamera based on camera position
          return
        }

        // Load all thoughts from database (small dataset)
        const rustThoughts = await invoke<RustThought[]>('get_all_thoughts')
        const thoughts = rustThoughts.map(rustToThought)

        // Load connections from database
        const rustConnections = await invoke<RustConnection[]>('get_all_connections')
        const connections = rustConnections.map(rustToConnection)

        // Load clusters
        let clusters: Cluster[] = []
        try {
          const rustClusters = await invoke<RustCluster[]>('get_all_clusters')
          clusters = rustClusters.map(rustToCluster)
        } catch {
          // Old binary without clusters, ignore
        }

        console.log(`Loaded ${thoughts.length} thoughts, ${connections.length} connections, ${clusters.length} clusters`)

        set({ thoughts, connections, clusters, useSpatialLoading: false, totalThoughtCount: totalCount })

        // If no data, seed with demo data
        if (thoughts.length === 0) {
          console.log('No data found, seeding with demo data...')
          for (const thought of demoThoughts) {
            await invoke('add_thought', { thought: thoughtToRust(thought) })
          }
          for (const conn of demoConnections) {
            await invoke('add_connection', { connection: connectionToRust(conn) })
          }
          set({ thoughts: demoThoughts, connections: demoConnections })
        }
      } catch (err) {
        console.error('Failed to load from database:', err)
        // Fall back to demo data
        set({ thoughts: demoThoughts, connections: demoConnections })
      }
    } else {
      // Not in Tauri, use demo data
      console.log('Not in Tauri, using demo data')
      set({ thoughts: demoThoughts, connections: demoConnections })
    }
  },

  loadNearCamera: async (x: number, y: number, z: number, radius = DEFAULT_SPATIAL_RADIUS, limit = DEFAULT_SPATIAL_LIMIT) => {
    if (!isTauri()) return

    try {
      // Get thoughts near camera
      const rustThoughts = await invoke<RustThought[]>('get_thoughts_near', { x, y, z, radius, limit })
      const thoughts = rustThoughts.map(rustToThought)

      // Get connections only between the loaded thoughts
      const ids = thoughts.map(t => t.id)
      let connections: Connection[] = []
      if (ids.length > 0) {
        const rustConnections = await invoke<RustConnection[]>('get_connections_for_thoughts', { ids })
        connections = rustConnections.map(rustToConnection)
      }

      console.log(`Spatial load: ${thoughts.length} thoughts, ${connections.length} connections near (${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)}) r=${radius}`)

      set({ thoughts, connections })
    } catch (err) {
      console.error('Spatial load failed, falling back to full load:', err)
      // Fallback to full load
      const rustThoughts = await invoke<RustThought[]>('get_all_thoughts')
      const thoughts = rustThoughts.map(rustToThought)
      const rustConnections = await invoke<RustConnection[]>('get_all_connections')
      const connections = rustConnections.map(rustToConnection)
      set({ thoughts, connections, useSpatialLoading: false })
    }
  },
}))

// Export a function to search thoughts (used by UI)
export async function searchThoughts(query: string): Promise<Thought[]> {
  if (isTauri()) {
    try {
      const rustThoughts = await invoke<RustThought[]>('search_thoughts', { query })
      return rustThoughts.map(rustToThought)
    } catch (err) {
      console.error('Search failed:', err)
      return []
    }
  }
  
  // Fallback: simple client-side search
  const { thoughts } = useMindStore.getState()
  return thoughts.filter(t => 
    t.content.toLowerCase().includes(query.toLowerCase())
  )
}
