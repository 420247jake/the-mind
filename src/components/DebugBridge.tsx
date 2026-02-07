import { useState, useEffect } from 'react'

// Global state for DoF settings (so we can access from outside React)
export const dofSettings = {
  bokehScale: 1.5,      // Blur intensity (0-15) - maps to maxblur 0-0.04
  focalLength: 0.005,   // DOF shallowness (0.001-0.1) - maps to aperture
  focusSpeed: 0.08,     // How fast focus transitions (lower = smoother)
  enabled: true,
  // Live debug info
  currentDistance: 0,
  targetDistance: 0,
  hitObject: 'none'
}

// Camera control state (for remote control via Claude)
export const cameraControl = {
  // Position
  x: 0,
  y: 0, 
  z: 50,
  // Rotation (euler angles in degrees for easier reading)
  rotX: 0,
  rotY: 0,
  // Movement commands (set these to move)
  moveForward: false,
  moveBackward: false,
  moveLeft: false,
  moveRight: false,
  moveUp: false,
  moveDown: false,
  // Rotation commands
  lookUp: false,
  lookDown: false,
  lookLeft: false,
  lookRight: false,
  // Speed multiplier
  speed: 1,
  // Teleport (set position directly)
  teleportTo: null as { x: number, y: number, z: number } | null,
  // Look at specific point
  lookAt: null as { x: number, y: number, z: number } | null
}

// Subscribers for settings changes
type Listener = () => void
const listeners: Set<Listener> = new Set()

export function subscribeToDofSettings(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners() {
  listeners.forEach(l => l())
}

// Debug panel component (rendered in HTML overlay)
function DebugPanel() {
  const [, forceUpdate] = useState(0)
  
  // Subscribe to settings changes
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 100)
    return () => clearInterval(interval)
  }, [])
  
  const handleChange = (key: keyof typeof dofSettings, value: number | boolean) => {
    (dofSettings as any)[key] = value
    notifyListeners()
  }
  
  return (
    <div style={{
      position: 'fixed',
      top: '80px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.85)',
      border: '1px solid rgba(100, 100, 255, 0.3)',
      borderRadius: '12px',
      padding: '16px',
      color: 'white',
      fontFamily: 'monospace',
      fontSize: '12px',
      minWidth: '280px',
      zIndex: 9999,
      backdropFilter: 'blur(10px)',
      pointerEvents: 'auto'
    }}>
      <div style={{ 
        fontSize: '14px', 
        fontWeight: 'bold', 
        marginBottom: '12px',
        color: '#88aaff',
        borderBottom: '1px solid rgba(100, 100, 255, 0.3)',
        paddingBottom: '8px'
      }}>
        🎥 DoF Debug Bridge
      </div>
      
      {/* Enable/Disable */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={dofSettings.enabled}
            onChange={(e) => handleChange('enabled', e.target.checked)}
          />
          DoF Enabled
        </label>
      </div>
      
      {/* Bokeh Scale */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Bokeh Scale (blur amount)</span>
          <span style={{ color: '#88ff88' }}>{dofSettings.bokehScale.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="15"
          step="0.5"
          value={dofSettings.bokehScale}
          onChange={(e) => handleChange('bokehScale', parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
      
      {/* Focal Length */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Focal Length (focus tightness)</span>
          <span style={{ color: '#88ff88' }}>{dofSettings.focalLength.toFixed(3)}</span>
        </div>
        <input
          type="range"
          min="0.001"
          max="0.1"
          step="0.001"
          value={dofSettings.focalLength}
          onChange={(e) => handleChange('focalLength', parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
      
      {/* Focus Speed */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span>Focus Speed (transition)</span>
          <span style={{ color: '#88ff88' }}>{dofSettings.focusSpeed.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="0.01"
          max="0.5"
          step="0.01"
          value={dofSettings.focusSpeed}
          onChange={(e) => handleChange('focusSpeed', parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>
      
      {/* Live Info */}
      <div style={{ 
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(100, 100, 255, 0.3)'
      }}>
        <div style={{ color: '#aaa', marginBottom: '8px' }}>Live Focus Info:</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Target Distance:</span>
          <span style={{ color: '#ffaa88' }}>{dofSettings.targetDistance.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Current Distance:</span>
          <span style={{ color: '#ffaa88' }}>{dofSettings.currentDistance.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Looking At:</span>
          <span style={{ color: '#88ffaa', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {dofSettings.hitObject}
          </span>
        </div>
      </div>
      
      {/* Camera Position */}
      <div style={{ 
        marginTop: '16px',
        paddingTop: '12px',
        borderTop: '1px solid rgba(100, 100, 255, 0.3)'
      }}>
        <div style={{ color: '#aaa', marginBottom: '8px' }}>📷 Camera Position:</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>X:</span>
          <span style={{ color: '#ff8888' }}>{cameraControl.x.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Y:</span>
          <span style={{ color: '#88ff88' }}>{cameraControl.y.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Z:</span>
          <span style={{ color: '#8888ff' }}>{cameraControl.z.toFixed(1)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
          <span>Rot X:</span>
          <span style={{ color: '#ffaa88' }}>{cameraControl.rotX.toFixed(1)}°</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Rot Y:</span>
          <span style={{ color: '#ffaa88' }}>{cameraControl.rotY.toFixed(1)}°</span>
        </div>
      </div>
      
      {/* Crosshair */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none'
      }}>
        <div style={{
          width: '20px',
          height: '20px',
          border: '2px solid rgba(255, 255, 255, 0.5)',
          borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '4px',
          height: '4px',
          background: 'rgba(255, 100, 100, 0.8)',
          borderRadius: '50%',
          transform: 'translate(-50%, -50%)'
        }} />
      </div>
      
      {/* Instructions */}
      <div style={{ 
        marginTop: '12px',
        padding: '8px',
        background: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '6px',
        fontSize: '10px',
        color: '#888'
      }}>
        <div>Press <kbd style={{ background: '#333', padding: '2px 4px', borderRadius: '3px' }}>~</kbd> to toggle this panel</div>
        <div style={{ marginTop: '4px' }}>Fly around and adjust until it looks right</div>
        <div style={{ marginTop: '4px', color: '#88aaff' }}>💤 Idle drift activates after 5 min</div>
      </div>
    </div>
  )
}

// Export the panel as default
export default function DebugBridge({ visible = true }: { visible?: boolean }) {
  if (!visible) return null
  return <DebugPanel />
}
