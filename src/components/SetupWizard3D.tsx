import { useState, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, Stars, Line } from '@react-three/drei'
import * as THREE from 'three'

interface SetupWizard3DProps {
  onClose: () => void
  onComplete: () => void
}

// Check if running in Tauri
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window
}

// Step positions in 3D space - arranged in a gentle arc
const STEP_POSITIONS = [
  new THREE.Vector3(-15, 5, 0),   // Step 1: Welcome
  new THREE.Vector3(0, 8, -10),   // Step 2: Copy Config
  new THREE.Vector3(15, 5, -5),   // Step 3: Edit File
  new THREE.Vector3(25, 0, 5),    // Step 4: Restart
]

// Camera positions for each step (looking at the step)
const CAMERA_POSITIONS = [
  new THREE.Vector3(-15, 5, 20),
  new THREE.Vector3(0, 8, 10),
  new THREE.Vector3(15, 5, 15),
  new THREE.Vector3(25, 0, 25),
]

// Animated camera that smoothly moves between steps
function AnimatedCamera({ targetStep }: { targetStep: number }) {
  const { camera } = useThree()
  const targetPos = useRef(CAMERA_POSITIONS[0].clone())
  const targetLook = useRef(STEP_POSITIONS[0].clone())
  
  useEffect(() => {
    targetPos.current = CAMERA_POSITIONS[targetStep].clone()
    targetLook.current = STEP_POSITIONS[targetStep].clone()
  }, [targetStep])
  
  useFrame(() => {
    // Smooth camera movement
    camera.position.lerp(targetPos.current, 0.03)
    
    // Smooth look-at
    const currentLook = new THREE.Vector3()
    camera.getWorldDirection(currentLook)
    currentLook.multiplyScalar(10).add(camera.position)
    currentLook.lerp(targetLook.current, 0.03)
    camera.lookAt(targetLook.current)
  })
  
  return null
}

// Floating panel component for setup steps
interface SetupPanelProps {
  position: THREE.Vector3
  isActive: boolean
  isCompleted: boolean
  stepNumber: number
  title: string
  children: React.ReactNode
  color: string
}

function SetupPanel({ position, isActive, isCompleted, stepNumber, title, children, color }: SetupPanelProps) {
  const groupRef = useRef<THREE.Group>(null)
  const [, setHovered] = useState(false)
  
  // Gentle floating animation
  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.elapsedTime
    groupRef.current.position.y = position.y + Math.sin(t * 0.5 + stepNumber) * 0.3
    groupRef.current.rotation.y = Math.sin(t * 0.3 + stepNumber * 0.5) * 0.05
  })
  
  const opacity = isActive ? 1 : isCompleted ? 0.6 : 0.3
  const scale = isActive ? 1 : 0.85
  
  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      {/* Glowing orb behind panel */}
      <mesh>
        <sphereGeometry args={[3, 32, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isActive ? 0.15 : 0.05}
        />
      </mesh>
      
      {/* Core glow */}
      <mesh>
        <sphereGeometry args={[1.5, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isActive ? 0.3 : 0.1}
        />
      </mesh>
      
      {/* Panel content */}
      <Html
        center
        distanceFactor={12}
        style={{
          opacity,
          transform: `scale(${scale})`,
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: isActive ? 'auto' : 'none',
        }}
      >
        <div
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: '380px',
            background: `linear-gradient(145deg, ${color}15 0%, rgba(10, 10, 18, 0.95) 50%, rgba(15, 15, 25, 0.98) 100%)`,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: '20px',
            border: `2px solid ${isActive ? color + '80' : color + '30'}`,
            boxShadow: isActive
              ? `0 0 60px ${color}40, 0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 ${color}30`
              : `0 0 20px ${color}20, 0 10px 30px rgba(0,0,0,0.4)`,
            padding: '24px',
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            transition: 'all 0.4s ease',
          }}
        >
          {/* Step indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: isCompleted 
                ? `linear-gradient(135deg, #10B981, #059669)` 
                : `linear-gradient(135deg, ${color}, ${color}80)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 700,
              color: 'white',
              boxShadow: `0 0 20px ${isCompleted ? '#10B981' : color}60`,
            }}>
              {isCompleted ? '✓' : stepNumber}
            </div>
            <h3 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 600,
              color: 'white',
            }}>
              {title}
            </h3>
          </div>
          
          {/* Content */}
          <div style={{ color: 'rgba(255,255,255,0.8)' }}>
            {children}
          </div>
        </div>
      </Html>
    </group>
  )
}

// Connection line between steps
function StepConnection({ from, to, isActive, isCompleted }: { 
  from: THREE.Vector3
  to: THREE.Vector3
  isActive: boolean
  isCompleted: boolean 
}) {
  const points = [from, to]
  const color = isCompleted ? '#10B981' : isActive ? '#3B82F6' : '#ffffff'
  const opacity = isCompleted ? 0.8 : isActive ? 0.5 : 0.15
  
  return (
    <Line
      points={points}
      color={color}
      lineWidth={isActive || isCompleted ? 2 : 1}
      transparent
      opacity={opacity}
    />
  )
}

// Progress particles along connections
function ConnectionParticles({ from, to, isActive }: { 
  from: THREE.Vector3
  to: THREE.Vector3
  isActive: boolean 
}) {
  const particleRef = useRef<THREE.Mesh>(null)
  
  useFrame((state) => {
    if (!particleRef.current || !isActive) return
    const t = (state.clock.elapsedTime * 0.3) % 1
    particleRef.current.position.lerpVectors(from, to, t)
  })
  
  if (!isActive) return null
  
  return (
    <mesh ref={particleRef}>
      <sphereGeometry args={[0.15, 8, 8]} />
      <meshBasicMaterial color="#3B82F6" transparent opacity={0.8} />
    </mesh>
  )
}

// Main 3D scene content
function SetupScene({ 
  currentStep, 
  setStep, 
  exePath, 
  configPath,
  onComplete 
}: { 
  currentStep: number
  setStep: (step: number) => void
  exePath: string
  configPath: string
  onComplete: () => void
}) {
  const [copied, setCopied] = useState(false)
  
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
  
  return (
    <>
      {/* Background */}
      <Stars radius={300} depth={100} count={2000} factor={6} saturation={0.2} fade speed={0.3} />
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 20, 10]} intensity={0.4} />
      
      {/* Camera control */}
      <AnimatedCamera targetStep={currentStep} />
      
      {/* Connection lines between steps */}
      {STEP_POSITIONS.slice(0, -1).map((pos, i) => (
        <group key={`connection-${i}`}>
          <StepConnection
            from={pos}
            to={STEP_POSITIONS[i + 1]}
            isActive={i === currentStep - 1}
            isCompleted={i < currentStep}
          />
          <ConnectionParticles
            from={pos}
            to={STEP_POSITIONS[i + 1]}
            isActive={i === currentStep - 1}
          />
        </group>
      ))}
      
      {/* Step 1: Welcome */}
      <SetupPanel
        position={STEP_POSITIONS[0]}
        isActive={currentStep === 0}
        isCompleted={currentStep > 0}
        stepNumber={1}
        title="Welcome to The Mind"
        color="#8B5CF6"
      >
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: 1.6 }}>
          Let's connect The Mind to Claude Desktop so your thoughts can flow 
          into this beautiful 3D space.
        </p>
        <div style={{
          background: 'rgba(139, 92, 246, 0.1)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5 }}>
            ✨ <strong>What you'll get:</strong><br/>
            • Thoughts appear as glowing nodes<br/>
            • Connections form as ideas link together<br/>
            • Fly through your mind-map in 3D
          </p>
        </div>
        <button
          onClick={() => setStep(1)}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '15px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)',
            transition: 'all 0.3s ease',
          }}
        >
          Begin Setup →
        </button>
      </SetupPanel>

      {/* Step 2: Copy Config */}
      <SetupPanel
        position={STEP_POSITIONS[1]}
        isActive={currentStep === 1}
        isCompleted={currentStep > 1}
        stepNumber={2}
        title="Copy Configuration"
        color="#3B82F6"
      >
        <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: 1.5, color: 'rgba(255,255,255,0.7)' }}>
          Add this to your Claude Desktop config:
        </p>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <pre style={{
            background: 'rgba(0,0,0,0.5)',
            padding: '14px',
            borderRadius: '10px',
            fontSize: '11px',
            color: '#10B981',
            overflow: 'auto',
            maxHeight: '140px',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {configSnippet}
          </pre>
          <button
            onClick={copyConfig}
            style={{
              position: 'absolute',
              top: '8px',
              right: '8px',
              padding: '6px 12px',
              background: copied ? '#10B981' : 'rgba(59, 130, 246, 0.3)',
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setStep(0)}
            style={{
              padding: '12px 20px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          <button
            onClick={() => setStep(2)}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
            }}
          >
            Next →
          </button>
        </div>
      </SetupPanel>

      {/* Step 3: Edit File */}
      <SetupPanel
        position={STEP_POSITIONS[2]}
        isActive={currentStep === 2}
        isCompleted={currentStep > 2}
        stepNumber={3}
        title="Edit Config File"
        color="#F59E0B"
      >
        <p style={{ margin: '0 0 12px 0', fontSize: '14px', lineHeight: 1.5, color: 'rgba(255,255,255,0.7)' }}>
          Open the config file at:
        </p>
        <div style={{
          background: 'rgba(0,0,0,0.4)',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
        }}>
          <code style={{ color: '#F59E0B', fontSize: '12px', wordBreak: 'break-all' }}>
            {configPath}
          </code>
        </div>
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '10px',
          padding: '14px',
          marginBottom: '16px',
        }}>
          <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.5 }}>
            <strong>Quick open (Windows):</strong><br/>
            1. Press <kbd style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px' }}>Win + R</kbd><br/>
            2. Type: <code style={{ color: '#10B981' }}>%APPDATA%\Claude</code><br/>
            3. Open <code style={{ color: '#10B981' }}>claude_desktop_config.json</code>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setStep(1)}
            style={{
              padding: '12px 20px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          <button
            onClick={() => setStep(3)}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(245, 158, 11, 0.4)',
            }}
          >
            Next →
          </button>
        </div>
      </SetupPanel>

      {/* Step 4: Complete */}
      <SetupPanel
        position={STEP_POSITIONS[3]}
        isActive={currentStep === 3}
        isCompleted={false}
        stepNumber={4}
        title="Ready to Explore!"
        color="#10B981"
      >
        <p style={{ margin: '0 0 16px 0', fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.8)' }}>
          Restart Claude Desktop to activate the connection. Keep The Mind running 
          to see thoughts appear in real-time!
        </p>
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '20px',
        }}>
          <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6 }}>
            <strong>🎉 Once connected, Claude gains:</strong><br/>
            • <code style={{ color: '#10B981' }}>mind_log</code> - Record thoughts<br/>
            • <code style={{ color: '#10B981' }}>mind_connect</code> - Link ideas<br/>
            • <code style={{ color: '#10B981' }}>mind_recall</code> - Search memories<br/>
            • <code style={{ color: '#10B981' }}>mind_summarize_session</code> - Save sessions
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setStep(2)}
            style={{
              padding: '12px 20px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '10px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          <button
            onClick={onComplete}
            style={{
              flex: 1,
              padding: '14px 24px',
              background: 'linear-gradient(135deg, #10B981, #059669)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '15px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
            }}
          >
            Enter The Mind ✨
          </button>
        </div>
      </SetupPanel>
    </>
  )
}

// Main exported component
export default function SetupWizard3D({ onClose, onComplete }: SetupWizard3DProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [exePath, setExePath] = useState('C:\\\\Program Files\\\\The Mind\\\\the-mind.exe')
  
  const configPath = navigator.platform.includes('Win')
    ? '%APPDATA%\\Claude\\claude_desktop_config.json'
    : '~/Library/Application Support/Claude/claude_desktop_config.json'
  
  // Try to get the actual exe path if running in Tauri
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
  
  const handleComplete = () => {
    onComplete()
    onClose()
  }
  
  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a12]">
      {/* Close button */}
      <button
        onClick={onClose}
        className="fixed top-6 right-6 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-all duration-200"
      >
        ✕
      </button>
      
      {/* Progress indicator */}
      <div className="fixed top-6 left-6 z-50 flex items-center gap-3">
        <span className="text-white/40 text-sm">Setup Progress</span>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-8 h-1 rounded-full transition-all duration-500 ${
                i < currentStep 
                  ? 'bg-emerald-500' 
                  : i === currentStep 
                    ? 'bg-blue-500' 
                    : 'bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>
      
      {/* Skip button */}
      <button
        onClick={onClose}
        className="fixed bottom-6 left-6 z-50 text-white/40 hover:text-white/60 text-sm transition-colors"
      >
        Skip setup →
      </button>
      
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [-15, 5, 20], fov: 60 }}
        gl={{ antialias: true, alpha: false }}
        dpr={[1, 2]}
      >
        <SetupScene
          currentStep={currentStep}
          setStep={setCurrentStep}
          exePath={exePath}
          configPath={configPath}
          onComplete={handleComplete}
        />
      </Canvas>
    </div>
  )
}
