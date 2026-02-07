import { useMemo, useState, useEffect } from 'react'
import { useMindStore } from '../stores/mindStore'
import { useForgeStore } from '../stores/forgeStore'
import { CATEGORY_COLORS } from '../types'
import type { Thought } from '../types'
import ForgeContextPane from './ForgeContextPane'

interface ThoughtDetailProps {
  thought: Thought
  onClose: () => void
  onNavigateToConnected?: (thoughtId: string) => void
}

const CATEGORY_ICONS: Record<string, string> = {
  work: '💼',
  personal: '👤',
  technical: '⚙️',
  creative: '✨',
  other: '💭',
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  user: { label: 'User', color: '#3B82F6' },
  assistant: { label: 'AI', color: '#8B5CF6' },
  system: { label: 'System', color: '#6B7280' },
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`
  return date.toLocaleDateString()
}

type TabId = 'details' | 'context' | 'connections'

export default function ThoughtDetail({ thought, onClose, onNavigateToConnected }: ThoughtDetailProps) {
  const { thoughts, connections } = useMindStore()
  const { available: forgeAvailable, fetchContext, cache, loading: forgeLoading } = useForgeStore()
  const [activeTab, setActiveTab] = useState<TabId>('details')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const color = CATEGORY_COLORS[thought.category]
  const forgeContext = cache.get(thought.id) ?? null
  const isForgeLoading = forgeLoading.has(thought.id)

  // Fetch forge context when switching to context tab
  useEffect(() => {
    if (activeTab === 'context' && forgeAvailable && !forgeContext && !isForgeLoading) {
      fetchContext(thought.id, thought.content)
    }
  }, [activeTab, thought.id, thought.content, forgeAvailable, forgeContext, isForgeLoading, fetchContext])

  // Count forge results for badge
  const forgeTotal = forgeContext
    ? forgeContext.journals.length + forgeContext.decisions.length + forgeContext.dead_ends.length
    : 0

  // Find all connections involving this thought
  const connectedThoughts = useMemo(() => {
    const connected: Array<{ thought: Thought; connection: typeof connections[0]; direction: 'from' | 'to' }> = []

    for (const conn of connections) {
      if (conn.fromThought === thought.id) {
        const target = thoughts.find(t => t.id === conn.toThought)
        if (target) {
          connected.push({ thought: target, connection: conn, direction: 'to' })
        }
      } else if (conn.toThought === thought.id) {
        const source = thoughts.find(t => t.id === conn.fromThought)
        if (source) {
          connected.push({ thought: source, connection: conn, direction: 'from' })
        }
      }
    }

    return connected.sort((a, b) => b.connection.strength - a.connection.strength)
  }, [thought.id, thoughts, connections])

  const createdDate = thought.createdAt instanceof Date ? thought.createdAt : new Date(thought.createdAt)

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl flex flex-col"
        style={{
          background: 'linear-gradient(145deg, rgba(20, 20, 35, 0.98) 0%, rgba(10, 10, 20, 0.99) 100%)',
          border: `1px solid ${color}33`,
          boxShadow: `0 25px 80px rgba(0, 0, 0, 0.6), 0 0 60px ${color}22`,
        }}
      >
        {/* Header with category color accent */}
        <div
          className="relative px-6 py-5 border-b border-white/5 shrink-0"
          style={{
            background: `linear-gradient(135deg, ${color}15 0%, transparent 100%)`,
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{
                background: `linear-gradient(135deg, ${color}, ${color}88)`,
                boxShadow: `0 4px 20px ${color}44`,
              }}
            >
              {CATEGORY_ICONS[thought.category]}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="px-3 py-1 rounded-full text-xs font-medium capitalize"
                style={{ background: `${color}22`, color: color }}
              >
                {thought.category}
              </span>
              {thought.role && ROLE_LABELS[thought.role] && (
                <span
                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: `${ROLE_LABELS[thought.role].color}22`,
                    color: ROLE_LABELS[thought.role].color,
                  }}
                >
                  {ROLE_LABELS[thought.role].label}
                </span>
              )}
            </div>

            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
            >
              ✕
            </button>
          </div>

          {/* Importance bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40">Importance</span>
            <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${thought.importance * 100}%`,
                  background: `linear-gradient(90deg, ${color}, ${color}88)`,
                  boxShadow: `0 0 10px ${color}66`,
                }}
              />
            </div>
            <span className="text-xs text-white/60 font-medium">{Math.round(thought.importance * 100)}%</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 px-6 py-2 border-b border-white/5 shrink-0 bg-white/[0.01]">
          <TabButton active={activeTab === 'details'} onClick={() => setActiveTab('details')} color={color}>
            Details
          </TabButton>
          <TabButton active={activeTab === 'context'} onClick={() => setActiveTab('context')} color={color}>
            <span>Context</span>
            {forgeTotal > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs" style={{ background: `${color}20`, color }}>
                {forgeTotal}
              </span>
            )}
          </TabButton>
          <TabButton active={activeTab === 'connections'} onClick={() => setActiveTab('connections')} color={color}>
            <span>Connections</span>
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 text-xs">
              {connectedThoughts.length}
            </span>
          </TabButton>
        </div>

        {/* Content area - scrollable */}
        <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(85vh - 240px)' }}>
          {activeTab === 'details' && (
            <DetailsTab thought={thought} createdDate={createdDate} color={color} />
          )}
          {activeTab === 'context' && (
            <ForgeContextPane
              forgeContext={forgeContext}
              available={forgeAvailable}
              loading={isForgeLoading}
            />
          )}
          {activeTab === 'connections' && (
            <ConnectionsTab
              connectedThoughts={connectedThoughts}
              onNavigateToConnected={onNavigateToConnected}
            />
          )}
        </div>

        {/* Footer with actions */}
        <div className="px-6 py-3 border-t border-white/5 flex justify-between items-center shrink-0">
          <div className="text-xs text-white/30 font-mono">
            ID: {thought.id.substring(0, 8)}...
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(thought.content, 'content')}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white/80 text-xs transition-all"
            >
              {copiedField === 'content' ? '✓ Copied' : 'Copy Content'}
            </button>
            <button
              onClick={() => copyToClipboard(thought.id, 'id')}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/50 hover:text-white/80 text-xs transition-all"
            >
              {copiedField === 'id' ? '✓ Copied' : 'Copy ID'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-white/70 hover:text-white text-sm transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Tab Button ----

function TabButton({ active, onClick, color, children }: {
  active: boolean
  onClick: () => void
  color: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition-all"
      style={{
        background: active ? `${color}15` : 'transparent',
        color: active ? color : 'rgba(255,255,255,0.5)',
        borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
      }}
    >
      {children}
    </button>
  )
}

// ---- Details Tab ----

function DetailsTab({ thought, createdDate, color }: {
  thought: Thought
  createdDate: Date
  color: string
}) {
  return (
    <>
      {/* Main content */}
      <div className="px-6 py-5">
        <p className="text-white/90 text-lg leading-relaxed select-text cursor-text">
          {thought.content}
        </p>
      </div>

      {/* Metadata */}
      <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02]">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-white/40 text-xs">Created</span>
            <p className="text-white/70">{formatTimeAgo(createdDate)}</p>
            <p className="text-white/40 text-xs">{createdDate.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-white/40 text-xs">Position</span>
            <p className="text-white/70 font-mono text-xs">
              x: {thought.position.x.toFixed(1)}, y: {thought.position.y.toFixed(1)}, z: {thought.position.z.toFixed(1)}
            </p>
          </div>
        </div>
      </div>

      {/* Category color bar accent at bottom of details */}
      <div className="mx-6 mb-4 mt-2 h-0.5 rounded-full" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
    </>
  )
}

// ---- Connections Tab ----

function ConnectionsTab({ connectedThoughts, onNavigateToConnected }: {
  connectedThoughts: Array<{ thought: Thought; connection: { id: string; strength: number; reason: string }; direction: 'from' | 'to' }>
  onNavigateToConnected?: (thoughtId: string) => void
}) {
  if (connectedThoughts.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <div className="text-3xl mb-3">🔗</div>
        <p className="text-white/30 text-sm">No connections yet</p>
        <p className="text-white/20 text-xs mt-1">This thought will connect to others as you chat with Claude</p>
      </div>
    )
  }

  return (
    <div className="px-6 py-4">
      <div className="space-y-2">
        {connectedThoughts.map(({ thought: connThought, connection, direction }) => (
          <div
            key={connection.id}
            onClick={() => onNavigateToConnected?.(connThought.id)}
            className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition-all group"
          >
            <div className="text-white/30 text-sm mt-0.5">
              {direction === 'to' ? '→' : '←'}
            </div>

            <div
              className="w-2 h-2 rounded-full mt-2 shrink-0"
              style={{ background: CATEGORY_COLORS[connThought.category] }}
            />

            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-sm truncate group-hover:text-white transition-colors">
                {connThought.content}
              </p>
              {connection.reason && (
                <p className="text-white/40 text-xs mt-1 italic">
                  "{connection.reason}"
                </p>
              )}
            </div>

            <div className="text-right shrink-0">
              <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${connection.strength * 100}%`,
                    background: CATEGORY_COLORS[connThought.category],
                  }}
                />
              </div>
              <span className="text-white/30 text-xs">{Math.round(connection.strength * 100)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
