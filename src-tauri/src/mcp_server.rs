use std::io::{self, BufRead, Write};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use uuid::Uuid;
use chrono::Utc;
use crate::database::Database;

// MCP Protocol structures
#[derive(Debug, Deserialize)]
struct McpRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    params: Option<Value>,
}

#[derive(Debug, Serialize)]
struct McpResponse {
    jsonrpc: String,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<McpError>,
}

#[derive(Debug, Serialize)]
struct McpError {
    code: i32,
    message: String,
}

// Tool input types
#[derive(Debug, Deserialize)]
struct MindLogInput {
    content: String,
    category: String,
    importance: f64,
}

#[derive(Debug, Deserialize)]
struct MindConnectInput {
    from: String,
    to: String,
    reason: String,
}

#[derive(Debug, Deserialize)]
struct MindRecallInput {
    query: String,
    #[serde(default = "default_limit")]
    limit: usize,
}

fn default_limit() -> usize { 10 }

#[derive(Debug, Deserialize)]
struct MindSummarizeInput {
    title: String,
    summary: String,
}

pub fn run_mcp_server() {
    let db = Database::new().expect("Failed to initialize database");
    let stdin = io::stdin();
    let mut stdout = io::stdout();
    
    eprintln!("The Mind MCP Server started");
    
    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        
        if line.is_empty() {
            continue;
        }
        
        let request: McpRequest = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("Failed to parse request: {}", e);
                continue;
            }
        };
        
        let response = handle_request(&db, &request);
        
        if let Some(resp) = response {
            let response_str = serde_json::to_string(&resp).unwrap();
            writeln!(stdout, "{}", response_str).unwrap();
            stdout.flush().unwrap();
        }
    }
}

fn handle_request(db: &Database, request: &McpRequest) -> Option<McpResponse> {
    let id = request.id.clone()?;
    
    match request.method.as_str() {
        "initialize" => {
            Some(McpResponse {
                jsonrpc: "2.0".to_string(),
                id,
                result: Some(json!({
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "the-mind",
                        "version": "0.1.0"
                    }
                })),
                error: None,
            })
        }
        
        "tools/list" => {
            Some(McpResponse {
                jsonrpc: "2.0".to_string(),
                id,
                result: Some(json!({
                    "tools": [
                        {
                            "name": "mind_log",
                            "description": "Log a thought, concept, or important point to The Mind. Use this to record key ideas, decisions, or insights during conversation. The thought will appear as a glowing node in 3D space.",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "content": {
                                        "type": "string",
                                        "description": "The thought or concept to record"
                                    },
                                    "category": {
                                        "type": "string",
                                        "enum": ["work", "personal", "technical", "creative", "other"],
                                        "description": "Category of the thought (affects color in visualization)"
                                    },
                                    "importance": {
                                        "type": "number",
                                        "minimum": 0,
                                        "maximum": 1,
                                        "description": "How significant is this thought (0-1, affects node size)"
                                    }
                                },
                                "required": ["content", "category", "importance"]
                            }
                        },
                        {
                            "name": "mind_connect",
                            "description": "Create a connection between two concepts in The Mind. Use when you notice relationships between ideas. The connection appears as a glowing line between nodes.",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "from": {
                                        "type": "string",
                                        "description": "First concept (use exact text of a logged thought)"
                                    },
                                    "to": {
                                        "type": "string",
                                        "description": "Second concept (use exact text of a logged thought)"
                                    },
                                    "reason": {
                                        "type": "string",
                                        "description": "Why these concepts connect"
                                    }
                                },
                                "required": ["from", "to", "reason"]
                            }
                        },
                        {
                            "name": "mind_recall",
                            "description": "Search The Mind for relevant past thoughts and connections. Use to find related ideas from previous conversations.",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "query": {
                                        "type": "string",
                                        "description": "What to search for"
                                    },
                                    "limit": {
                                        "type": "number",
                                        "default": 10,
                                        "description": "Maximum number of results to return"
                                    }
                                },
                                "required": ["query"]
                            }
                        },
                        {
                            "name": "mind_summarize_session",
                            "description": "Generate a summary of the current conversation for The Mind. Use at the end of conversations to create a record.",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "title": {
                                        "type": "string",
                                        "description": "Brief title for the session"
                                    },
                                    "summary": {
                                        "type": "string",
                                        "description": "Summary of what was discussed"
                                    }
                                },
                                "required": ["title", "summary"]
                            }
                        }
                    ]
                })),
                error: None,
            })
        }
        
        "tools/call" => {
            let params = request.params.as_ref()?;
            let tool_name = params.get("name")?.as_str()?;
            let arguments = params.get("arguments")?;
            
            let result = match tool_name {
                "mind_log" => handle_mind_log(db, arguments),
                "mind_connect" => handle_mind_connect(db, arguments),
                "mind_recall" => handle_mind_recall(db, arguments),
                "mind_summarize_session" => handle_mind_summarize(db, arguments),
                _ => Err(format!("Unknown tool: {}", tool_name)),
            };
            
            Some(McpResponse {
                jsonrpc: "2.0".to_string(),
                id,
                result: Some(match result {
                    Ok(content) => json!({
                        "content": [{
                            "type": "text",
                            "text": content
                        }]
                    }),
                    Err(e) => json!({
                        "content": [{
                            "type": "text",
                            "text": format!("Error: {}", e)
                        }],
                        "isError": true
                    }),
                }),
                error: None,
            })
        }
        
        "notifications/initialized" => None, // No response needed
        
        _ => {
            Some(McpResponse {
                jsonrpc: "2.0".to_string(),
                id,
                result: None,
                error: Some(McpError {
                    code: -32601,
                    message: format!("Method not found: {}", request.method),
                }),
            })
        }
    }
}

use crate::utils::{extract_keywords, count_shared_keywords};

fn handle_mind_log(db: &Database, arguments: &Value) -> Result<String, String> {
    let input: MindLogInput = serde_json::from_value(arguments.clone())
        .map_err(|e| format!("Invalid arguments: {}", e))?;
    
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let (x, y, z) = Database::generate_position();
    
    let thought = crate::Thought {
        id: id.clone(),
        content: input.content.clone(),
        role: Some("assistant".to_string()),
        category: input.category.clone(),
        importance: input.importance,
        position_x: x,
        position_y: y,
        position_z: z,
        created_at: now.clone(),
        last_referenced: now.clone(),
    };
    
    db.insert_thought(&thought).map_err(|e| e.to_string())?;
    
    // === AUTO-CONNECTION LOGIC ===
    let new_keywords = extract_keywords(&input.content);
    let mut auto_connections = Vec::new();
    
    // Get all existing thoughts (except the one we just created)
    if let Ok(all_thoughts) = db.get_all_thoughts() {
        for existing in all_thoughts.iter().filter(|t| t.id != id) {
            let existing_keywords = extract_keywords(&existing.content);
            let shared = count_shared_keywords(&new_keywords, &existing_keywords);
            
            // If 2+ shared keywords, create a connection
            if shared >= 2 {
                let conn_id = Uuid::new_v4().to_string();
                let connection = crate::Connection {
                    id: conn_id,
                    from_thought: id.clone(),
                    to_thought: existing.id.clone(),
                    strength: (shared as f64 * 0.15).min(1.0), // Strength based on keyword overlap
                    reason: format!("Auto-connected: {} shared keywords", shared),
                    created_at: now.clone(),
                };
                
                if db.insert_connection(&connection).is_ok() {
                    auto_connections.push(existing.content[..existing.content.len().min(40)].to_string());
                }
            }
        }
    }
    
    // Build response
    let mut response = format!(
        "✨ Thought logged to The Mind!\n\nID: {}\nCategory: {}\nImportance: {:.0}%\nContent: \"{}\"",
        id, input.category, input.importance * 100.0, input.content
    );
    
    if !auto_connections.is_empty() {
        response.push_str(&format!(
            "\n\n🔗 Auto-connected to {} existing thought(s):\n{}",
            auto_connections.len(),
            auto_connections.iter().map(|c| format!("  • {}...", c)).collect::<Vec<_>>().join("\n")
        ));
    }

    // Recompute clusters after adding a thought
    if let Ok(clusters) = db.compute_clusters() {
        response.push_str(&format!("\n\n🌐 {} cluster(s) updated", clusters.len()));
    }

    Ok(response)
}

fn handle_mind_connect(db: &Database, arguments: &Value) -> Result<String, String> {
    let input: MindConnectInput = serde_json::from_value(arguments.clone())
        .map_err(|e| format!("Invalid arguments: {}", e))?;
    
    // Find thoughts by content
    let from_thoughts = db.search_thoughts(&input.from).map_err(|e| e.to_string())?;
    let to_thoughts = db.search_thoughts(&input.to).map_err(|e| e.to_string())?;
    
    let from_thought = from_thoughts.first()
        .ok_or_else(|| format!("Could not find thought: {}", input.from))?;
    let to_thought = to_thoughts.first()
        .ok_or_else(|| format!("Could not find thought: {}", input.to))?;
    
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    
    let connection = crate::Connection {
        id: id.clone(),
        from_thought: from_thought.id.clone(),
        to_thought: to_thought.id.clone(),
        strength: 0.7,
        reason: input.reason.clone(),
        created_at: now,
    };
    
    db.insert_connection(&connection).map_err(|e| e.to_string())?;
    
    Ok(format!(
        "🔗 Connection created in The Mind!\n\nFrom: \"{}\"\nTo: \"{}\"\nReason: {}",
        &from_thought.content[..from_thought.content.len().min(50)],
        &to_thought.content[..to_thought.content.len().min(50)],
        input.reason
    ))
}

fn handle_mind_recall(db: &Database, arguments: &Value) -> Result<String, String> {
    let input: MindRecallInput = serde_json::from_value(arguments.clone())
        .map_err(|e| format!("Invalid arguments: {}", e))?;
    
    let thoughts = db.search_thoughts(&input.query).map_err(|e| e.to_string())?;
    
    if thoughts.is_empty() {
        return Ok(format!("No thoughts found matching: \"{}\"", input.query));
    }
    
    let results: Vec<String> = thoughts.iter()
        .take(input.limit)
        .map(|t| format!(
            "• [{}] {} (importance: {:.0}%)",
            t.category,
            t.content,
            t.importance * 100.0
        ))
        .collect();
    
    Ok(format!(
        "🧠 Found {} thought(s) matching \"{}\":\n\n{}",
        results.len(),
        input.query,
        results.join("\n")
    ))
}

fn handle_mind_summarize(db: &Database, arguments: &Value) -> Result<String, String> {
    let input: MindSummarizeInput = serde_json::from_value(arguments.clone())
        .map_err(|e| format!("Invalid arguments: {}", e))?;

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    // Store in the sessions table (not as a fake thought)
    db.insert_session(&id, &input.title, &input.summary, &now, &now)
        .map_err(|e| e.to_string())?;

    Ok(format!(
        "📝 Session summarized and logged to The Mind!\n\nTitle: {}\nSummary: {}",
        input.title, input.summary
    ))
}
