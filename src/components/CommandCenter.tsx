import { useState, useEffect, useRef, useMemo } from 'react'
import { useMindStore } from '../stores/mindStore'
import { useThinkingStore } from '../stores/thinkingStore'
import { useDreamStore, type DreamIntensity } from '../stores/dreamStore'
import { useTimelineStore, formatTimelineTime, formatDuration } from '../stores/timelineStore'
import { useWallpaperStore } from '../stores/wallpaperStore'
import { dofSettings } from './DebugBridge'
import { CATEGORY_COLORS } from '../types'
import type { Thought, Connection } from '../types'

interface CommandCenterProps {
  onClose: () => void
  onNavigateToThought?: (thoughtId: string) => void
}

// Check if running in Tauri
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

type TabId = 'overview' | 'search' | 'export' | 'connect' | 'thinking' | 'dream' | 'timeline' | 'settings'
type SortOption = 'recent' | 'oldest' | 'importance' | 'connections' | 'alphabetical'

export default function CommandCenter({ onClose, onNavigateToThought }: CommandCenterProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)
  const [exePath, setExePath] = useState('C:\\\\Program Files\\\\The Mind\\\\the-mind.exe')
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Enhanced search state
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [minImportance, setMinImportance] = useState(0)
  const [sortBy, setSortBy] = useState<SortOption>('recent')
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  const { thoughts, connections } = useMindStore()
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === '/' && !e.ctrlKey && !e.metaKey && activeTab !== 'search') {
        e.preventDefault()
        setActiveTab('search')
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, activeTab])
  
  // Get actual exe path in Tauri
  useEffect(() => {
    const getExePath = async () => {
      if (isTauri()) {
        try {
          const { resourceDir } = await import('@tauri-apps/api/path')
          const dir = await resourceDir()
          const path = dir.replace(/\\resources\\?$/, '\\the-mind.exe')
          setExePath(path.replace(/\\/g, '\\\\'))
        } catch (err) {
          console.log('Could not resolve exe path, using default')
        }
      }
    }
    getExePath()
  }, [])
  
  // Stats calculations
  const categoryStats = Object.entries(CATEGORY_COLORS).map(([category, color]) => ({
    category,
    color,
    count: thoughts.filter(t => t.category === category).length,
  })).filter(s => s.count > 0)

  const mostConnected = thoughts
    .map(t => ({
      thought: t,
      connectionCount: connections.filter(c => c.fromThought === t.id || c.toThought === t.id).length
    }))
    .sort((a, b) => b.connectionCount - a.connectionCount)
    .slice(0, 5)
  
  const recentThoughts = [...thoughts]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5)
  
  // Connection count helper
  const getConnectionCount = (thoughtId: string) => 
    connections.filter(c => c.fromThought === thoughtId || c.toThought === thoughtId).length

  // Enhanced search filtering with categories, importance, and sorting
  const filteredThoughts = useMemo(() => {
    let results = [...thoughts]
    
    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      results = results.filter(t => 
        t.content.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query)
      )
    }
    
    // Category filter
    if (selectedCategories.size > 0) {
      results = results.filter(t => selectedCategories.has(t.category))
    }
    
    // Importance filter
    if (minImportance > 0) {
      results = results.filter(t => t.importance >= minImportance)
    }
    
    // Sorting
    switch (sortBy) {
      case 'recent':
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'oldest':
        results.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'importance':
        results.sort((a, b) => b.importance - a.importance)
        break
      case 'connections':
        results.sort((a, b) => getConnectionCount(b.id) - getConnectionCount(a.id))
        break
      case 'alphabetical':
        results.sort((a, b) => a.content.localeCompare(b.content))
        break
    }
    
    return results
  }, [thoughts, searchQuery, selectedCategories, minImportance, sortBy, connections])

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredThoughts.length])

  // Keyboard navigation for search results
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (filteredThoughts.length === 0) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, filteredThoughts.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredThoughts[selectedIndex]) {
          onNavigateToThought?.(filteredThoughts[selectedIndex].id)
          onClose()
        }
        break
    }
  }

  // Toggle category filter
  const toggleCategory = (category: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategories(new Set())
    setMinImportance(0)
    setSortBy('recent')
  }

  const hasActiveFilters = searchQuery || selectedCategories.size > 0 || minImportance > 0 || sortBy !== 'recent'
  
  const configSnippet = `{
  "mcpServers": {
    "the-mind": {
      "command": "${exePath}",
      "args": ["--mcp"]
    }
  }
}`

  const copyConfig = () => {
    navigator.clipboard.writeText(configSnippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const configPath = navigator.platform.includes('Win')
    ? '%APPDATA%\\Claude\\claude_desktop_config.json'
    : '~/Library/Application Support/Claude/claude_desktop_config.json'


  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '🧠' },
    { id: 'search', label: 'Search', icon: '🔍' },
    { id: 'export', label: 'Export', icon: '📤' },
    { id: 'connect', label: 'Connect', icon: '🔗' },
    { id: 'thinking', label: 'Thinking', icon: '💭' },
    { id: 'dream', label: 'Dream', icon: '🌙' },
    { id: 'timeline', label: 'Timeline', icon: '⏱️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ]

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div 
        className="w-full max-w-4xl h-[85vh] rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(20, 20, 35, 0.98) 0%, rgba(10, 10, 20, 0.99) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6), 0 0 60px rgba(59, 130, 246, 0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{
                background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
                boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
              }}
            >
              🧠
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Command Center</h1>
              <p className="text-xs text-white/40">The Mind • {thoughts.length} thoughts • {connections.length} connections</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all"
          >
            ✕
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex gap-1 px-6 py-3 border-b border-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6" style={{ maxHeight: 'calc(85vh - 140px)' }}>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Total Thoughts" value={thoughts.length} icon="💭" color="#3B82F6" />
                <StatCard label="Connections" value={connections.length} icon="🔗" color="#8B5CF6" />
                <StatCard label="Categories" value={categoryStats.length} icon="📁" color="#10B981" />
              </div>
              
              {/* Category Breakdown */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                <h3 className="text-sm font-semibold text-white/80 mb-4">Categories</h3>
                <div className="space-y-3">
                  {categoryStats.map(({ category, color, count }) => (
                    <div key={category} className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ background: color, boxShadow: `0 0 10px ${color}50` }}
                      />
                      <span className="text-sm text-white/70 capitalize flex-1">{category}</span>
                      <span className="text-sm text-white/50">{count}</span>
                      <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full"
                          style={{ 
                            width: `${(count / thoughts.length) * 100}%`,
                            background: color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Most Connected Thoughts */}
              {mostConnected.length > 0 && (
                <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                  <h3 className="text-sm font-semibold text-white/80 mb-4">🔥 Most Connected</h3>
                  <div className="space-y-2">
                    {mostConnected.map(({ thought, connectionCount }) => (
                      <div 
                        key={thought.id}
                        onClick={() => onNavigateToThought?.(thought.id)}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-all"
                      >
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ background: CATEGORY_COLORS[thought.category] }}
                        />
                        <span className="text-sm text-white/80 flex-1 truncate">{thought.content}</span>
                        <span className="text-xs text-white/40">{connectionCount} links</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Thoughts */}
              {recentThoughts.length > 0 && (
                <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                  <h3 className="text-sm font-semibold text-white/80 mb-4">🕐 Recent</h3>
                  <div className="space-y-2">
                    {recentThoughts.map((thought) => (
                      <div 
                        key={thought.id}
                        onClick={() => onNavigateToThought?.(thought.id)}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer transition-all"
                      >
                        <div 
                          className="w-2 h-2 rounded-full"
                          style={{ background: CATEGORY_COLORS[thought.category] }}
                        />
                        <span className="text-sm text-white/80 flex-1 truncate">{thought.content}</span>
                        <span className="text-xs text-white/40">
                          {formatTimeAgo(new Date(thought.createdAt))}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'search' && (
            <div className="space-y-4">
              {/* Search Input */}
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search thoughts... (↑↓ to navigate, Enter to select)"
                  className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#3B82F6]/50 focus:ring-1 focus:ring-[#3B82F6]/30 transition-all"
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 text-sm">
                  {filteredThoughts.length} results
                </span>
              </div>

              {/* Filters Row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Category Filters */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">Categories:</span>
                  {Object.entries(CATEGORY_COLORS).map(([category, color]) => (
                    <button
                      key={category}
                      onClick={() => toggleCategory(category)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        selectedCategories.has(category)
                          ? 'bg-white/20 text-white'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
                      }`}
                    >
                      <div 
                        className="w-2 h-2 rounded-full"
                        style={{ background: color }}
                      />
                      <span className="capitalize">{category}</span>
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div className="h-6 w-px bg-white/10" />

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white/80 focus:outline-none focus:border-[#3B82F6]/50"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="oldest">Oldest First</option>
                    <option value="importance">Importance</option>
                    <option value="connections">Most Connected</option>
                    <option value="alphabetical">Alphabetical</option>
                  </select>
                </div>

                {/* Divider */}
                <div className="h-6 w-px bg-white/10" />

                {/* Importance Slider */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40">Min importance:</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={minImportance * 100}
                    onChange={(e) => setMinImportance(Number(e.target.value) / 100)}
                    className="w-20 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#3B82F6]"
                  />
                  <span className="text-xs text-white/50 w-8">{Math.round(minImportance * 100)}%</span>
                </div>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <>
                    <div className="h-6 w-px bg-white/10" />
                    <button
                      onClick={clearFilters}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-all"
                    >
                      Clear filters
                    </button>
                  </>
                )}
              </div>

              {/* Results */}
              {filteredThoughts.length > 0 ? (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                  {filteredThoughts.map((thought, index) => (
                    <div 
                      key={thought.id}
                      onClick={() => {
                        onNavigateToThought?.(thought.id)
                        onClose()
                      }}
                      className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all group ${
                        index === selectedIndex
                          ? 'bg-[#3B82F6]/20 border border-[#3B82F6]/30'
                          : 'bg-white/5 hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      <div 
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ background: CATEGORY_COLORS[thought.category] }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/90 truncate">{thought.content}</p>
                        <p className="text-xs text-white/40 mt-1">
                          {thought.category} • {Math.round(thought.importance * 100)}% • {getConnectionCount(thought.id)} connections • {formatTimeAgo(new Date(thought.createdAt))}
                        </p>
                      </div>
                      <span className="text-white/30 group-hover:text-white/60 transition-colors">→</span>
                    </div>
                  ))}
                </div>
              ) : thoughts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-white/40 text-lg mb-2">No thoughts yet</p>
                  <p className="text-white/30 text-sm">Start chatting with Claude to populate The Mind</p>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-white/40 text-lg mb-2">No matching thoughts</p>
                  <p className="text-white/30 text-sm">Try adjusting your filters or search terms</p>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'export' && (
            <ExportTab thoughts={thoughts} connections={connections} />
          )}
          
          {activeTab === 'connect' && (
            <div className="space-y-4">
              <div 
                className="bg-gradient-to-r from-[#3B82F6]/10 to-[#8B5CF6]/10 border border-[#3B82F6]/30 rounded-xl p-5"
              >
                <h3 className="text-white/90 font-medium mb-2">🔗 Claude Desktop Integration</h3>
                <p className="text-white/60 text-sm">
                  Connect The Mind to Claude Desktop to automatically capture thoughts and connections 
                  as you chat. Your conversations become a visual knowledge graph.
                </p>
              </div>

              {/* Step 1 */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-6 h-6 rounded-full bg-[#3B82F6]/20 text-[#3B82F6] text-xs font-bold flex items-center justify-center">1</span>
                  <h4 className="text-white/80 font-medium">Copy MCP Configuration</h4>
                </div>
                <div className="relative">
                  <pre className="bg-black/40 p-4 rounded-lg text-xs text-[#10B981] overflow-x-auto whitespace-pre-wrap font-mono">
                    {configSnippet}
                  </pre>
                  <button
                    onClick={copyConfig}
                    className="absolute top-3 right-3 px-3 py-1.5 bg-[#3B82F6]/20 hover:bg-[#3B82F6]/40 rounded-lg text-xs text-white/80 transition-all"
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              
              {/* Step 2 */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-6 h-6 rounded-full bg-[#3B82F6]/20 text-[#3B82F6] text-xs font-bold flex items-center justify-center">2</span>
                  <h4 className="text-white/80 font-medium">Add to Config File</h4>
                </div>
                <p className="text-white/60 text-sm mb-3">Open this file:</p>
                <code className="block bg-black/40 px-4 py-2 rounded-lg text-[#F59E0B] text-sm">
                  {configPath}
                </code>
                <div className="mt-4 p-3 bg-white/5 rounded-lg">
                  <p className="text-white/60 text-xs">
                    <strong className="text-white/80">Quick access:</strong> Press Win+R → type <code className="text-[#10B981]">%APPDATA%\Claude</code>
                  </p>
                </div>
              </div>
              
              {/* Step 3 */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-6 h-6 rounded-full bg-[#3B82F6]/20 text-[#3B82F6] text-xs font-bold flex items-center justify-center">3</span>
                  <h4 className="text-white/80 font-medium">Restart Claude Desktop</h4>
                </div>
                <p className="text-white/60 text-sm">
                  Close and reopen Claude Desktop. Keep The Mind running to see thoughts appear in real-time!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'timeline' && (
            <TimelineTab thoughts={thoughts} onClose={onClose} />
          )}

          {activeTab === 'dream' && (
            <DreamTab onClose={onClose} />
          )}

          {activeTab === 'thinking' && (
            <ThinkingTab thoughts={thoughts} connections={connections} />
          )}

          {activeTab === 'settings' && (
            <SettingsTab />
          )}
        </div>
      </div>
    </div>
  )
}


// Helper Components
function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div 
      className="rounded-xl p-4 border border-white/5"
      style={{ background: `linear-gradient(135deg, ${color}10 0%, transparent 100%)` }}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg">{icon}</span>
        <span className="text-2xl font-bold text-white">{value}</span>
      </div>
      <p className="text-xs text-white/50">{label}</p>
    </div>
  )
}

function SettingRow({ label, description, value }: { label: string; description: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-white/80">{label}</p>
        <p className="text-xs text-white/40">{description}</p>
      </div>
      <span className="text-sm text-white/60 bg-white/5 px-3 py-1 rounded-lg">{value}</span>
    </div>
  )
}

function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {keys.map((key, i) => (
          <kbd key={i} className="px-2 py-1 bg-white/10 rounded text-xs text-white/70 font-mono">
            {key}
          </kbd>
        ))}
      </div>
      <span className="text-white/50">{action}</span>
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return date.toLocaleDateString()
}

// Export Tab Component
function ExportTab({ thoughts, connections }: { thoughts: Thought[]; connections: Connection[] }) {
  const [exportStatus, setExportStatus] = useState<string | null>(null)
  
  // Export as JSON
  const exportJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      thoughts: thoughts.map(t => ({
        id: t.id,
        content: t.content,
        category: t.category,
        importance: t.importance,
        position: t.position,
        createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
      })),
      connections: connections.map(c => ({
        id: c.id,
        from: c.fromThought,
        to: c.toThought,
        strength: c.strength,
        reason: c.reason,
        createdAt: c.createdAt instanceof Date ? c.createdAt.toISOString() : c.createdAt,
      })),
      stats: {
        totalThoughts: thoughts.length,
        totalConnections: connections.length,
        categories: Object.entries(CATEGORY_COLORS).map(([cat]) => ({
          name: cat,
          count: thoughts.filter(t => t.category === cat).length
        })).filter(c => c.count > 0)
      }
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    downloadBlob(blob, `the-mind-export-${formatDate(new Date())}.json`)
    setExportStatus('JSON exported!')
    setTimeout(() => setExportStatus(null), 2000)
  }
  
  // Export as Markdown
  const exportMarkdown = () => {
    const categoryGroups = Object.entries(CATEGORY_COLORS).map(([category]) => ({
      category,
      thoughts: thoughts.filter(t => t.category === category)
        .sort((a, b) => b.importance - a.importance)
    })).filter(g => g.thoughts.length > 0)
    
    let md = `# The Mind Export\n`
    md += `\n> Exported on ${new Date().toLocaleString()}\n`
    md += `\n## Summary\n`
    md += `- **Total Thoughts:** ${thoughts.length}\n`
    md += `- **Total Connections:** ${connections.length}\n`
    md += `\n---\n`
    
    for (const group of categoryGroups) {
      md += `\n## ${group.category.charAt(0).toUpperCase() + group.category.slice(1)} (${group.thoughts.length})\n\n`
      
      for (const thought of group.thoughts) {
        const connCount = connections.filter(c => c.fromThought === thought.id || c.toThought === thought.id).length
        md += `### ${thought.content}\n`
        md += `- Importance: ${Math.round(thought.importance * 100)}%\n`
        md += `- Connections: ${connCount}\n`
        md += `- Created: ${thought.createdAt instanceof Date ? thought.createdAt.toLocaleString() : new Date(thought.createdAt).toLocaleString()}\n\n`
        
        // List connections for this thought
        const thoughtConnections = connections.filter(c => c.fromThought === thought.id || c.toThought === thought.id)
        if (thoughtConnections.length > 0) {
          md += `**Connected to:**\n`
          for (const conn of thoughtConnections) {
            const otherId = conn.fromThought === thought.id ? conn.toThought : conn.fromThought
            const other = thoughts.find(t => t.id === otherId)
            if (other) {
              md += `- ${other.content.substring(0, 50)}${other.content.length > 50 ? '...' : ''} *(${conn.reason || 'linked'})*\n`
            }
          }
          md += `\n`
        }
      }
    }
    
    const blob = new Blob([md], { type: 'text/markdown' })
    downloadBlob(blob, `the-mind-export-${formatDate(new Date())}.md`)
    setExportStatus('Markdown exported!')
    setTimeout(() => setExportStatus(null), 2000)
  }
  
  // Export as CSV
  const exportCSV = () => {
    // Thoughts CSV
    let csv = 'ID,Content,Category,Importance,Connections,Created\n'
    for (const t of thoughts) {
      const connCount = connections.filter(c => c.fromThought === t.id || c.toThought === t.id).length
      const content = t.content.replace(/"/g, '""') // Escape quotes
      const createdStr = t.createdAt instanceof Date ? t.createdAt.toLocaleString() : new Date(t.createdAt).toLocaleString()
      csv += `"${t.id}","${content}","${t.category}",${Math.round(t.importance * 100)}%,${connCount},"${createdStr}"\n`
    }
    
    const blob = new Blob([csv], { type: 'text/csv' })
    downloadBlob(blob, `the-mind-thoughts-${formatDate(new Date())}.csv`)
    setExportStatus('CSV exported!')
    setTimeout(() => setExportStatus(null), 2000)
  }
  
  // Copy to clipboard as text
  const copyToClipboard = () => {
    let text = `The Mind - ${thoughts.length} thoughts, ${connections.length} connections\n\n`
    
    for (const t of thoughts.sort((a, b) => b.importance - a.importance)) {
      text += `[${t.category}] ${t.content} (${Math.round(t.importance * 100)}%)\n`
    }
    
    navigator.clipboard.writeText(text)
    setExportStatus('Copied to clipboard!')
    setTimeout(() => setExportStatus(null), 2000)
  }
  
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#10B981]/10 to-[#3B82F6]/10 border border-[#10B981]/30 rounded-xl p-5">
        <h3 className="text-white/90 font-medium mb-2">📤 Export Your Mind</h3>
        <p className="text-white/60 text-sm">
          Save your thoughts and connections in various formats for backup, sharing, or analysis.
        </p>
      </div>
      
      {/* Export Status */}
      {exportStatus && (
        <div className="bg-[#10B981]/20 border border-[#10B981]/30 rounded-xl p-4 text-center">
          <span className="text-[#10B981] font-medium">✓ {exportStatus}</span>
        </div>
      )}
      
      {/* Export Options */}
      <div className="grid grid-cols-2 gap-4">
        <ExportCard
          icon="📁"
          title="JSON (Full Backup)"
          description="Complete data export with all metadata. Best for backups and re-importing."
          onClick={exportJSON}
          color="#3B82F6"
        />
        <ExportCard
          icon="📝"
          title="Markdown"
          description="Human-readable document organized by category. Great for documentation."
          onClick={exportMarkdown}
          color="#8B5CF6"
        />
        <ExportCard
          icon="📊"
          title="CSV (Spreadsheet)"
          description="Tabular format for Excel/Google Sheets analysis."
          onClick={exportCSV}
          color="#10B981"
        />
        <ExportCard
          icon="📋"
          title="Copy to Clipboard"
          description="Quick text summary of all thoughts for pasting anywhere."
          onClick={copyToClipboard}
          color="#F59E0B"
        />
      </div>
      
      {/* Stats Preview */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/5">
        <h4 className="text-white/80 font-medium mb-3">Export Preview</h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-white">{thoughts.length}</p>
            <p className="text-xs text-white/50">Thoughts</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{connections.length}</p>
            <p className="text-xs text-white/50">Connections</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              {Object.entries(CATEGORY_COLORS).filter(([cat]) => 
                thoughts.some(t => t.category === cat)
              ).length}
            </p>
            <p className="text-xs text-white/50">Categories</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ExportCard({ icon, title, description, onClick, color }: {
  icon: string
  title: string
  description: string
  onClick: () => void
  color: string
}) {
  return (
    <button
      onClick={onClick}
      className="text-left p-5 rounded-xl border border-white/5 hover:border-white/20 transition-all group"
      style={{ background: `linear-gradient(135deg, ${color}10 0%, transparent 100%)` }}
    >
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{icon}</span>
        <span className="text-white/90 font-medium group-hover:text-white transition-colors">{title}</span>
      </div>
      <p className="text-xs text-white/50 group-hover:text-white/60 transition-colors">{description}</p>
    </button>
  )
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// Thinking Tab Component - "Watch It Think" visualization controls
function ThinkingTab({ thoughts, connections }: { thoughts: Thought[]; connections: Connection[] }) {
  const { 
    isThinking, 
    activePath, 
    pathProgress, 
    traversalSpeed, 
    startThinking, 
    stopThinking, 
    setTraversalSpeed 
  } = useThinkingStore()
  
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  
  // Toggle node selection for manual path creation
  const toggleNodeSelection = (thoughtId: string) => {
    setSelectedNodes(prev => {
      if (prev.includes(thoughtId)) {
        return prev.filter(id => id !== thoughtId)
      }
      return [...prev, thoughtId]
    })
  }
  
  // Start a thinking animation with selected nodes
  const triggerSelectedPath = () => {
    if (selectedNodes.length >= 2) {
      const synthesisId = selectedNodes[selectedNodes.length - 1]
      startThinking(selectedNodes, synthesisId)
    }
  }
  
  // Demo: random path through connected nodes
  const triggerRandomPath = () => {
    if (thoughts.length < 2) return
    
    // Pick a random starting node
    const startIndex = Math.floor(Math.random() * thoughts.length)
    const startNode = thoughts[startIndex]
    
    // Build a path by following connections
    const path: string[] = [startNode.id]
    const visited = new Set([startNode.id])
    
    let currentId = startNode.id
    for (let i = 0; i < 4; i++) {
      // Find connections from current node
      const nextConnections = connections.filter(c => 
        (c.fromThought === currentId && !visited.has(c.toThought)) ||
        (c.toThought === currentId && !visited.has(c.fromThought))
      )
      
      if (nextConnections.length === 0) break
      
      // Pick a random connection
      const nextConn = nextConnections[Math.floor(Math.random() * nextConnections.length)]
      const nextId = nextConn.fromThought === currentId ? nextConn.toThought : nextConn.fromThought
      
      path.push(nextId)
      visited.add(nextId)
      currentId = nextId
    }
    
    if (path.length >= 2) {
      startThinking(path, path[path.length - 1])
    }
  }
  
  // Get thought content by ID
  const getThoughtContent = (id: string) => {
    const thought = thoughts.find(t => t.id === id)
    return thought ? thought.content.substring(0, 40) + (thought.content.length > 40 ? '...' : '') : 'Unknown'
  }
  
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-[#F59E0B]/10 to-[#EF4444]/10 border border-[#F59E0B]/30 rounded-xl p-5">
        <h3 className="text-white/90 font-medium mb-2">💭 Watch It Think</h3>
        <p className="text-white/60 text-sm">
          Visualize reasoning paths through your knowledge graph. See how ideas connect 
          as nodes light up in sequence, showing the "thinking" process.
        </p>
      </div>
      
      {/* Current Status */}
      <div className={`rounded-xl p-5 border transition-all ${
        isThinking 
          ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30' 
          : 'bg-white/5 border-white/5'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white/80 font-medium flex items-center gap-2">
            {isThinking && <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />}
            Status: {isThinking ? 'Thinking...' : 'Idle'}
          </h4>
          {isThinking && (
            <button
              onClick={stopThinking}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-xs transition-all"
            >
              Stop
            </button>
          )}
        </div>
        
        {isThinking && activePath.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <span>Progress:</span>
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#F59E0B] transition-all duration-300"
                  style={{ width: `${((pathProgress + 1) / activePath.length) * 100}%` }}
                />
              </div>
              <span>{pathProgress + 1} / {activePath.length}</span>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {activePath.map((nodeId, index) => (
                <div 
                  key={nodeId}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    index <= pathProgress
                      ? 'bg-[#F59E0B]/30 text-[#F59E0B] border border-[#F59E0B]/50'
                      : 'bg-white/5 text-white/40 border border-white/10'
                  }`}
                >
                  {index === pathProgress && '→ '}
                  {getThoughtContent(nodeId)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Quick Actions */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/5">
        <h4 className="text-white/80 font-medium mb-4">Quick Actions</h4>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={triggerRandomPath}
            disabled={thoughts.length < 2 || isThinking}
            className="p-4 rounded-xl bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-xl mb-2 block">🎲</span>
            <span className="text-sm text-white/80 font-medium">Random Path</span>
            <p className="text-xs text-white/50 mt-1">Follow random connections</p>
          </button>
          
          <button
            onClick={triggerSelectedPath}
            disabled={selectedNodes.length < 2 || isThinking}
            className="p-4 rounded-xl bg-[#8B5CF6]/10 hover:bg-[#8B5CF6]/20 border border-[#8B5CF6]/30 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-xl mb-2 block">✨</span>
            <span className="text-sm text-white/80 font-medium">Selected Path</span>
            <p className="text-xs text-white/50 mt-1">{selectedNodes.length} nodes selected</p>
          </button>
        </div>
      </div>
      
      {/* Speed Control */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/5">
        <h4 className="text-white/80 font-medium mb-4">Traversal Speed</h4>
        <div className="flex items-center gap-4">
          <span className="text-xs text-white/50">Slow</span>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={traversalSpeed}
            onChange={(e) => setTraversalSpeed(Number(e.target.value))}
            className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#F59E0B]"
          />
          <span className="text-xs text-white/50">Fast</span>
          <span className="text-sm text-white/60 w-20 text-right">{traversalSpeed} nodes/s</span>
        </div>
      </div>
      
      {/* Manual Node Selection */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white/80 font-medium">Build Custom Path</h4>
          {selectedNodes.length > 0 && (
            <button
              onClick={() => setSelectedNodes([])}
              className="text-xs text-white/50 hover:text-white/70"
            >
              Clear selection
            </button>
          )}
        </div>
        <p className="text-xs text-white/50 mb-3">
          Click nodes to build a custom reasoning path. Order matters!
        </p>
        <div className="max-h-48 overflow-y-auto space-y-1">
          {thoughts.slice(0, 20).map((thought) => {
            const selectionIndex = selectedNodes.indexOf(thought.id)
            const isSelected = selectionIndex !== -1
            
            return (
              <div
                key={thought.id}
                onClick={() => toggleNodeSelection(thought.id)}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#F59E0B]/20 border border-[#F59E0B]/30'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                {isSelected && (
                  <span className="w-5 h-5 rounded-full bg-[#F59E0B]/30 text-[#F59E0B] text-xs flex items-center justify-center font-bold">
                    {selectionIndex + 1}
                  </span>
                )}
                <div 
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: CATEGORY_COLORS[thought.category] }}
                />
                <span className="text-sm text-white/70 truncate flex-1">{thought.content}</span>
              </div>
            )
          })}
        </div>
        {thoughts.length > 20 && (
          <p className="text-xs text-white/40 mt-2 text-center">
            Showing first 20 thoughts. Use search to find more.
          </p>
        )}
      </div>
    </div>
  )
}


// Dream Tab Component - Ambient visualization mode
function DreamTab({ onClose }: { onClose: () => void }) {
  const { 
    isActive, 
    intensity, 
    enterDream, 
    exitDream, 
    setIntensity,
    sparkInterval,
    driftSpeed,
    glitchEnabled,
  } = useDreamStore()
  
  const intensityOptions: { id: DreamIntensity; label: string; icon: string; description: string; color: string }[] = [
    { 
      id: 'calm', 
      label: 'Calm', 
      icon: '🌙', 
      description: 'Gentle drifting, slow sparks. Peaceful meditation.',
      color: '#8B5CF6'
    },
    { 
      id: 'vivid', 
      label: 'Vivid', 
      icon: '✨', 
      description: 'More activity, faster connections. Active dreaming.',
      color: '#3B82F6'
    },
    { 
      id: 'nightmare', 
      label: 'Nightmare', 
      icon: '👁️', 
      description: 'Chaotic movement, rapid firing, glitch effects. Restless.',
      color: '#EF4444'
    },
  ]
  
  const handleToggle = () => {
    if (isActive) {
      exitDream()
    } else {
      enterDream(intensity)
      onClose() // Close command center to enjoy the dream
    }
  }
  
  const handleIntensityChange = (newIntensity: DreamIntensity) => {
    setIntensity(newIntensity)
    if (isActive) {
      // Re-enter with new intensity
      enterDream(newIntensity)
    }
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`rounded-xl p-5 border transition-all ${
        isActive 
          ? intensity === 'nightmare'
            ? 'bg-gradient-to-r from-[#EF4444]/20 to-[#7C3AED]/20 border-[#EF4444]/30'
            : 'bg-gradient-to-r from-[#8B5CF6]/20 to-[#3B82F6]/20 border-[#8B5CF6]/30'
          : 'bg-gradient-to-r from-[#8B5CF6]/10 to-[#3B82F6]/10 border-[#8B5CF6]/20'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white/90 font-medium flex items-center gap-2">
            {isActive && <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-pulse" />}
            🌙 Dream Mode
          </h3>
          <button
            onClick={handleToggle}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              isActive
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white'
            }`}
          >
            {isActive ? '☀️ Wake Up' : '🌙 Enter Dream'}
          </button>
        </div>
        <p className="text-white/60 text-sm">
          {isActive 
            ? `Currently dreaming in ${intensity} mode. Thoughts drift and spark randomly.`
            : 'Watch your mind dream. Thoughts drift through space, randomly sparking and connecting.'
          }
        </p>
      </div>
      
      {/* Intensity Selection */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/5">
        <h4 className="text-white/80 font-medium mb-4">Dream Intensity</h4>
        <div className="grid grid-cols-3 gap-3">
          {intensityOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => handleIntensityChange(option.id)}
              className={`p-4 rounded-xl border text-left transition-all ${
                intensity === option.id
                  ? 'border-white/30 bg-white/10'
                  : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{option.icon}</span>
                <span 
                  className="text-sm font-medium"
                  style={{ color: intensity === option.id ? option.color : 'rgba(255,255,255,0.8)' }}
                >
                  {option.label}
                </span>
              </div>
              <p className="text-xs text-white/50">{option.description}</p>
            </button>
          ))}
        </div>
      </div>
      
      {/* Current Stats (when active) */}
      {isActive && (
        <div className="bg-white/5 rounded-xl p-5 border border-white/5">
          <h4 className="text-white/80 font-medium mb-4">Dream Stats</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xs text-white/50 mb-1">Spark Rate</p>
              <p className="text-lg font-medium text-white/80">
                Every {(sparkInterval / 1000).toFixed(1)}s
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xs text-white/50 mb-1">Drift Speed</p>
              <p className="text-lg font-medium text-white/80">
                {driftSpeed < 0.5 ? 'Slow' : driftSpeed < 1 ? 'Moderate' : 'Fast'}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xs text-white/50 mb-1">Glitch Effects</p>
              <p className="text-lg font-medium text-white/80">
                {glitchEnabled ? '👁️ Enabled' : 'Disabled'}
              </p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xs text-white/50 mb-1">Mode</p>
              <p className="text-lg font-medium capitalize" style={{ 
                color: intensityOptions.find(o => o.id === intensity)?.color 
              }}>
                {intensity}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Description */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/5">
        <h4 className="text-white/80 font-medium mb-3">What Happens in Dream Mode</h4>
        <div className="space-y-3 text-sm text-white/60">
          <div className="flex items-start gap-3">
            <span className="text-lg">🌊</span>
            <div>
              <p className="text-white/80 font-medium">Drifting Thoughts</p>
              <p>Nodes float gently through space in wave-like patterns</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-lg">⚡</span>
            <div>
              <p className="text-white/80 font-medium">Random Sparks</p>
              <p>Thoughts light up randomly, like memories surfacing</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-lg">🔮</span>
            <div>
              <p className="text-white/80 font-medium">Living Connections</p>
              <p>Watch as related thoughts pulse and glow together</p>
            </div>
          </div>
          {intensity === 'nightmare' && (
            <div className="flex items-start gap-3">
              <span className="text-lg">👁️</span>
              <div>
                <p className="text-[#EF4444] font-medium">Nightmare Effects</p>
                <p>Chaotic movement, rapid firing, occasional glitches</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Tip */}
      <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 rounded-xl p-4 text-center">
        <p className="text-sm text-white/60">
          💡 <span className="text-white/80">Tip:</span> Dream mode is perfect for ambient background visualization. 
          Let it run while you work - watch your mind dream.
        </p>
      </div>
    </div>
  )
}


// Timeline Tab Component - Scrub through time
function TimelineTab({ thoughts, onClose }: { thoughts: Thought[]; onClose: () => void }) {
  const { 
    isActive, 
    currentTime,
    startTime,
    endTime,
    isPlaying,
    playbackSpeed,
    enterTimeline, 
    exitTimeline,
    setProgress,
    getProgress,
    togglePlayback,
    setPlaybackSpeed,
  } = useTimelineStore()
  
  const progress = getProgress()
  
  // Count visible thoughts at current time
  const visibleCount = useMemo(() => {
    if (!isActive) return thoughts.length
    return thoughts.filter(t => {
      const time = t.createdAt instanceof Date ? t.createdAt.getTime() : new Date(t.createdAt).getTime()
      return time <= currentTime
    }).length
  }, [thoughts, currentTime, isActive])
  
  const handleEnter = () => {
    enterTimeline(thoughts)
    onClose() // Close to see the visualization
  }
  
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProgress(Number(e.target.value) / 100)
  }
  
  const speedOptions = [
    { value: 10, label: '10x' },
    { value: 50, label: '50x' },
    { value: 100, label: '100x' },
    { value: 500, label: '500x' },
    { value: 1000, label: '1000x' },
  ]
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`rounded-xl p-5 border transition-all ${
        isActive 
          ? 'bg-gradient-to-r from-[#F59E0B]/20 to-[#EF4444]/20 border-[#F59E0B]/30'
          : 'bg-gradient-to-r from-[#F59E0B]/10 to-[#3B82F6]/10 border-[#F59E0B]/20'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white/90 font-medium flex items-center gap-2">
            {isActive && <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />}
            ⏱️ Timeline View
          </h3>
          <button
            onClick={isActive ? exitTimeline : handleEnter}
            disabled={thoughts.length === 0}
            className={`px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50 ${
              isActive
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-[#F59E0B] hover:bg-[#D97706] text-white'
            }`}
          >
            {isActive ? '⏹️ Exit Timeline' : '⏱️ Enter Timeline'}
          </button>
        </div>
        <p className="text-white/60 text-sm">
          {isActive 
            ? `Viewing ${visibleCount} of ${thoughts.length} thoughts. Scrub to travel through time.`
            : 'Watch your mind evolve. Scrub through time to see thoughts appear and connections form.'
          }
        </p>
      </div>
      
      {/* Timeline Controls (when active) */}
      {isActive && (
        <>
          {/* Current Time Display */}
          <div className="bg-white/5 rounded-xl p-5 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-white/50 mb-1">Current Time</p>
                <p className="text-lg font-medium text-white/90">
                  {formatTimelineTime(currentTime)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/50 mb-1">Thoughts Visible</p>
                <p className="text-lg font-medium text-[#F59E0B]">
                  {visibleCount} / {thoughts.length}
                </p>
              </div>
            </div>
            
            {/* Timeline Slider */}
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="100"
                value={progress * 100}
                onChange={handleSliderChange}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#F59E0B]"
                style={{
                  background: `linear-gradient(to right, #F59E0B ${progress * 100}%, rgba(255,255,255,0.1) ${progress * 100}%)`
                }}
              />
              <div className="flex justify-between text-xs text-white/40">
                <span>{formatTimelineTime(startTime)}</span>
                <span>{formatTimelineTime(endTime)}</span>
              </div>
            </div>
          </div>
          
          {/* Playback Controls */}
          <div className="bg-white/5 rounded-xl p-5 border border-white/5">
            <h4 className="text-white/80 font-medium mb-4">Playback</h4>
            
            <div className="flex items-center gap-4 mb-4">
              {/* Play/Pause Button */}
              <button
                onClick={togglePlayback}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all ${
                  isPlaying
                    ? 'bg-[#F59E0B] text-white'
                    : 'bg-white/10 hover:bg-white/20 text-white/80'
                }`}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
              
              {/* Speed Controls */}
              <div className="flex-1">
                <p className="text-xs text-white/50 mb-2">Speed: {playbackSpeed}x</p>
                <div className="flex gap-2">
                  {speedOptions.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setPlaybackSpeed(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        playbackSpeed === opt.value
                          ? 'bg-[#F59E0B]/30 text-[#F59E0B] border border-[#F59E0B]/50'
                          : 'bg-white/5 text-white/60 hover:bg-white/10 border border-transparent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Quick Jump */}
            <div className="flex gap-2">
              <button
                onClick={() => setProgress(0)}
                className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 transition-all"
              >
                ⏮️ Start
              </button>
              <button
                onClick={() => setProgress(0.25)}
                className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 transition-all"
              >
                25%
              </button>
              <button
                onClick={() => setProgress(0.5)}
                className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 transition-all"
              >
                50%
              </button>
              <button
                onClick={() => setProgress(0.75)}
                className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 transition-all"
              >
                75%
              </button>
              <button
                onClick={() => setProgress(1)}
                className="flex-1 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white/70 transition-all"
              >
                ⏭️ End
              </button>
            </div>
          </div>
          
          {/* Stats */}
          <div className="bg-white/5 rounded-xl p-5 border border-white/5">
            <h4 className="text-white/80 font-medium mb-4">Timeline Stats</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-xs text-white/50 mb-1">Duration</p>
                <p className="text-lg font-medium text-white/80">
                  {formatDuration(endTime - startTime)}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-xs text-white/50 mb-1">Progress</p>
                <p className="text-lg font-medium text-[#F59E0B]">
                  {Math.round(progress * 100)}%
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-xs text-white/50 mb-1">Status</p>
                <p className="text-lg font-medium text-white/80">
                  {isPlaying ? '▶️ Playing' : '⏸️ Paused'}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* Description (when not active) */}
      {!isActive && (
        <div className="bg-white/5 rounded-xl p-5 border border-white/5">
          <h4 className="text-white/80 font-medium mb-3">What Timeline View Does</h4>
          <div className="space-y-3 text-sm text-white/60">
            <div className="flex items-start gap-3">
              <span className="text-lg">🎬</span>
              <div>
                <p className="text-white/80 font-medium">Watch Your Mind Grow</p>
                <p>See thoughts appear in chronological order as they were created</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">🔗</span>
              <div>
                <p className="text-white/80 font-medium">Connections Form</p>
                <p>Watch as links between thoughts appear over time</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">⏱️</span>
              <div>
                <p className="text-white/80 font-medium">Scrub Through Time</p>
                <p>Drag the slider to jump to any point in your mind's history</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-lg">▶️</span>
              <div>
                <p className="text-white/80 font-medium">Playback Controls</p>
                <p>Press play to animate through time at various speeds</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* No thoughts warning */}
      {thoughts.length === 0 && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 rounded-xl p-4 text-center">
          <p className="text-sm text-white/60">
            ⚠️ No thoughts yet. Start chatting with Claude to populate The Mind.
          </p>
        </div>
      )}
    </div>
  )
}


// Wallpaper Settings Component
function WallpaperSettings() {
  const {
    displayMode,
    monitors,
    orbitSpeed,
    driftAmount,
    selectedMonitorBounds,
    setDisplayMode,
    setOrbitSpeed,
    setDriftAmount,
    refreshMonitors
  } = useWallpaperStore()

  // Check if a monitor's bounds match the selected bounds
  const isMonitorSelected = (monitor: { x: number; y: number; width: number; height: number }) => {
    if (displayMode === 'all' || !selectedMonitorBounds) return false
    return (
      monitor.x === selectedMonitorBounds.x &&
      monitor.y === selectedMonitorBounds.y &&
      monitor.width === selectedMonitorBounds.width &&
      monitor.height === selectedMonitorBounds.height
    )
  }

  // Refresh monitors on mount
  useEffect(() => {
    refreshMonitors()
  }, [refreshMonitors])

  return (
    <div className="bg-white/5 rounded-xl p-5 border border-white/5">
      <h3 className="text-white/80 font-medium mb-4 flex items-center gap-2">
        <span className="text-lg">🖼️</span> Wallpaper Mode
        <span className="text-xs text-white/40 ml-auto">Press F10 to toggle</span>
      </h3>

      {/* Monitor Selection */}
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-white/70">Display</span>
          <button
            onClick={() => refreshMonitors()}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Refresh
          </button>
        </div>
        <div className="space-y-2">
          {/* All Monitors Option */}
          <label
            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
              displayMode === 'all'
                ? 'bg-purple-500/20 border border-purple-500/30'
                : 'bg-white/5 hover:bg-white/10 border border-transparent'
            }`}
          >
            <input
              type="radio"
              name="displayMode"
              checked={displayMode === 'all'}
              onChange={() => setDisplayMode('all', null)}
              className="sr-only"
            />
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              displayMode === 'all' ? 'border-purple-400' : 'border-white/30'
            }`}>
              {displayMode === 'all' && <div className="w-2 h-2 rounded-full bg-purple-400" />}
            </div>
            <div className="flex-1">
              <span className="text-white/90">All Monitors</span>
              <p className="text-xs text-white/50">Span across all displays</p>
            </div>
            <span className="text-xs text-white/40">
              {monitors.length} detected
            </span>
          </label>

          {/* Individual Monitor Options */}
          {monitors.map((monitor, index) => {
            const isSelected = isMonitorSelected(monitor)
            return (
              <label
                key={`${monitor.x}-${monitor.y}-${monitor.width}-${monitor.height}`}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-purple-500/20 border border-purple-500/30'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                }`}
              >
                <input
                  type="radio"
                  name="displayMode"
                  checked={isSelected}
                  onChange={() => setDisplayMode(index, { x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height })}
                  className="sr-only"
                />
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  isSelected ? 'border-purple-400' : 'border-white/30'
                }`}>
                  {isSelected && <div className="w-2 h-2 rounded-full bg-purple-400" />}
                </div>
                <div className="flex-1">
                  <span className="text-white/90">
                    Monitor {index + 1}
                    {monitor.is_primary && <span className="text-xs text-purple-400 ml-2">(Primary)</span>}
                  </span>
                  <p className="text-xs text-white/50">
                    {monitor.width}×{monitor.height} @ ({monitor.x}, {monitor.y})
                  </p>
                </div>
              </label>
            )
          })}

          {monitors.length === 0 && (
            <div className="text-center py-4 text-white/40 text-sm">
              No monitors detected. Click Refresh.
            </div>
          )}
        </div>
      </div>

      {/* Orbit Speed */}
      <div className="mb-4">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-white/70">Camera Orbit Speed</span>
          <span className="text-sm text-purple-400 font-mono">{orbitSpeed.toFixed(3)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="0.1"
          step="0.005"
          value={orbitSpeed}
          onChange={(e) => setOrbitSpeed(parseFloat(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
        <div className="flex justify-between text-xs text-white/40 mt-1">
          <span>Still</span>
          <span>Fast</span>
        </div>
      </div>

      {/* Drift Amount */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm text-white/70">Drift Intensity</span>
          <span className="text-sm text-purple-400 font-mono">{driftAmount.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="20"
          step="1"
          value={driftAmount}
          onChange={(e) => setDriftAmount(parseFloat(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
        <div className="flex justify-between text-xs text-white/40 mt-1">
          <span>Minimal</span>
          <span>Floaty</span>
        </div>
      </div>
    </div>
  )
}

// Settings Tab Component - Visual effects and controls
function SettingsTab() {
  const [, forceUpdate] = useState(0)

  // Force re-render when settings change
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 100)
    return () => clearInterval(interval)
  }, [])

  const handleDofChange = (key: keyof typeof dofSettings, value: number | boolean) => {
    (dofSettings as any)[key] = value
  }

  return (
    <div className="space-y-4">
      {/* Visual Effects - DOF */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/5">
        <h3 className="text-white/80 font-medium mb-4 flex items-center gap-2">
          <span className="text-lg">🎥</span> Depth of Field
        </h3>

        {/* DoF Enable Toggle */}
        <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg mb-4 cursor-pointer hover:bg-white/10 transition-colors">
          <div>
            <span className="text-white/90">Enable DOF</span>
            <p className="text-xs text-white/50">Blur objects not in focus</p>
          </div>
          <div className="relative">
            <input
              type="checkbox"
              checked={dofSettings.enabled}
              onChange={(e) => handleDofChange('enabled', e.target.checked)}
              className="sr-only"
            />
            <div className={`w-11 h-6 rounded-full transition-colors ${dofSettings.enabled ? 'bg-blue-500' : 'bg-white/20'}`}>
              <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${dofSettings.enabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
            </div>
          </div>
        </label>

        {/* Bokeh Scale */}
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-white/70">Blur Amount</span>
            <span className="text-sm text-blue-400 font-mono">{dofSettings.bokehScale.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min="0"
            max="15"
            step="0.5"
            value={dofSettings.bokehScale}
            onChange={(e) => handleDofChange('bokehScale', parseFloat(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-white/40 mt-1">
            <span>Sharp</span>
            <span>Dreamy</span>
          </div>
        </div>

        {/* Focal Length */}
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-white/70">Focus Depth</span>
            <span className="text-sm text-blue-400 font-mono">{dofSettings.focalLength.toFixed(3)}</span>
          </div>
          <input
            type="range"
            min="0.001"
            max="0.1"
            step="0.001"
            value={dofSettings.focalLength}
            onChange={(e) => handleDofChange('focalLength', parseFloat(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-white/40 mt-1">
            <span>Wide</span>
            <span>Shallow</span>
          </div>
        </div>

        {/* Focus Speed */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-white/70">Focus Transition</span>
            <span className="text-sm text-blue-400 font-mono">{dofSettings.focusSpeed.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.01"
            max="0.5"
            step="0.01"
            value={dofSettings.focusSpeed}
            onChange={(e) => handleDofChange('focusSpeed', parseFloat(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
          <div className="flex justify-between text-xs text-white/40 mt-1">
            <span>Smooth</span>
            <span>Instant</span>
          </div>
        </div>
      </div>

      {/* Wallpaper Mode */}
      <WallpaperSettings />

      {/* Display Settings */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/5">
        <h3 className="text-white/80 font-medium mb-4">Display Settings</h3>
        <div className="space-y-4">
          <SettingRow
            label="Node fade distance"
            description="Distance at which nodes begin to fade out"
            value="8 units"
          />
          <SettingRow
            label="Connection visibility"
            description="Show connections between thoughts"
            value="Enabled"
          />
          <SettingRow
            label="Star field density"
            description="Number of background stars"
            value="5000"
          />
        </div>
      </div>

      {/* Data */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/5">
        <h3 className="text-white/80 font-medium mb-4">Data</h3>
        <div className="space-y-4">
          <SettingRow
            label="Database location"
            description="Where thoughts are stored"
            value="~/.the-mind/thoughts.db"
          />
          <SettingRow
            label="Auto-sync"
            description="Sync with Claude Desktop in real-time"
            value="Every 2s"
          />
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-white/5 rounded-xl p-5 border border-white/5">
        <h3 className="text-white/80 font-medium mb-4">Keyboard Shortcuts</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <ShortcutRow keys={['Click']} action="Enter fly mode" />
          <ShortcutRow keys={['ESC']} action="Exit fly mode / Close panel" />
          <ShortcutRow keys={['W','A','S','D']} action="Move around" />
          <ShortcutRow keys={['Space']} action="Move up" />
          <ShortcutRow keys={['Shift']} action="Move down" />
          <ShortcutRow keys={['Tab']} action="Toggle Command Center" />
          <ShortcutRow keys={['/']} action="Quick search" />
          <ShortcutRow keys={['↑','↓']} action="Navigate results" />
          <ShortcutRow keys={['Enter']} action="Select result" />
        </div>
      </div>
    </div>
  )
}
