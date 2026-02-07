import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useMindStore } from '../stores/mindStore'
import { useDreamStore } from '../stores/dreamStore'
import { useTimelineStore } from '../stores/timelineStore'
import { CATEGORY_COLORS } from '../types'
import type { Thought } from '../types'
import ThoughtCard from './ThoughtCard'
import AxonConnection from './AxonConnection'
import AmbientParticles from './AmbientParticles'
import ThoughtPulseManager from './ThoughtPulse'
import ClusterCloud from './ClusterCloud'

interface MindSpaceProps {
  isUIOpen?: boolean
  onThoughtClick?: (thought: Thought) => void
}

// How far camera must move before triggering a spatial reload
const SPATIAL_MOVE_THRESHOLD = 20
// Minimum seconds between spatial reloads
const SPATIAL_RELOAD_COOLDOWN = 1.0

// Main MindSpace component - renders thoughts as neurons and connections as axons
export default function MindSpace({ isUIOpen = false, onThoughtClick }: MindSpaceProps) {
  const { thoughts, connections, clusters, useSpatialLoading, loadNearCamera } = useMindStore()
  const { tick: tickDream, isActive: isDreaming } = useDreamStore()
  const { tick: tickTimeline, isActive: isTimeline, isVisible: isTimelineVisible } = useTimelineStore()

  // Spatial pagination tracking
  const lastSpatialPos = useRef(new THREE.Vector3(0, 0, 50))
  const spatialCooldown = useRef(0)
  const spatialLoadPending = useRef(false)

  // Filter connections for timeline mode
  const visibleConnections = useMemo(() => {
    if (!isTimeline) return connections

    return connections.filter(conn => {
      const fromThought = thoughts.find(t => t.id === conn.fromThought)
      const toThought = thoughts.find(t => t.id === conn.toThought)

      if (!fromThought || !toThought) return false

      return isTimelineVisible(fromThought.createdAt) && isTimelineVisible(toThought.createdAt)
    })
  }, [connections, thoughts, isTimeline, isTimelineVisible])

  // Tick dream mode, timeline, and spatial pagination each frame
  useFrame(({ camera }, delta) => {
    if (isDreaming) {
      tickDream(thoughts.map(t => t.id), delta)
    }
    if (isTimeline) {
      tickTimeline(delta)
    }

    // Spatial pagination: check if camera moved enough to reload nearby thoughts
    if (useSpatialLoading) {
      spatialCooldown.current -= delta

      const camPos = camera.position
      const dist = lastSpatialPos.current.distanceTo(camPos)

      if (dist > SPATIAL_MOVE_THRESHOLD && spatialCooldown.current <= 0 && !spatialLoadPending.current) {
        spatialLoadPending.current = true
        spatialCooldown.current = SPATIAL_RELOAD_COOLDOWN
        lastSpatialPos.current.copy(camPos)

        loadNearCamera(camPos.x, camPos.y, camPos.z).finally(() => {
          spatialLoadPending.current = false
        })
      }
    }
  })

  const handleThoughtClick = (thought: Thought) => {
    console.log('Clicked thought:', thought)
    // Call the parent handler to open detail view
    onThoughtClick?.(thought)
  }

  return (
    <group>
      {/* Ambient background particles - represents background cognitive activity */}
      <AmbientParticles count={400} bounds={100} color="#3366aa" />

      {/* Thought pulse manager - handles expanding ripple effects */}
      <ThoughtPulseManager />

      {/* Axon connections - organic neural pathways */}
      {visibleConnections.map((connection) => {
        const fromThought = thoughts.find(t => t.id === connection.fromThought)
        const toThought = thoughts.find(t => t.id === connection.toThought)

        if (!fromThought || !toThought) return null

        return (
          <AxonConnection
            key={connection.id}
            connectionId={connection.id}
            start={[fromThought.position.x, fromThought.position.y, fromThought.position.z]}
            end={[toThought.position.x, toThought.position.y, toThought.position.z]}
            startColor={CATEGORY_COLORS[fromThought.category]}
            endColor={CATEGORY_COLORS[toThought.category]}
            fromThoughtId={connection.fromThought}
            toThoughtId={connection.toThought}
            strength={connection.strength}
          />
        )
      })}

      {/* Cluster nebulas - translucent spheres around category groups */}
      {clusters.map((cluster) => (
        <ClusterCloud
          key={cluster.id}
          id={cluster.id}
          name={cluster.name}
          category={cluster.category}
          center={[cluster.center.x, cluster.center.y, cluster.center.z]}
          thoughtCount={cluster.thoughtCount}
        />
      ))}

      {/* Neuron nodes - organic thought representations */}
      {thoughts.map((thought) => (
        <ThoughtCard
          key={thought.id}
          thought={thought}
          onClick={() => handleThoughtClick(thought)}
          isUIOpen={isUIOpen}
        />
      ))}
    </group>
  )
}
