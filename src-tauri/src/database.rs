use rusqlite::{Connection, Result, params};
use uuid::Uuid;
use chrono::Utc;
use crate::{Thought, Connection as ThoughtConnection};

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new() -> Result<Self> {
        // Store in user's app data directory
        let db_path = dirs::data_dir()
            .map(|p| p.join("the-mind").join("mind.db"))
            .unwrap_or_else(|| std::path::PathBuf::from("mind.db"));
        
        // Ensure directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        
        let conn = Connection::open(&db_path)?;
        
        let db = Database { conn };
        db.init_schema()?;
        
        Ok(db)
    }
    
    fn init_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            r#"
            -- Thoughts: Every idea, message, concept
            CREATE TABLE IF NOT EXISTS thoughts (
                id TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                role TEXT,
                category TEXT DEFAULT 'other',
                importance REAL DEFAULT 0.5,
                position_x REAL DEFAULT 0.0,
                position_y REAL DEFAULT 0.0,
                position_z REAL DEFAULT 0.0,
                created_at TEXT NOT NULL,
                last_referenced TEXT NOT NULL,
                metadata TEXT
            );
            
            -- Connections: Links between thoughts
            CREATE TABLE IF NOT EXISTS connections (
                id TEXT PRIMARY KEY,
                from_thought TEXT NOT NULL,
                to_thought TEXT NOT NULL,
                strength REAL DEFAULT 0.5,
                reason TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (from_thought) REFERENCES thoughts(id),
                FOREIGN KEY (to_thought) REFERENCES thoughts(id)
            );
            
            -- Sessions: Conversation boundaries
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT,
                started_at TEXT NOT NULL,
                ended_at TEXT,
                summary TEXT,
                metadata TEXT
            );
            
            -- Session-Thought mapping
            CREATE TABLE IF NOT EXISTS session_thoughts (
                session_id TEXT,
                thought_id TEXT,
                position INTEGER,
                PRIMARY KEY (session_id, thought_id),
                FOREIGN KEY (session_id) REFERENCES sessions(id),
                FOREIGN KEY (thought_id) REFERENCES thoughts(id)
            );
            
            -- Clusters: Auto-grouped thoughts by category
            CREATE TABLE IF NOT EXISTS clusters (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                center_x REAL DEFAULT 0.0,
                center_y REAL DEFAULT 0.0,
                center_z REAL DEFAULT 0.0,
                thought_count INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            -- Create indexes for faster queries
            CREATE INDEX IF NOT EXISTS idx_thoughts_category ON thoughts(category);
            CREATE INDEX IF NOT EXISTS idx_thoughts_content ON thoughts(content);
            CREATE INDEX IF NOT EXISTS idx_connections_from ON connections(from_thought);
            CREATE INDEX IF NOT EXISTS idx_connections_to ON connections(to_thought);
            "#
        )?;
        
        Ok(())
    }
    
    pub fn insert_thought(&self, thought: &Thought) -> Result<()> {
        self.conn.execute(
            r#"INSERT OR REPLACE INTO thoughts 
               (id, content, role, category, importance, position_x, position_y, position_z, created_at, last_referenced)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"#,
            params![
                thought.id,
                thought.content,
                thought.role,
                thought.category,
                thought.importance,
                thought.position_x,
                thought.position_y,
                thought.position_z,
                thought.created_at,
                thought.last_referenced,
            ],
        )?;
        Ok(())
    }
    
    pub fn insert_connection(&self, conn: &ThoughtConnection) -> Result<()> {
        self.conn.execute(
            r#"INSERT OR REPLACE INTO connections 
               (id, from_thought, to_thought, strength, reason, created_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6)"#,
            params![
                conn.id,
                conn.from_thought,
                conn.to_thought,
                conn.strength,
                conn.reason,
                conn.created_at,
            ],
        )?;
        Ok(())
    }
    
    pub fn get_all_thoughts(&self) -> Result<Vec<Thought>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, content, role, category, importance, position_x, position_y, position_z, created_at, last_referenced FROM thoughts"
        )?;
        
        let thoughts = stmt.query_map([], |row| {
            Ok(Thought {
                id: row.get(0)?,
                content: row.get(1)?,
                role: row.get(2)?,
                category: row.get(3)?,
                importance: row.get(4)?,
                position_x: row.get(5)?,
                position_y: row.get(6)?,
                position_z: row.get(7)?,
                created_at: row.get(8)?,
                last_referenced: row.get(9)?,
            })
        })?;
        
        thoughts.collect()
    }
    
    pub fn get_all_connections(&self) -> Result<Vec<ThoughtConnection>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, from_thought, to_thought, strength, reason, created_at FROM connections"
        )?;
        
        let connections = stmt.query_map([], |row| {
            Ok(ThoughtConnection {
                id: row.get(0)?,
                from_thought: row.get(1)?,
                to_thought: row.get(2)?,
                strength: row.get(3)?,
                reason: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;
        
        connections.collect()
    }
    
    pub fn search_thoughts(&self, query: &str) -> Result<Vec<Thought>> {
        let search_pattern = format!("%{}%", query);
        let mut stmt = self.conn.prepare(
            "SELECT id, content, role, category, importance, position_x, position_y, position_z, created_at, last_referenced 
             FROM thoughts 
             WHERE content LIKE ?1
             ORDER BY importance DESC, last_referenced DESC
             LIMIT 20"
        )?;
        
        let thoughts = stmt.query_map([search_pattern], |row| {
            Ok(Thought {
                id: row.get(0)?,
                content: row.get(1)?,
                role: row.get(2)?,
                category: row.get(3)?,
                importance: row.get(4)?,
                position_x: row.get(5)?,
                position_y: row.get(6)?,
                position_z: row.get(7)?,
                created_at: row.get(8)?,
                last_referenced: row.get(9)?,
            })
        })?;
        
        thoughts.collect()
    }
    
    pub fn insert_session(&self, id: &str, title: &str, summary: &str, started_at: &str, ended_at: &str) -> Result<()> {
        self.conn.execute(
            r#"INSERT OR REPLACE INTO sessions
               (id, title, summary, started_at, ended_at)
               VALUES (?1, ?2, ?3, ?4, ?5)"#,
            params![id, title, summary, started_at, ended_at],
        )?;
        Ok(())
    }

    pub fn get_all_sessions(&self) -> Result<Vec<crate::Session>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, summary, started_at, ended_at FROM sessions ORDER BY started_at DESC"
        )?;

        let sessions = stmt.query_map([], |row| {
            Ok(crate::Session {
                id: row.get(0)?,
                title: row.get(1)?,
                summary: row.get(2)?,
                started_at: row.get(3)?,
                ended_at: row.get(4)?,
            })
        })?;

        sessions.collect()
    }

    pub fn get_max_thought_rowid(&self) -> Result<i64> {
        self.conn.query_row(
            "SELECT COALESCE(MAX(rowid), 0) FROM thoughts",
            [],
            |row| row.get(0),
        )
    }

    pub fn get_max_connection_rowid(&self) -> Result<i64> {
        self.conn.query_row(
            "SELECT COALESCE(MAX(rowid), 0) FROM connections",
            [],
            |row| row.get(0),
        )
    }

    pub fn get_thought_count(&self) -> Result<i64> {
        self.conn.query_row(
            "SELECT COUNT(*) FROM thoughts",
            [],
            |row| row.get(0),
        )
    }

    /// Get thoughts within a radius of a 3D point, sorted by distance.
    /// Uses Euclidean distance calculated in SQL for efficiency.
    pub fn get_thoughts_near(&self, x: f64, y: f64, z: f64, radius: f64, limit: i64) -> Result<Vec<Thought>> {
        let mut stmt = self.conn.prepare(
            r#"SELECT id, content, role, category, importance, position_x, position_y, position_z, created_at, last_referenced,
                      ((position_x - ?1) * (position_x - ?1) +
                       (position_y - ?2) * (position_y - ?2) +
                       (position_z - ?3) * (position_z - ?3)) AS dist_sq
               FROM thoughts
               WHERE dist_sq <= (?4 * ?4)
               ORDER BY dist_sq ASC
               LIMIT ?5"#
        )?;

        let thoughts = stmt.query_map(params![x, y, z, radius, limit], |row| {
            Ok(Thought {
                id: row.get(0)?,
                content: row.get(1)?,
                role: row.get(2)?,
                category: row.get(3)?,
                importance: row.get(4)?,
                position_x: row.get(5)?,
                position_y: row.get(6)?,
                position_z: row.get(7)?,
                created_at: row.get(8)?,
                last_referenced: row.get(9)?,
            })
        })?;

        thoughts.collect()
    }

    /// Get connections where both endpoints are in the given thought ID set
    pub fn get_connections_for_thoughts(&self, ids: &[String]) -> Result<Vec<ThoughtConnection>> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }

        // Build placeholders: (?1, ?2, ?3, ...)
        let placeholders: Vec<String> = (1..=ids.len()).map(|i| format!("?{}", i)).collect();
        let ph = placeholders.join(", ");

        let sql = format!(
            "SELECT id, from_thought, to_thought, strength, reason, created_at FROM connections WHERE from_thought IN ({ph}) AND to_thought IN ({ph})"
        );

        let mut stmt = self.conn.prepare(&sql)?;

        // Bind IDs twice (once for from_thought IN, once for to_thought IN)
        let mut param_values: Vec<&dyn rusqlite::types::ToSql> = Vec::new();
        for id in ids.iter() {
            param_values.push(id);
        }
        for id in ids.iter() {
            param_values.push(id);
        }

        let connections = stmt.query_map(rusqlite::params_from_iter(param_values), |row| {
            Ok(ThoughtConnection {
                id: row.get(0)?,
                from_thought: row.get(1)?,
                to_thought: row.get(2)?,
                strength: row.get(3)?,
                reason: row.get(4)?,
                created_at: row.get(5)?,
            })
        })?;

        connections.collect()
    }

    /// Recompute clusters by grouping thoughts by category and averaging positions.
    /// Replaces all existing clusters.
    pub fn compute_clusters(&self) -> Result<Vec<crate::Cluster>> {
        // Delete old clusters
        self.conn.execute("DELETE FROM clusters", [])?;

        // Group thoughts by category and compute centroids
        let mut stmt = self.conn.prepare(
            r#"SELECT category,
                      AVG(position_x), AVG(position_y), AVG(position_z),
                      COUNT(*)
               FROM thoughts
               GROUP BY category
               HAVING COUNT(*) >= 2"#
        )?;

        let now = Utc::now().to_rfc3339();
        let mut clusters = Vec::new();

        let rows = stmt.query_map([], |row| {
            let category: String = row.get(0)?;
            let cx: f64 = row.get(1)?;
            let cy: f64 = row.get(2)?;
            let cz: f64 = row.get(3)?;
            let count: i64 = row.get(4)?;
            Ok((category, cx, cy, cz, count))
        })?;

        for row in rows {
            let (category, cx, cy, cz, count) = row?;
            let id = Uuid::new_v4().to_string();
            let name = format!("{} cluster", category);

            self.conn.execute(
                r#"INSERT INTO clusters (id, name, category, center_x, center_y, center_z, thought_count, created_at)
                   VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"#,
                params![id, name, category, cx, cy, cz, count, now],
            )?;

            clusters.push(crate::Cluster {
                id,
                name,
                category,
                center_x: cx,
                center_y: cy,
                center_z: cz,
                thought_count: count,
                created_at: now.clone(),
            });
        }

        Ok(clusters)
    }

    pub fn get_all_clusters(&self) -> Result<Vec<crate::Cluster>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, name, category, center_x, center_y, center_z, thought_count, created_at FROM clusters"
        )?;

        let clusters = stmt.query_map([], |row| {
            Ok(crate::Cluster {
                id: row.get(0)?,
                name: row.get(1)?,
                category: row.get(2)?,
                center_x: row.get(3)?,
                center_y: row.get(4)?,
                center_z: row.get(5)?,
                thought_count: row.get(6)?,
                created_at: row.get(7)?,
            })
        })?;

        clusters.collect()
    }

    // Helper to generate random position for new thoughts
    pub fn generate_position() -> (f64, f64, f64) {
        use std::f64::consts::PI;
        let radius = 10.0 + rand::random::<f64>() * 30.0;
        let theta = rand::random::<f64>() * 2.0 * PI;
        let phi = rand::random::<f64>() * PI;
        
        let x = radius * phi.sin() * theta.cos();
        let y = radius * phi.sin() * theta.sin();
        let z = radius * phi.cos();
        
        (x, y, z)
    }
}

// For random position generation
mod rand {
    use std::time::{SystemTime, UNIX_EPOCH};
    
    static mut SEED: u64 = 0;
    
    pub fn random<T: From<f64>>() -> T {
        unsafe {
            if SEED == 0 {
                SEED = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos() as u64;
            }
            
            // Simple LCG
            SEED = SEED.wrapping_mul(6364136223846793005).wrapping_add(1);
            let val = (SEED >> 33) as f64 / (1u64 << 31) as f64;
            T::from(val)
        }
    }
}
