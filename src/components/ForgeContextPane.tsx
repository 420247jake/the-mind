import { useState } from 'react'
import type { ForgeContext, ForgeJournalEntry, ForgeDecisionEntry, ForgeDeadEndEntry } from '../types'

// ---- Time formatting ----

function timeAgo(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// ---- Collapsible Section ----

function CollapsibleSection({ title, icon, count, children }: {
  title: string
  icon: string
  count: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-2 text-sm font-medium text-white/80 hover:bg-white/5 rounded-lg transition-colors"
      >
        <span>{icon}</span>
        <span>{title}</span>
        <span className="ml-auto px-1.5 py-0.5 rounded-full bg-white/10 text-white/50 text-xs">{count}</span>
        <span className="text-white/30 text-xs">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-1 space-y-2 pl-2">
          {children}
        </div>
      )}
    </div>
  )
}

// ---- Entry Cards ----

function JournalCard({ entry }: { entry: ForgeJournalEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/8 cursor-pointer transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-blue-400/70 font-mono">{timeAgo(entry.timestamp)}</span>
      </div>
      <p className="text-sm text-white/70 leading-relaxed" style={{
        display: expanded ? 'block' : '-webkit-box',
        WebkitLineClamp: expanded ? undefined : 2,
        WebkitBoxOrient: 'vertical' as const,
        overflow: expanded ? 'visible' : 'hidden',
      }}>
        {entry.session_summary}
      </p>
      {expanded && (
        <div className="mt-2 space-y-1">
          {entry.breakthroughs.length > 0 && (
            <div className="text-xs text-green-400/70">
              <span className="font-medium">Breakthroughs:</span>{' '}
              {entry.breakthroughs.join(', ')}
            </div>
          )}
          {entry.key_moments.length > 0 && (
            <div className="text-xs text-yellow-400/70">
              <span className="font-medium">Key moments:</span>{' '}
              {entry.key_moments.join(', ')}
            </div>
          )}
          {entry.frustrations.length > 0 && (
            <div className="text-xs text-red-400/70">
              <span className="font-medium">Frustrations:</span>{' '}
              {entry.frustrations.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DecisionCard({ entry }: { entry: ForgeDecisionEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/8 cursor-pointer transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-purple-400/70 font-mono">{timeAgo(entry.timestamp)}</span>
        {entry.project && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300/70">{entry.project}</span>
        )}
      </div>
      <p className="text-sm text-white/80 font-medium">{entry.choice}</p>
      {expanded && (
        <div className="mt-2 space-y-1">
          <div className="text-xs text-white/60">
            <span className="font-medium text-white/70">Why:</span> {entry.reasoning}
          </div>
          {entry.alternatives.length > 0 && (
            <div className="text-xs text-white/50">
              <span className="font-medium">Alternatives:</span>{' '}
              {entry.alternatives.join(' | ')}
            </div>
          )}
          {entry.outcome && (
            <div className="text-xs text-green-400/70">
              <span className="font-medium">Outcome:</span> {entry.outcome}
            </div>
          )}
          {entry.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {entry.tags.map((tag, i) => (
                <span key={i} className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/40">{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeadEndCard({ entry }: { entry: ForgeDeadEndEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/8 cursor-pointer transition-colors border-l-2 border-red-500/30"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-red-400/70 font-mono">{timeAgo(entry.timestamp)}</span>
      </div>
      <p className="text-sm text-white/70">{entry.attempted}</p>
      {expanded && (
        <div className="mt-2 space-y-1">
          <div className="text-xs text-red-400/60">
            <span className="font-medium">Failed because:</span> {entry.why_failed}
          </div>
          <div className="text-xs text-green-400/60">
            <span className="font-medium">Lesson:</span> {entry.lesson}
          </div>
          {entry.files_involved.length > 0 && (
            <div className="text-xs text-white/40">
              <span className="font-medium">Files:</span>{' '}
              {entry.files_involved.map(f => f.split(/[/\\]/).pop()).join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---- Main Pane ----

interface ForgeContextPaneProps {
  forgeContext: ForgeContext | null
  available: boolean
  loading: boolean
}

export default function ForgeContextPane({ forgeContext, available, loading }: ForgeContextPaneProps) {
  if (!available) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="text-3xl mb-3">🔗</div>
        <p className="text-white/50 text-sm">
          Install <span className="text-white/70 font-mono">session-forge</span> to see related context from past sessions, decisions, and dead ends.
        </p>
        <p className="text-white/30 text-xs mt-2 font-mono">npx session-forge</p>
      </div>
    )
  }

  if (loading || !forgeContext) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-white/30 text-sm animate-pulse">Loading context...</div>
      </div>
    )
  }

  const total = forgeContext.journals.length + forgeContext.decisions.length + forgeContext.dead_ends.length
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="text-3xl mb-3">🔍</div>
        <p className="text-white/40 text-sm">No related session-forge context found for this thought.</p>
      </div>
    )
  }

  return (
    <div className="px-4 py-3">
      {forgeContext.journals.length > 0 && (
        <CollapsibleSection title="Sessions" icon="📓" count={forgeContext.journals.length}>
          {forgeContext.journals.map((j, i) => (
            <JournalCard key={i} entry={j} />
          ))}
        </CollapsibleSection>
      )}
      {forgeContext.decisions.length > 0 && (
        <CollapsibleSection title="Decisions" icon="🎯" count={forgeContext.decisions.length}>
          {forgeContext.decisions.map((d, i) => (
            <DecisionCard key={i} entry={d} />
          ))}
        </CollapsibleSection>
      )}
      {forgeContext.dead_ends.length > 0 && (
        <CollapsibleSection title="Dead Ends" icon="🚧" count={forgeContext.dead_ends.length}>
          {forgeContext.dead_ends.map((d, i) => (
            <DeadEndCard key={i} entry={d} />
          ))}
        </CollapsibleSection>
      )}
    </div>
  )
}
