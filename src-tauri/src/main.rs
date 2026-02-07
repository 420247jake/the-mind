// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod database;
mod mcp_server;
pub mod session_forge;
pub mod utils;
mod wallpaper;

use std::sync::Mutex;
use database::Database;
use serde::{Deserialize, Serialize};

// Shared state
pub struct AppState {
    pub db: Mutex<Database>,
}

// Thought structure for Tauri commands
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Thought {
    pub id: String,
    pub content: String,
    pub role: Option<String>,
    pub category: String,
    pub importance: f64,
    pub position_x: f64,
    pub position_y: f64,
    pub position_z: f64,
    pub created_at: String,
    pub last_referenced: String,
}

// Connection structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Connection {
    pub id: String,
    pub from_thought: String,
    pub to_thought: String,
    pub strength: f64,
    pub reason: String,
    pub created_at: String,
}

// Session structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub title: String,
    pub summary: Option<String>,
    pub started_at: String,
    pub ended_at: Option<String>,
}

// Cluster structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cluster {
    pub id: String,
    pub name: String,
    pub category: String,
    pub center_x: f64,
    pub center_y: f64,
    pub center_z: f64,
    pub thought_count: i64,
    pub created_at: String,
}

// DB version for smart polling
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbVersion {
    pub thought_max_id: i64,
    pub connection_max_id: i64,
}

// Tauri commands
#[tauri::command]
fn get_all_thoughts(state: tauri::State<AppState>) -> Result<Vec<Thought>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_all_thoughts().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_connections(state: tauri::State<AppState>) -> Result<Vec<Connection>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_all_connections().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_thought(state: tauri::State<AppState>, thought: Thought) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_thought(&thought).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_connection(state: tauri::State<AppState>, connection: Connection) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.insert_connection(&connection).map_err(|e| e.to_string())
}

#[tauri::command]
fn search_thoughts(state: tauri::State<AppState>, query: String) -> Result<Vec<Thought>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.search_thoughts(&query).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_sessions(state: tauri::State<AppState>) -> Result<Vec<Session>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_all_sessions().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_db_version(state: tauri::State<AppState>) -> Result<DbVersion, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let thought_max_id = db.get_max_thought_rowid().map_err(|e| e.to_string())?;
    let connection_max_id = db.get_max_connection_rowid().map_err(|e| e.to_string())?;
    Ok(DbVersion { thought_max_id, connection_max_id })
}

#[tauri::command]
fn get_thought_count(state: tauri::State<AppState>) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_thought_count().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_thoughts_near(state: tauri::State<AppState>, x: f64, y: f64, z: f64, radius: f64, limit: i64) -> Result<Vec<Thought>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_thoughts_near(x, y, z, radius, limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_connections_for_thoughts(state: tauri::State<AppState>, ids: Vec<String>) -> Result<Vec<Connection>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_connections_for_thoughts(&ids).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_all_clusters(state: tauri::State<AppState>) -> Result<Vec<Cluster>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.get_all_clusters().map_err(|e| e.to_string())
}

#[tauri::command]
fn recompute_clusters(state: tauri::State<AppState>) -> Result<Vec<Cluster>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.compute_clusters().map_err(|e| e.to_string())
}

// Session-forge integration
#[tauri::command]
fn get_forge_available() -> bool {
    session_forge::is_available()
}

#[tauri::command]
fn get_forge_context(query: String) -> Result<session_forge::ForgeContext, String> {
    session_forge::search_forge_context(&query)
}

// Get available monitors
#[tauri::command]
fn get_monitors() -> Vec<wallpaper::MonitorInfo> {
    wallpaper::get_monitors()
}

// Enter wallpaper mode - embed window behind desktop icons (all monitors)
#[tauri::command]
fn enter_wallpaper_mode(window: tauri::Window) -> Result<(), String> {
    #[cfg(windows)]
    {
        use tauri::Manager;

        // Get the native window handle
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;

        wallpaper::set_as_wallpaper(hwnd.0 as isize)
    }

    #[cfg(not(windows))]
    {
        let _ = window;
        Err("Wallpaper mode is only supported on Windows".to_string())
    }
}

// Enter wallpaper mode on a specific monitor
#[tauri::command]
fn enter_wallpaper_mode_on_monitor(window: tauri::Window, monitor_id: Option<u32>) -> Result<(), String> {
    #[cfg(windows)]
    {
        use tauri::Manager;

        let hwnd = window.hwnd().map_err(|e| e.to_string())?;

        let mode = match monitor_id {
            Some(id) => wallpaper::WallpaperDisplayMode::SingleMonitor(id),
            None => wallpaper::WallpaperDisplayMode::AllMonitors,
        };

        wallpaper::set_as_wallpaper_on_monitors(hwnd.0 as isize, mode)
    }

    #[cfg(not(windows))]
    {
        let _ = (window, monitor_id);
        Err("Wallpaper mode is only supported on Windows".to_string())
    }
}

// Enter wallpaper mode with specific bounds (most reliable - no re-enumeration)
#[tauri::command]
fn enter_wallpaper_mode_with_bounds(window: tauri::Window, x: i32, y: i32, width: i32, height: i32) -> Result<(), String> {
    #[cfg(windows)]
    {
        use tauri::Manager;

        let hwnd = window.hwnd().map_err(|e| e.to_string())?;

        wallpaper::set_as_wallpaper_with_bounds(hwnd.0 as isize, x, y, width, height)
    }

    #[cfg(not(windows))]
    {
        let _ = (window, x, y, width, height);
        Err("Wallpaper mode is only supported on Windows".to_string())
    }
}

// Exit wallpaper mode - restore normal window
#[tauri::command]
fn exit_wallpaper_mode(window: tauri::Window) -> Result<(), String> {
    #[cfg(windows)]
    {
        use tauri::Manager;

        // Get the native window handle
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;

        wallpaper::restore_from_wallpaper(hwnd.0 as isize)
    }

    #[cfg(not(windows))]
    {
        Err("Wallpaper mode is only supported on Windows".to_string())
    }
}

fn main() {
    // Check if running as MCP server (via --mcp flag)
    let args: Vec<String> = std::env::args().collect();
    if args.contains(&"--mcp".to_string()) {
        // Run as MCP server (stdio mode)
        mcp_server::run_mcp_server();
        return;
    }

    // Initialize database
    let db = Database::new().expect("Failed to initialize database");
    
    // Run as Tauri application
    tauri::Builder::default()
        .manage(AppState {
            db: Mutex::new(db),
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            get_all_thoughts,
            get_all_connections,
            add_thought,
            add_connection,
            search_thoughts,
            get_all_sessions,
            get_db_version,
            get_thought_count,
            get_thoughts_near,
            get_connections_for_thoughts,
            get_all_clusters,
            recompute_clusters,
            get_forge_available,
            get_forge_context,
            get_monitors,
            enter_wallpaper_mode,
            enter_wallpaper_mode_on_monitor,
            enter_wallpaper_mode_with_bounds,
            exit_wallpaper_mode,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
