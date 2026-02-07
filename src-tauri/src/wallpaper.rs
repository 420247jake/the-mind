// Wallpaper mode implementation for Windows
// Embeds the window behind desktop icons like Lively Wallpaper

#[cfg(windows)]
use std::ffi::c_void;

#[cfg(windows)]
use windows_sys::Win32::{
    Foundation::{BOOL, HWND, LPARAM, POINT, RECT},
    UI::WindowsAndMessaging::*,
    Graphics::Gdi::*,
};

#[cfg(windows)]
extern "system" {
    fn MapWindowPoints(hWndFrom: HWND, hWndTo: HWND, lpPoints: *mut POINT, cPoints: u32) -> i32;
}

use serde::{Deserialize, Serialize};

/// Monitor information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorInfo {
    pub id: u32,
    pub name: String,
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
    pub is_primary: bool,
}

/// Wallpaper display mode
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WallpaperDisplayMode {
    AllMonitors,
    SingleMonitor(u32), // Monitor ID
}

/// Find the WorkerW window that sits behind the desktop icons
/// This is the technique used by Lively Wallpaper and similar apps
#[cfg(windows)]
unsafe fn find_worker_window() -> Option<HWND> {
    // Find the Progman window (Program Manager)
    let progman = FindWindowW(
        windows_sys::w!("Progman"),
        std::ptr::null(),
    );

    if progman.is_null() {
        return None;
    }

    // Send a special message to Progman to spawn a WorkerW window
    // This message (0x052C) tells Windows to create the wallpaper layer
    SendMessageTimeoutW(
        progman,
        0x052C,
        0xD,
        0x1,
        SMTO_NORMAL,
        1000,
        std::ptr::null_mut(),
    );

    // Now find the WorkerW window that contains SHELLDLL_DefView
    static mut WORKER_W: HWND = std::ptr::null_mut();

    unsafe extern "system" fn enum_callback(hwnd: HWND, _lparam: LPARAM) -> BOOL {
        // Check if this window has SHELLDLL_DefView as a child
        let shell_view = FindWindowExW(
            hwnd,
            std::ptr::null_mut(),
            windows_sys::w!("SHELLDLL_DefView"),
            std::ptr::null(),
        );

        if !shell_view.is_null() {
            // Found it! Now get the next WorkerW sibling
            let worker_w = FindWindowExW(
                std::ptr::null_mut(),
                hwnd,
                windows_sys::w!("WorkerW"),
                std::ptr::null(),
            );

            if !worker_w.is_null() {
                WORKER_W = worker_w;
                return 0; // FALSE - Stop enumerating
            }
        }

        1 // TRUE - Continue enumerating
    }

    WORKER_W = std::ptr::null_mut();
    EnumWindows(Some(enum_callback), 0);

    if !WORKER_W.is_null() {
        Some(WORKER_W)
    } else {
        None
    }
}

/// Get list of all monitors
#[cfg(windows)]
pub fn get_monitors() -> Vec<MonitorInfo> {
    use std::sync::Mutex;

    static MONITORS: Mutex<Vec<MonitorInfo>> = Mutex::new(Vec::new());

    unsafe extern "system" fn monitor_enum_callback(
        hmonitor: HMONITOR,
        _hdc: HDC,
        _lprect: *mut RECT,
        _lparam: LPARAM,
    ) -> BOOL {
        let mut info: MONITORINFOEXW = std::mem::zeroed();
        info.monitorInfo.cbSize = std::mem::size_of::<MONITORINFOEXW>() as u32;

        if GetMonitorInfoW(hmonitor, &mut info as *mut _ as *mut MONITORINFO) != 0 {
            let rc = info.monitorInfo.rcMonitor;
            let is_primary = (info.monitorInfo.dwFlags & MONITORINFOF_PRIMARY) != 0;

            // Convert device name to string
            let name_slice = &info.szDevice;
            let name_len = name_slice.iter().position(|&c| c == 0).unwrap_or(name_slice.len());
            let name = String::from_utf16_lossy(&name_slice[..name_len]);

            if let Ok(mut monitors) = MONITORS.lock() {
                // Temporarily use index as ID - will be reassigned after sorting
                monitors.push(MonitorInfo {
                    id: 0, // Will be set after sorting
                    name,
                    x: rc.left,
                    y: rc.top,
                    width: rc.right - rc.left,
                    height: rc.bottom - rc.top,
                    is_primary,
                });
            }
        }

        1 // TRUE - Continue enumerating
    }

    // Clear previous monitors
    if let Ok(mut monitors) = MONITORS.lock() {
        monitors.clear();
    }

    unsafe {
        EnumDisplayMonitors(
            std::ptr::null_mut(),
            std::ptr::null(),
            Some(monitor_enum_callback),
            0,
        );
    }

    // Sort monitors: primary first, then by x position (left-to-right)
    // This way "Monitor 1" is always the primary display
    let mut result = MONITORS.lock().map(|m| m.clone()).unwrap_or_default();
    result.sort_by(|a, b| {
        // Primary monitor comes first
        match (a.is_primary, b.is_primary) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.x.cmp(&b.x).then_with(|| a.y.cmp(&b.y))
        }
    });

    // Assign stable IDs based on sorted order
    for (i, monitor) in result.iter_mut().enumerate() {
        monitor.id = i as u32;
    }

    result
}

/// Get virtual screen bounds (all monitors combined)
#[cfg(windows)]
fn get_virtual_screen_bounds() -> (i32, i32, i32, i32) {
    unsafe {
        let x = GetSystemMetrics(SM_XVIRTUALSCREEN);
        let y = GetSystemMetrics(SM_YVIRTUALSCREEN);
        let width = GetSystemMetrics(SM_CXVIRTUALSCREEN);
        let height = GetSystemMetrics(SM_CYVIRTUALSCREEN);
        (x, y, width, height)
    }
}

/// Embed a window as the desktop wallpaper on all monitors
#[cfg(windows)]
pub fn set_as_wallpaper(window_hwnd: isize) -> Result<(), String> {
    set_as_wallpaper_on_monitors(window_hwnd, WallpaperDisplayMode::AllMonitors)
}

/// Embed a window as the desktop wallpaper with specific monitor configuration
#[cfg(windows)]
pub fn set_as_wallpaper_on_monitors(window_hwnd: isize, mode: WallpaperDisplayMode) -> Result<(), String> {
    unsafe {
        let hwnd: HWND = window_hwnd as *mut c_void;

        // Find the WorkerW window
        let worker_w = find_worker_window()
            .ok_or_else(|| "Failed to find WorkerW window".to_string())?;

        // Make the window a child of WorkerW
        SetParent(hwnd, worker_w);

        // Remove window decorations
        let style = GetWindowLongW(hwnd, GWL_STYLE);
        SetWindowLongW(
            hwnd,
            GWL_STYLE,
            style & !(WS_CAPTION as i32) & !(WS_THICKFRAME as i32) & !(WS_BORDER as i32)
        );

        // Position based on mode
        let (x, y, width, height) = match mode {
            WallpaperDisplayMode::AllMonitors => {
                // Cover all monitors (virtual screen)
                get_virtual_screen_bounds()
            }
            WallpaperDisplayMode::SingleMonitor(monitor_id) => {
                // Find the specific monitor
                let monitors = get_monitors();
                if let Some(monitor) = monitors.iter().find(|m| m.id == monitor_id) {
                    (monitor.x, monitor.y, monitor.width, monitor.height)
                } else {
                    // Fallback to primary monitor
                    let primary = monitors.iter().find(|m| m.is_primary)
                        .or_else(|| monitors.first());
                    if let Some(m) = primary {
                        (m.x, m.y, m.width, m.height)
                    } else {
                        // Ultimate fallback
                        (0, 0, GetSystemMetrics(SM_CXSCREEN), GetSystemMetrics(SM_CYSCREEN))
                    }
                }
            }
        };

        // Position the window
        SetWindowPos(
            hwnd,
            HWND_TOP,
            x,
            y,
            width,
            height,
            SWP_SHOWWINDOW | SWP_NOACTIVATE,
        );

        Ok(())
    }
}

/// Embed a window as wallpaper with specific bounds (most reliable)
/// Uses the same technique as Lively Wallpaper - MapWindowPoints for coordinate conversion
#[cfg(windows)]
pub fn set_as_wallpaper_with_bounds(window_hwnd: isize, x: i32, y: i32, width: i32, height: i32) -> Result<(), String> {
    unsafe {
        let hwnd: HWND = window_hwnd as *mut c_void;

        eprintln!("set_as_wallpaper_with_bounds: target x={}, y={}, width={}, height={}", x, y, width, height);

        // Find the WorkerW window
        let worker_w = find_worker_window()
            .ok_or_else(|| "Failed to find WorkerW window".to_string())?;

        eprintln!("Found WorkerW: {:?}", worker_w);

        // Step 1: Position window at target screen coordinates BEFORE setting parent
        // This is how Lively does it - position first, then reparent
        SetWindowPos(
            hwnd,
            HWND_TOP,
            x,
            y,
            width,
            height,
            SWP_NOACTIVATE,
        );

        // Step 2: Create RECT for MapWindowPoints
        let mut rect = RECT {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
        };

        // Step 3: Map window coordinates to WorkerW-relative coordinates
        // This converts screen coords to parent-relative coords
        MapWindowPoints(hwnd, worker_w, &mut rect as *mut _ as *mut _, 2);
        eprintln!("MapWindowPoints result: left={}, top={}", rect.left, rect.top);

        // Step 4: Make the window a child of WorkerW
        let old_parent = SetParent(hwnd, worker_w);
        eprintln!("SetParent result (old parent): {:?}", old_parent);

        // Step 5: Remove window decorations
        let style = GetWindowLongW(hwnd, GWL_STYLE);
        SetWindowLongW(
            hwnd,
            GWL_STYLE,
            style & !(WS_CAPTION as i32) & !(WS_THICKFRAME as i32) & !(WS_BORDER as i32)
        );

        // Step 6: Position the window using the mapped coordinates (relative to WorkerW)
        let result = SetWindowPos(
            hwnd,
            HWND_TOP,
            rect.left,
            rect.top,
            width,
            height,
            SWP_SHOWWINDOW | SWP_NOACTIVATE | SWP_NOZORDER,
        );
        eprintln!("SetWindowPos result: {}", result);

        Ok(())
    }
}

/// Restore a window from wallpaper mode
#[cfg(windows)]
pub fn restore_from_wallpaper(window_hwnd: isize) -> Result<(), String> {
    unsafe {
        let hwnd: HWND = window_hwnd as *mut c_void;

        // Remove parent (set to desktop/null)
        SetParent(hwnd, std::ptr::null_mut());

        // Restore window decorations
        let style = GetWindowLongW(hwnd, GWL_STYLE);
        SetWindowLongW(
            hwnd,
            GWL_STYLE,
            style | (WS_CAPTION as i32) | (WS_THICKFRAME as i32) | (WS_BORDER as i32)
        );

        // Restore window size
        SetWindowPos(
            hwnd,
            HWND_TOP,
            100,
            100,
            1200,
            800,
            SWP_SHOWWINDOW,
        );

        Ok(())
    }
}

// Non-Windows platforms - stub implementations
#[cfg(not(windows))]
pub fn get_monitors() -> Vec<MonitorInfo> {
    vec![MonitorInfo {
        id: 0,
        name: "Primary".to_string(),
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        is_primary: true,
    }]
}

#[cfg(not(windows))]
pub fn set_as_wallpaper(_window_hwnd: isize) -> Result<(), String> {
    Err("Wallpaper mode is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn set_as_wallpaper_on_monitors(_window_hwnd: isize, _mode: WallpaperDisplayMode) -> Result<(), String> {
    Err("Wallpaper mode is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn set_as_wallpaper_with_bounds(_window_hwnd: isize, _x: i32, _y: i32, _width: i32, _height: i32) -> Result<(), String> {
    Err("Wallpaper mode is only supported on Windows".to_string())
}

#[cfg(not(windows))]
pub fn restore_from_wallpaper(_window_hwnd: isize) -> Result<(), String> {
    Err("Wallpaper mode is only supported on Windows".to_string())
}
