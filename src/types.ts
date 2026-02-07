// Shared types for The Mind

// Categories for thoughts
export type ThoughtCategory = 'work' | 'personal' | 'technical' | 'creative' | 'other';

// Role of the thought author
export type ThoughtRole = 'user' | 'assistant' | 'system';

// A single thought/concept node
export interface Thought {
  id: string;
  content: string;
  role?: ThoughtRole;
  category: ThoughtCategory;
  importance: number; // 0-1
  embedding?: number[]; // Vector for semantic search
  position: {
    x: number;
    y: number;
    z: number;
  };
  createdAt: Date;
  lastReferenced: Date;
  metadata?: Record<string, unknown>;
}

// Connection between two thoughts
export interface Connection {
  id: string;
  fromThought: string;
  toThought: string;
  strength: number; // 0-1, visual line thickness
  reason: string;
  createdAt: Date;
}

// A conversation session
export interface Session {
  id: string;
  title: string;
  startedAt: Date;
  endedAt?: Date;
  summary?: string;
  metadata?: Record<string, unknown>;
}

// Cluster of related thoughts
export interface Cluster {
  id: string;
  name: string;
  category: string;
  center: {
    x: number;
    y: number;
    z: number;
  };
  color: string;
  thoughtCount: number;
  createdAt: Date;
}

// MCP Tool input types
export interface MindLogInput {
  content: string;
  category: ThoughtCategory;
  importance: number;
}

export interface MindConnectInput {
  from: string;
  to: string;
  reason: string;
}

export interface MindRecallInput {
  query: string;
  limit?: number;
}

export interface MindSummarizeInput {
  title: string;
  summary: string;
}

// Store state
export interface MindState {
  thoughts: Thought[];
  connections: Connection[];
  sessions: Session[];
  clusters: Cluster[];
  currentSession: Session | null;
  useSpatialLoading: boolean;
  totalThoughtCount: number;

  // Actions
  addThought: (thought: Thought) => void;
  addConnection: (connection: Connection) => void;
  updateThought: (id: string, updates: Partial<Thought>) => void;
  setCurrentSession: (session: Session | null) => void;
  loadFromDatabase: () => Promise<void>;
  loadNearCamera: (x: number, y: number, z: number, radius?: number, limit?: number) => Promise<void>;
}

// Session-forge integration types
export interface ForgeJournalEntry {
  timestamp: string;
  session_summary: string;
  key_moments: string[];
  emotional_context: string | null;
  breakthroughs: string[];
  frustrations: string[];
  collaboration_notes: string | null;
}

export interface ForgeDecisionEntry {
  timestamp: string;
  choice: string;
  alternatives: string[];
  reasoning: string;
  outcome: string | null;
  project: string | null;
  tags: string[];
}

export interface ForgeDeadEndEntry {
  timestamp: string;
  attempted: string;
  why_failed: string;
  lesson: string;
  project: string | null;
  files_involved: string[];
  tags: string[];
}

export interface ForgeContext {
  journals: ForgeJournalEntry[];
  decisions: ForgeDecisionEntry[];
  dead_ends: ForgeDeadEndEntry[];
}

// Category colors
export const CATEGORY_COLORS: Record<ThoughtCategory, string> = {
  work: '#3B82F6',      // Blue
  personal: '#8B5CF6',  // Purple
  technical: '#10B981', // Green
  creative: '#F59E0B',  // Orange
  other: '#6B7280',     // Gray
};
