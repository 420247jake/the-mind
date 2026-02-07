import { Canvas, useThree, useFrame } from '@react-three/fiber'
// Removed @react-three/postprocessing - using unified Three.js composer instead
import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import { EffectComposer as ThreeEffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import MindSpace from './components/MindSpace'
import MindChamber from './components/MindChamber'
import CommandCenter from './components/CommandCenter'
import ThoughtDetail from './components/ThoughtDetail'
import { useMindStore } from './stores/mindStore'
import { useDatabaseSync } from './hooks/useDatabaseSync'
import { useForgeStore } from './stores/forgeStore'
import SetupWizard3D from './components/SetupWizard3D'
import { dofSettings, cameraControl } from './components/DebugBridge'
import MindCrosshair, { CrosshairRaycaster, crosshairTarget } from './components/MindCrosshair'
import Settings from './components/Settings'
import WallpaperCamera from './components/WallpaperCamera'
import IdleDriftCamera from './components/IdleDriftCamera'
import { useWallpaperStore } from './stores/wallpaperStore'
import { useIdleStore } from './stores/idleStore'
import type { Thought } from './types'

// Global shortcut for wallpaper mode (works even when window is behind desktop)
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'

// Remote camera controller - lets Claude control the camera via cameraControl object
function RemoteCameraControl() {
  const { camera } = useThree()
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  
  useFrame((_, delta) => {
    // Check for teleport command
    if (cameraControl.teleportTo) {
      camera.position.set(
        cameraControl.teleportTo.x,
        cameraControl.teleportTo.y,
        cameraControl.teleportTo.z
      )
      cameraControl.teleportTo = null
    }
    
    // Check for lookAt command
    if (cameraControl.lookAt) {
      camera.lookAt(
        cameraControl.lookAt.x,
        cameraControl.lookAt.y,
        cameraControl.lookAt.z
      )
      // Update euler from new quaternion
      euler.current.setFromQuaternion(camera.quaternion)
      cameraControl.lookAt = null
    }
    
    // Update position readout
    cameraControl.x = camera.position.x
    cameraControl.y = camera.position.y
    cameraControl.z = camera.position.z
    
    // Update rotation readout (convert to degrees)
    euler.current.setFromQuaternion(camera.quaternion)
    cameraControl.rotX = THREE.MathUtils.radToDeg(euler.current.x)
    cameraControl.rotY = THREE.MathUtils.radToDeg(euler.current.y)
    
    // Handle movement commands
    const speed = 20 * delta * cameraControl.speed
    const rotSpeed = 1 * delta * cameraControl.speed
    
    if (cameraControl.moveForward) {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
      camera.position.add(dir.multiplyScalar(speed))
    }
    if (cameraControl.moveBackward) {
      const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion)
      camera.position.add(dir.multiplyScalar(speed))
    }
    if (cameraControl.moveLeft) {
      const dir = new THREE.Vector3(-1, 0, 0).applyQuaternion(camera.quaternion)
      camera.position.add(dir.multiplyScalar(speed))
    }
    if (cameraControl.moveRight) {
      const dir = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion)
      camera.position.add(dir.multiplyScalar(speed))
    }
    if (cameraControl.moveUp) {
      camera.position.y += speed
    }
    if (cameraControl.moveDown) {
      camera.position.y -= speed
    }
    
    // Handle rotation commands
    if (cameraControl.lookUp) {
      euler.current.x += rotSpeed
      euler.current.x = Math.min(euler.current.x, Math.PI / 2 - 0.01)
      camera.quaternion.setFromEuler(euler.current)
    }
    if (cameraControl.lookDown) {
      euler.current.x -= rotSpeed
      euler.current.x = Math.max(euler.current.x, -Math.PI / 2 + 0.01)
      camera.quaternion.setFromEuler(euler.current)
    }
    if (cameraControl.lookLeft) {
      euler.current.y += rotSpeed
      camera.quaternion.setFromEuler(euler.current)
    }
    if (cameraControl.lookRight) {
      euler.current.y -= rotSpeed
      camera.quaternion.setFromEuler(euler.current)
    }
  })
  
  return null
}

// Real DOF using Three.js BokehPass - actually works!
function BokehDOF({ debug = false }: { debug?: boolean }) {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef<ThreeEffectComposer | null>(null)
  const bokehPassRef = useRef<BokehPass | null>(null)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const targetDistance = useRef(50)
  const currentDistance = useRef(50)
  const debugRef = useRef<THREE.Mesh>(null)

  // Setup composer and bokeh pass
  useEffect(() => {
    // Create render target with depth texture
    const renderTarget = new THREE.WebGLRenderTarget(size.width, size.height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    })

    const composer = new ThreeEffectComposer(gl, renderTarget)
    composer.setSize(size.width, size.height)
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const renderPass = new RenderPass(scene, camera)
    composer.addPass(renderPass)

    // Initial bokeh settings - these will be updated each frame
    const bokehPass = new BokehPass(scene, camera, {
      focus: 50,
      aperture: 0.00015,  // Lower = wider focus area, higher = shallower DOF
      maxblur: 0.012      // Maximum blur strength
    })
    composer.addPass(bokehPass)

    // Add bloom for that organic glow on neurons
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.5,   // strength - subtle glow
      0.4,   // radius - how far bloom spreads
      0.85   // threshold - only bright areas bloom
    )
    composer.addPass(bloomPass)

    composerRef.current = composer
    bokehPassRef.current = bokehPass

    console.log('🔭 BokehDOF: Initialized with auto-focus + bloom')

    return () => {
      composer.dispose()
      renderTarget.dispose()
    }
  }, [gl, scene, camera, size.width, size.height])

  // Take over rendering
  useFrame((_, delta) => {
    if (!composerRef.current || !bokehPassRef.current) return

    if (dofSettings.enabled) {
      // Raycast from center of screen
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
      const intersects = raycaster.intersectObjects(scene.children, true)

      // Find first valid hit (skip very close objects and non-mesh objects)
      const validHit = intersects.find(hit =>
        hit.distance > 2 &&
        hit.object.type !== 'Line' &&
        hit.object.type !== 'Points'
      )

      if (validHit) {
        targetDistance.current = validHit.distance
        dofSettings.hitObject = validHit.object.name || validHit.object.type || 'object'

        if (debug && debugRef.current) {
          debugRef.current.position.copy(validHit.point)
        }
      } else {
        targetDistance.current = 100
        dofSettings.hitObject = 'none (sky)'
      }

      // Smooth lerp for focus transition
      currentDistance.current = THREE.MathUtils.lerp(
        currentDistance.current,
        targetDistance.current,
        dofSettings.focusSpeed
      )

      // Update debug info
      dofSettings.targetDistance = targetDistance.current
      dofSettings.currentDistance = currentDistance.current

      // Update BokehPass uniforms
      // focus: distance in world units where image is sharp
      // aperture: controls DOF depth - 0.00001 (wide focus) to 0.001 (shallow)
      // maxblur: maximum blur radius 0 to 0.05 (higher = more blur)
      const uniforms = bokehPassRef.current.uniforms as Record<string, { value: number }>
      uniforms['focus'].value = currentDistance.current

      // Map dofSettings to reasonable bokeh values
      // focalLength 0.001-0.1 maps to aperture 0.00001-0.0005
      // bokehScale 0-15 maps to maxblur 0-0.04
      uniforms['aperture'].value = dofSettings.focalLength * 0.005
      uniforms['maxblur'].value = dofSettings.bokehScale * 0.0027

      // Render with DOF
      composerRef.current.render(delta)
    } else {
      // Normal rendering without DOF
      gl.render(scene, camera)
    }
  }, 1) // Priority 1 to run after other useFrame hooks

  if (!debug) return null

  return (
    <mesh ref={debugRef}>
      <sphereGeometry args={[0.3, 8, 8]} />
      <meshBasicMaterial color="#ff0000" wireframe />
    </mesh>
  )
}

// Post-processing effects are now handled by BokehDOF's unified composer
// (Bokeh DOF + Bloom in same render pipeline)

// WASD + Space/Shift Movement component
function Movement() {
  const { camera } = useThree()
  const moveState = useRef({ 
    forward: false, 
    backward: false, 
    left: false, 
    right: false, 
    up: false, 
    down: false 
  })
  const velocity = useRef(new THREE.Vector3())
  const direction = useRef(new THREE.Vector3())
  
  const SPEED = 8  // Slower, more controlled movement
  const DAMPING = 0.85  // Smoother deceleration
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture keys if typing in an input
      if (document.activeElement?.tagName === 'INPUT') return
      
      switch (e.code) {
        case 'KeyW': moveState.current.forward = true; break
        case 'KeyS': moveState.current.backward = true; break
        case 'KeyA': moveState.current.left = true; break
        case 'KeyD': moveState.current.right = true; break
        case 'Space': moveState.current.up = true; e.preventDefault(); break
        case 'ShiftLeft': case 'ShiftRight': moveState.current.down = true; break
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = false; break
        case 'KeyS': moveState.current.backward = false; break
        case 'KeyA': moveState.current.left = false; break
        case 'KeyD': moveState.current.right = false; break
        case 'Space': moveState.current.up = false; break
        case 'ShiftLeft': case 'ShiftRight': moveState.current.down = false; break
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])
  
  useFrame((_, delta) => {
    // Build direction from camera orientation
    const { forward, backward, left, right, up, down } = moveState.current
    
    // Get forward direction from camera
    const cameraDirection = new THREE.Vector3()
    camera.getWorldDirection(cameraDirection)
    cameraDirection.normalize()
    
    // Get right direction
    const rightDirection = new THREE.Vector3()
    rightDirection.crossVectors(camera.up, cameraDirection).negate().normalize()
    
    // Calculate movement direction
    direction.current.set(0, 0, 0)
    
    if (forward) direction.current.add(cameraDirection)
    if (backward) direction.current.sub(cameraDirection)
    if (right) direction.current.add(rightDirection)
    if (left) direction.current.sub(rightDirection)
    if (up) direction.current.y += 1
    if (down) direction.current.y -= 1
    
    direction.current.normalize()
    
    // Apply acceleration
    const acceleration = direction.current.multiplyScalar(SPEED * delta)
    velocity.current.add(acceleration)
    
    // Apply damping
    velocity.current.multiplyScalar(DAMPING)
    
    // Update camera position
    camera.position.add(velocity.current)
  })
  
  return null
}

// Minimal control hint at bottom (non-blocking)
function ControlHint({ isLocked }: { isLocked: boolean }) {
  if (isLocked) return null
  
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none opacity-60">
      <p className="text-white/40 text-xs tracking-wide">
        Click anywhere to fly • WASD move • Space/Shift up/down
      </p>
    </div>
  )
}

// Custom FPS-style mouse look (no jumping on lock/unlock)
// Also handles crosshair-targeted clicks: when pointer is locked and
// crosshair is aimed at a thought, clicking opens its detail view.
function MouseLook({ enabled, onCrosshairClick }: { enabled: boolean; onCrosshairClick?: (thoughtId: string) => void }) {
  const { camera, gl } = useThree()
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const isLocked = useRef(false)
  const lockChangeTime = useRef(0) // Track BOTH lock and unlock time

  useEffect(() => {
    // Initialize euler from current camera rotation
    euler.current.setFromQuaternion(camera.quaternion)
  }, [camera])

  useEffect(() => {
    if (!enabled) return

    const canvas = gl.domElement

    const onMouseMove = (e: MouseEvent) => {
      if (!isLocked.current) return

      // Ignore mouse moves for 150ms after ANY lock state change to prevent jump
      if (Date.now() - lockChangeTime.current < 150) {
        return
      }

      const movementX = e.movementX || 0
      const movementY = e.movementY || 0

      // Ignore suspiciously large movements (likely from pointer lock transition)
      if (Math.abs(movementX) > 100 || Math.abs(movementY) > 100) {
        return
      }

      // Sensitivity
      const sensitivity = 0.002

      euler.current.y -= movementX * sensitivity
      euler.current.x -= movementY * sensitivity

      // Clamp vertical look
      euler.current.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.current.x))

      camera.quaternion.setFromEuler(euler.current)
    }

    const onPointerLockChange = () => {
      const wasLocked = isLocked.current
      isLocked.current = document.pointerLockElement === canvas

      // Record time for ANY lock state change (lock OR unlock)
      lockChangeTime.current = Date.now()

      // Re-sync euler from camera when unlocking to prevent drift
      if (wasLocked && !isLocked.current) {
        euler.current.setFromQuaternion(camera.quaternion)
      }
    }

    const onClick = () => {
      if (isLocked.current) {
        // Pointer is locked (FPS mode) - check if crosshair is aimed at a thought
        if (crosshairTarget.thoughtId && crosshairTarget.distance < 40) {
          // Exit pointer lock and open the thought detail
          document.exitPointerLock()
          onCrosshairClick?.(crosshairTarget.thoughtId)
        }
        // Otherwise, click does nothing while locked (just looking around)
      } else if (enabled) {
        // Not locked - click to enter FPS mode
        canvas.requestPointerLock()
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    canvas.addEventListener('click', onClick)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      canvas.removeEventListener('click', onClick)
    }
  }, [enabled, camera, gl, onCrosshairClick])

  return null
}

// Scene content (inside Canvas)
function Scene({ onLockChange, canLock, isUIOpen, onThoughtClick, onCrosshairClick, isWallpaperMode, isIdle }: {
  onLockChange: (locked: boolean) => void;
  canLock: boolean;
  isUIOpen: boolean;
  onThoughtClick?: (thought: Thought) => void;
  onCrosshairClick?: (thoughtId: string) => void;
  isWallpaperMode: boolean;
  isIdle: boolean;
}) {
  const { gl } = useThree()

  // Track pointer lock state
  useEffect(() => {
    const canvas = gl.domElement

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === canvas
      onLockChange(locked)
    }

    document.addEventListener('pointerlockchange', onPointerLockChange)
    return () => document.removeEventListener('pointerlockchange', onPointerLockChange)
  }, [gl, onLockChange])

  // Exit pointer lock when overlays open, wallpaper mode, or idle
  useEffect(() => {
    if ((!canLock || isWallpaperMode || isIdle) && document.pointerLockElement) {
      document.exitPointerLock()
    }
  }, [canLock, isWallpaperMode, isIdle])

  return (
    <>
      {/* Lighting for dramatic neuron visuals */}
      <ambientLight intensity={0.1} />
      <pointLight position={[0, 20, 0]} intensity={0.5} color="#4488ff" />
      <pointLight position={[-30, -10, 20]} intensity={0.3} color="#44ff88" />
      <pointLight position={[30, -10, -20]} intensity={0.3} color="#ff8844" />

      {/* Mind Chamber Environment - walls, wires, circuits */}
      <MindChamber />

      {/* Wallpaper mode camera - takes over when active */}
      <WallpaperCamera />

      {/* Idle drift camera - screensaver when no input */}
      <IdleDriftCamera />

      {/* Custom mouse look - disabled in wallpaper/idle mode */}
      <MouseLook enabled={canLock && !isWallpaperMode && !isIdle} onCrosshairClick={onCrosshairClick} />
      {!isWallpaperMode && !isIdle && <Movement />}

      {/* Remote camera control - Claude can control this */}
      <RemoteCameraControl />

      {/* Main content - thoughts and connections */}
      <MindSpace isUIOpen={isUIOpen} onThoughtClick={onThoughtClick} />

      {/* Crosshair raycaster - determines what we're looking at */}
      {!isWallpaperMode && !isIdle && <CrosshairRaycaster />}

      {/* Bokeh DOF - uses its own composer */}
      <BokehDOF />
    </>
  )
}

// Main App component
export default function App() {
  const [isLocked, setIsLocked] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCommandCenter, setShowCommandCenter] = useState(false)
  const [selectedThought, setSelectedThought] = useState<Thought | null>(null) // For detail view
  const canvasRef = useRef<HTMLCanvasElement | null>(null) // Ref to canvas for re-locking
  const { thoughts } = useMindStore()

  // Wallpaper mode state
  const { isWallpaperMode, exitWallpaperMode } = useWallpaperStore()

  // Idle drift state
  const { isIdle, resetActivity, checkIdle } = useIdleStore()

  // Track toggle state with ref to prevent stale closures and add debounce
  const toggleDebounceRef = useRef<number>(0)
  const isTogglingRef = useRef(false)

  // Start database sync
  useDatabaseSync()

  // Check if session-forge data is available
  const checkForgeAvailability = useForgeStore(s => s.checkAvailability)
  useEffect(() => { checkForgeAvailability() }, [checkForgeAvailability])

  // Idle detection — reset on any input, check every 5 seconds
  useEffect(() => {
    const onInput = () => resetActivity()

    window.addEventListener('mousemove', onInput)
    window.addEventListener('mousedown', onInput)
    window.addEventListener('keydown', onInput)
    window.addEventListener('scroll', onInput)
    window.addEventListener('wheel', onInput)

    const idleCheckInterval = setInterval(checkIdle, 5000)

    return () => {
      window.removeEventListener('mousemove', onInput)
      window.removeEventListener('mousedown', onInput)
      window.removeEventListener('keydown', onInput)
      window.removeEventListener('scroll', onInput)
      window.removeEventListener('wheel', onInput)
      clearInterval(idleCheckInterval)
    }
  }, [resetActivity, checkIdle])

  // Register global F10 hotkey for wallpaper mode (works even when window is behind desktop)
  useEffect(() => {
    let isRegistered = false

    const registerGlobalShortcut = async () => {
      try {
        console.log('🖼️ Attempting to register F10 global shortcut...')
        await register('F10', async (event) => {
          console.log('🖼️ F10 event received:', event)

          // Only trigger on key press, not release
          if (event.state !== 'Pressed') {
            console.log('🖼️ F10 ignored - not a press event')
            return
          }

          const now = Date.now()

          // Debounce: ignore if less than 500ms since last toggle
          if (now - toggleDebounceRef.current < 500) {
            console.log('🖼️ F10 debounced - ignoring rapid press')
            return
          }

          // Prevent concurrent toggles
          if (isTogglingRef.current) {
            console.log('🖼️ F10 ignored - toggle already in progress')
            return
          }

          toggleDebounceRef.current = now
          isTogglingRef.current = true

          console.log('🖼️ Global F10 pressed - toggling wallpaper mode')

          // Get fresh state from store
          const { isWallpaperMode: currentMode, enterWallpaperMode, exitWallpaperMode: exitMode } = useWallpaperStore.getState()
          console.log('🖼️ Current wallpaper mode:', currentMode)

          try {
            if (currentMode) {
              console.log('🖼️ Exiting wallpaper mode...')
              await exitMode()
            } else {
              console.log('🖼️ Entering wallpaper mode...')
              await enterWallpaperMode(
                { x: cameraControl.x, y: cameraControl.y, z: cameraControl.z },
                { x: cameraControl.rotX, y: cameraControl.rotY }
              )
            }
            console.log('🖼️ Toggle complete')
          } catch (err) {
            console.error('🖼️ Error during toggle:', err)
          } finally {
            isTogglingRef.current = false
          }
        })
        isRegistered = true
        console.log('🖼️ Global F10 hotkey registered successfully!')
      } catch (error) {
        console.error('🖼️ Failed to register global shortcut:', error)
      }
    }

    registerGlobalShortcut()

    return () => {
      if (isRegistered) {
        console.log('🖼️ Unregistering F10...')
        unregister('F10').catch(err => console.error('🖼️ Failed to unregister:', err))
      }
    }
  }, []) // Empty deps - we use getState() for fresh values

  // Exit wallpaper mode when any overlay opens (user re-engages with app)
  useEffect(() => {
    if (isWallpaperMode && (showSetup || showSettings || showCommandCenter || selectedThought)) {
      exitWallpaperMode()
    }
  }, [isWallpaperMode, showSetup, showSettings, showCommandCenter, selectedThought, exitWallpaperMode])

  // Exit idle when any overlay opens
  useEffect(() => {
    if (isIdle && (showSetup || showSettings || showCommandCenter || selectedThought)) {
      resetActivity()
    }
  }, [isIdle, showSetup, showSettings, showCommandCenter, selectedThought, resetActivity])

  const handleLockChange = useCallback((locked: boolean) => {
    setIsLocked(locked)
  }, [])

  // Handle crosshair click — when pointer is locked and user clicks on a thought
  const handleCrosshairClick = useCallback((thoughtId: string) => {
    const thought = thoughts.find(t => t.id === thoughtId)
    if (thought) {
      console.log('🎯 Crosshair click on thought:', thought.content.substring(0, 50))
      setSelectedThought(thought)
    }
  }, [thoughts])

  // Determine if any overlay is showing
  const hasOverlay = showSetup || showSettings || showCommandCenter || selectedThought !== null

  // Handle global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return

      // F10 is handled by global shortcut (works even in wallpaper mode)

      // Tab key toggles Command Center (also exits wallpaper mode)
      if (e.code === 'Tab' && !showSetup && !showSettings) {
        e.preventDefault()
        e.stopPropagation()
        setShowCommandCenter(prev => !prev)
        // Exit pointer lock if opening command center
        if (!showCommandCenter && document.pointerLockElement) {
          document.exitPointerLock()
        }
        return
      }

      // Escape closes overlays (but not when pointer locked - that's handled by browser)
      // Note: Escape does NOT exit wallpaper mode - user must re-engage with app
      if (e.code === 'Escape') {
        if (selectedThought) {
          e.preventDefault()
          setSelectedThought(null)
        } else if (showCommandCenter) {
          e.preventDefault()
          setShowCommandCenter(false)
        } else if (showSettings) {
          e.preventDefault()
          setShowSettings(false)
        } else if (showSetup) {
          e.preventDefault()
          setShowSetup(false)
        }
      }
    }

    // Use capture phase to get events before PointerLockControls
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [showSetup, showSettings, showCommandCenter, isLocked, selectedThought])
  
  return (
    <div className="w-screen h-screen bg-[#0a0a12] overflow-hidden">
      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [0, 0, 50], fov: 75 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
        }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          canvasRef.current = gl.domElement
        }}
      >
        <Scene
          onLockChange={handleLockChange}
          canLock={!hasOverlay}
          isUIOpen={hasOverlay}
          onThoughtClick={(thought) => setSelectedThought(thought)}
          onCrosshairClick={handleCrosshairClick}
          isWallpaperMode={isWallpaperMode}
          isIdle={isIdle}
        />
      </Canvas>
      
      {/* Mind Crosshair - morphs based on what you're looking at (hidden in wallpaper/idle mode) */}
      {isLocked && !isWallpaperMode && !isIdle && <MindCrosshair />}

      {/* Control hint - subtle, non-blocking (hidden in wallpaper mode) */}
      {!isWallpaperMode && <ControlHint isLocked={isLocked} />}

      {/* Top left - Title and thought count (hidden in wallpaper mode) */}
      {!isWallpaperMode && (
        <div className="fixed top-4 left-4 z-30 pointer-events-none">
          <h1 className="text-2xl font-bold text-white tracking-tight">The Mind</h1>
          <p className="text-white/40 text-sm">{thoughts.length} thoughts • Click to fly</p>
        </div>
      )}

      {/* Bottom bar with buttons (hidden in wallpaper mode) */}
      {!isWallpaperMode && (
        <div className="fixed bottom-4 left-4 right-4 z-30 flex justify-between items-center pointer-events-none">
          {/* Command Center button */}
          <button
            onClick={() => {
              setShowCommandCenter(true)
              // Exit pointer lock when opening
              if (document.pointerLockElement) {
                document.exitPointerLock()
              }
            }}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all duration-200"
          >
            <span className="text-lg">🧠</span>
            <span className="text-sm">Command Center</span>
            <kbd className="ml-2 px-1.5 py-0.5 bg-white/10 rounded text-xs text-white/40">Tab</kbd>
          </button>

          {/* Setup button */}
          <button
            onClick={() => setShowSetup(true)}
            className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/60 hover:text-white transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Setup
          </button>
        </div>
      )}

      {/* Idle drift indicator */}
      {isIdle && !isWallpaperMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-pulse">
          <p className="text-white/20 text-xs tracking-wide">
            Move mouse to resume
          </p>
        </div>
      )}

      {/* Wallpaper mode indicator - subtle hint that F10 exits */}
      {isWallpaperMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-500">
          <p className="text-white/20 text-xs tracking-wide">
            F10 to exit wallpaper mode
          </p>
        </div>
      )}
      
      {/* Command Center modal */}
      {showCommandCenter && (
        <CommandCenter 
          onClose={() => setShowCommandCenter(false)} 
          onNavigateToThought={(thoughtId) => {
            // Find the thought by ID
            const thought = thoughts.find(t => t.id === thoughtId)
            if (thought) {
              // Teleport camera to position (close enough to see the info panel)
              // PANEL_FULL threshold is 8 units, so we go to 6 units back
              cameraControl.teleportTo = {
                x: thought.position.x,
                y: thought.position.y,
                z: thought.position.z + 6  // Close enough to see panel (< 8 units)
              }
              // Look at the thought
              cameraControl.lookAt = {
                x: thought.position.x,
                y: thought.position.y,
                z: thought.position.z
              }
              console.log('🚀 Navigating to thought:', thought.content.substring(0, 50))
              
              // Close the Command Center so the panel can show
              setShowCommandCenter(false)
            }
          }}
        />
      )}
      
      {/* Settings panel */}
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onOpenMcpSetup={() => setShowSetup(true)}
        />
      )}

      {/* Setup wizard - 3D immersive experience (opened from Settings) */}
      {showSetup && (
        <SetupWizard3D
          onClose={() => setShowSetup(false)}
          onComplete={() => setShowSetup(false)}
        />
      )}

      {/* Thought Detail modal - shows full thought info when clicked */}
      {selectedThought && (
        <ThoughtDetail
          thought={selectedThought}
          onClose={() => {
            setSelectedThought(null)
            // Re-lock pointer after closing detail view
            setTimeout(() => {
              if (canvasRef.current && !document.pointerLockElement) {
                canvasRef.current.requestPointerLock()
              }
            }, 50) // Small delay to let state update
          }}
          onNavigateToConnected={(thoughtId) => {
            // Find the connected thought and show its detail
            const thought = thoughts.find(t => t.id === thoughtId)
            if (thought) {
              setSelectedThought(thought)
              // Also teleport camera to it
              cameraControl.teleportTo = {
                x: thought.position.x,
                y: thought.position.y,
                z: thought.position.z + 6
              }
              cameraControl.lookAt = {
                x: thought.position.x,
                y: thought.position.y,
                z: thought.position.z
              }
            }
          }}
        />
      )}
    </div>
  )
}
