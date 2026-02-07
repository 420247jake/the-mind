use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use crate::utils::{extract_keywords, count_shared_keywords};

// ---- Types matching session-forge's JSON schema ----

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    pub timestamp: String,
    pub session_summary: String,
    #[serde(default)]
    pub key_moments: Vec<String>,
    pub emotional_context: Option<String>,
    #[serde(default)]
    pub breakthroughs: Vec<String>,
    #[serde(default)]
    pub frustrations: Vec<String>,
    pub collaboration_notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct JournalData {
    #[serde(default)]
    sessions: Vec<JournalEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecisionEntry {
    pub timestamp: String,
    pub choice: String,
    #[serde(default)]
    pub alternatives: Vec<String>,
    pub reasoning: String,
    pub outcome: Option<String>,
    pub project: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct DecisionsData {
    #[serde(default)]
    decisions: Vec<DecisionEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeadEndEntry {
    pub timestamp: String,
    pub attempted: String,
    pub why_failed: String,
    pub lesson: String,
    pub project: Option<String>,
    #[serde(default)]
    pub files_involved: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct DeadEndsData {
    #[serde(default)]
    dead_ends: Vec<DeadEndEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ForgeContext {
    pub journals: Vec<JournalEntry>,
    pub decisions: Vec<DecisionEntry>,
    pub dead_ends: Vec<DeadEndEntry>,
}

// ---- File system helpers ----

/// Get the session-forge data directory.
/// Windows: %APPDATA%/session-forge
/// Other: ~/.session-forge
fn get_session_forge_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var("APPDATA")
            .ok()
            .map(|appdata| PathBuf::from(appdata).join("session-forge"))
    }
    #[cfg(not(windows))]
    {
        dirs::home_dir().map(|h| h.join(".session-forge"))
    }
}

/// Check if session-forge data directory exists
pub fn is_available() -> bool {
    get_session_forge_dir()
        .map(|d| d.exists())
        .unwrap_or(false)
}

fn read_json_file<T: serde::de::DeserializeOwned>(path: &PathBuf) -> Option<T> {
    if !path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

// ---- Search ----

/// Search session-forge data for entries related to the given query text.
/// Uses keyword extraction and overlap filtering (>= 1 shared keyword).
/// Returns up to 10 entries per type, most recent first.
pub fn search_forge_context(query: &str) -> Result<ForgeContext, String> {
    let dir = get_session_forge_dir()
        .ok_or_else(|| "session-forge directory not found".to_string())?;

    if !dir.exists() {
        return Ok(ForgeContext {
            journals: vec![],
            decisions: vec![],
            dead_ends: vec![],
        });
    }

    let keywords = extract_keywords(query);
    if keywords.is_empty() {
        return Ok(ForgeContext {
            journals: vec![],
            decisions: vec![],
            dead_ends: vec![],
        });
    }

    // Search journals
    let journals = read_json_file::<JournalData>(&dir.join("journal.json"))
        .map(|data| {
            let mut matches: Vec<JournalEntry> = data.sessions.into_iter().filter(|j| {
                let text = format!(
                    "{} {} {} {}",
                    j.session_summary,
                    j.key_moments.join(" "),
                    j.breakthroughs.join(" "),
                    j.frustrations.join(" ")
                );
                let entry_keywords = extract_keywords(&text);
                count_shared_keywords(&keywords, &entry_keywords) >= 1
            }).collect();
            matches.reverse(); // most recent first
            matches.truncate(10);
            matches
        })
        .unwrap_or_default();

    // Search decisions
    let decisions = read_json_file::<DecisionsData>(&dir.join("decisions.json"))
        .map(|data| {
            let mut matches: Vec<DecisionEntry> = data.decisions.into_iter().filter(|d| {
                let text = format!(
                    "{} {} {} {}",
                    d.choice,
                    d.reasoning,
                    d.alternatives.join(" "),
                    d.tags.join(" ")
                );
                let entry_keywords = extract_keywords(&text);
                count_shared_keywords(&keywords, &entry_keywords) >= 1
            }).collect();
            matches.reverse();
            matches.truncate(10);
            matches
        })
        .unwrap_or_default();

    // Search dead ends
    let dead_ends = read_json_file::<DeadEndsData>(&dir.join("dead-ends.json"))
        .map(|data| {
            let mut matches: Vec<DeadEndEntry> = data.dead_ends.into_iter().filter(|d| {
                let text = format!(
                    "{} {} {} {}",
                    d.attempted,
                    d.why_failed,
                    d.lesson,
                    d.tags.join(" ")
                );
                let entry_keywords = extract_keywords(&text);
                count_shared_keywords(&keywords, &entry_keywords) >= 1
            }).collect();
            matches.reverse();
            matches.truncate(10);
            matches
        })
        .unwrap_or_default();

    Ok(ForgeContext { journals, decisions, dead_ends })
}
