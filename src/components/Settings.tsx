import { useState, useEffect } from 'react'
import { dofSettings } from './DebugBridge'

interface SettingsProps {
  onClose: () => void
  onOpenMcpSetup: () => void
}

export default function Settings({ onClose, onOpenMcpSetup }: SettingsProps) {
  const [, forceUpdate] = useState(0)

  // Force re-render when settings change
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 100)
    return () => clearInterval(interval)
  }, [])

  const handleChange = (key: keyof typeof dofSettings, value: number | boolean) => {
    (dofSettings as any)[key] = value
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-[#0d0d1a]/95 border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Visual Effects Section */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="text-lg">🎥</span> Visual Effects
          </h3>

          {/* DoF Enable Toggle */}
          <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg mb-3 cursor-pointer hover:bg-white/10 transition-colors">
            <span className="text-white">Depth of Field</span>
            <div className="relative">
              <input
                type="checkbox"
                checked={dofSettings.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${dofSettings.enabled ? 'bg-blue-500' : 'bg-white/20'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${dofSettings.enabled ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`} />
              </div>
            </div>
          </label>

          {/* Bokeh Scale */}
          <div className="p-3 bg-white/5 rounded-lg mb-3">
            <div className="flex justify-between mb-2">
              <span className="text-white/80 text-sm">Blur Amount</span>
              <span className="text-blue-400 text-sm font-mono">{dofSettings.bokehScale.toFixed(1)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="15"
              step="0.5"
              value={dofSettings.bokehScale}
              onChange={(e) => handleChange('bokehScale', parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-white/40 mt-1">
              <span>Sharp</span>
              <span>Dreamy</span>
            </div>
          </div>

          {/* Focal Length */}
          <div className="p-3 bg-white/5 rounded-lg mb-3">
            <div className="flex justify-between mb-2">
              <span className="text-white/80 text-sm">Focus Depth</span>
              <span className="text-blue-400 text-sm font-mono">{dofSettings.focalLength.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="0.001"
              max="0.1"
              step="0.001"
              value={dofSettings.focalLength}
              onChange={(e) => handleChange('focalLength', parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-white/40 mt-1">
              <span>Wide</span>
              <span>Shallow</span>
            </div>
          </div>

          {/* Focus Speed */}
          <div className="p-3 bg-white/5 rounded-lg">
            <div className="flex justify-between mb-2">
              <span className="text-white/80 text-sm">Focus Transition</span>
              <span className="text-blue-400 text-sm font-mono">{dofSettings.focusSpeed.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.5"
              step="0.01"
              value={dofSettings.focusSpeed}
              onChange={(e) => handleChange('focusSpeed', parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-xs text-white/40 mt-1">
              <span>Smooth</span>
              <span>Instant</span>
            </div>
          </div>
        </div>

        {/* MCP Setup Section */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="text-lg">🔌</span> Connections
          </h3>

          <button
            onClick={() => {
              onClose()
              onOpenMcpSetup()
            }}
            className="w-full p-4 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-left group"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white font-medium">MCP Server Setup</div>
                <div className="text-white/50 text-sm mt-1">Connect Claude to The Mind</div>
              </div>
              <svg className="w-5 h-5 text-white/40 group-hover:text-white/60 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </div>

        {/* Controls Info */}
        <div className="p-4 bg-white/5 rounded-lg">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="text-lg">🎮</span> Controls
          </h3>
          <div className="space-y-2 text-sm text-white/70">
            <div className="flex justify-between">
              <span>Move</span>
              <span className="text-white/50 font-mono">W A S D</span>
            </div>
            <div className="flex justify-between">
              <span>Up / Down</span>
              <span className="text-white/50 font-mono">Space / Shift</span>
            </div>
            <div className="flex justify-between">
              <span>Look Around</span>
              <span className="text-white/50 font-mono">Mouse (click to lock)</span>
            </div>
            <div className="flex justify-between">
              <span>Command Center</span>
              <span className="text-white/50 font-mono">Tab</span>
            </div>
            <div className="flex justify-between">
              <span>Exit Lock</span>
              <span className="text-white/50 font-mono">Escape</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
