# The Mind — Concept

A 3D visualization of AI thought processes, built as a Tauri desktop app. Thoughts logged during AI conversations appear as glowing neuron nodes in a navigable 3D space. Connections between ideas form visible neural pathways. Over time, the space grows into a unique spatial map of concepts, decisions, and reasoning.

## How It Works

The Mind runs as an MCP (Model Context Protocol) server. When connected to an MCP-compatible AI client like Claude Desktop, the AI gains access to tools that let it log thoughts, create connections, recall past ideas, and summarize sessions. Everything the AI logs appears in real-time as interactive 3D objects.

### MCP Tools

| Tool | Purpose |
|------|---------|
| `mind_log` | Record a thought, concept, or key point as a node |
| `mind_connect` | Create a connection between two existing concepts |
| `mind_recall` | Search past thoughts by keyword similarity |
| `mind_summarize_session` | Capture a session summary |

### Visualization

- **Nodes** — Individual thoughts rendered as organic neuron meshes with branching dendrites. Size reflects importance, color reflects category, brightness reflects recency.
- **Connections** — Axon-like pathways between related thoughts. Thickness represents connection strength.
- **Clusters** — Translucent nebula spheres that automatically form around groups of same-category thoughts.
- **Activation** — Proximity and interaction trigger a motion-activated lighting system. Nodes glow brighter as you approach.

### Navigation

First-person flight controls. Click to enter FPS mode, WASD to move, mouse to look, Space/Shift for vertical movement. Aim the crosshair at a thought and click to inspect it.

### Modes

- **Thinking Path** — When the AI processes a query, the path it takes through existing knowledge lights up in sequence.
- **Dream Mode** — Ambient drift and visual distortion across all nodes.
- **Timeline Mode** — Scrub through thought history chronologically.
- **Wallpaper Mode** — Cinematic camera orbits for use as a desktop background (F10 toggle).
- **Idle Drift** — Screensaver-style camera movement after inactivity.

## Data

All data is stored locally in SQLite. The database lives in the OS app data directory, not in the project folder. Tables: `thoughts`, `connections`, `sessions`, `session_thoughts`, `clusters`.

Optionally integrates with [session-forge](https://github.com/420247jake/session-forge) — when detected, thought detail panels pull in related journal entries, past decisions, and dead ends from session-forge's data store.

## Tech Stack

| Layer | Technology |
|-------|------------|
| App shell | Tauri 2.0 (Rust) |
| 3D rendering | Three.js + React Three Fiber |
| Post-processing | Bokeh DOF + Unreal Bloom |
| State management | Zustand |
| Styling | TailwindCSS |
| Database | SQLite (rusqlite) |
| MCP server | Rust (stdio transport) |

## Categories

| Category | Color | Hex |
|----------|-------|-----|
| Work | Blue | #3B82F6 |
| Personal | Purple | #8B5CF6 |
| Technical | Green | #10B981 |
| Creative | Orange | #F59E0B |
| Other | Gray | #6B7280 |
