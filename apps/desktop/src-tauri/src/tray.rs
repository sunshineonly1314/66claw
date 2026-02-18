use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder};
use tauri::{App, Manager};

use crate::{platform, sidecar};

pub fn setup_tray(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?,
            &MenuItem::with_id(app, "hide", "隐藏到托盘", true, None::<&str>)?,
            &MenuItem::new(app, "───", false, None::<&str>)?,
            &MenuItem::with_id(app, "start_service", "▶ 启动服务", true, None::<&str>)?,
            &MenuItem::with_id(app, "stop_service", "⏸ 停止服务", true, None::<&str>)?,
            &MenuItem::with_id(app, "restart_service", "🔄 重启服务", true, None::<&str>)?,
            &MenuItem::new(app, "───", false, None::<&str>)?,
            &MenuItem::with_id(app, "open_logs", "📁 查看日志", true, None::<&str>)?,
            &MenuItem::new(app, "───", false, None::<&str>)?,
            &MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?,
        ],
    )?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .icon(app.default_window_icon().unwrap().clone())
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "hide" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
            }
            "start_service" => {
                if sidecar::is_sidecar_running() {
                    println!("[Tray] Service already running");
                    return;
                }
                let handle = app.app_handle().clone();
                if let Err(e) = sidecar::start_sidecar(handle) {
                    eprintln!("[Tray] Failed to start service: {}", e);
                }
            }
            "stop_service" => {
                if !sidecar::is_sidecar_running() {
                    println!("[Tray] Service not running");
                    return;
                }
                if let Err(e) = sidecar::stop_sidecar() {
                    eprintln!("[Tray] Failed to stop service: {}", e);
                }
            }
            "restart_service" => {
                let handle = app.app_handle().clone();
                if let Err(e) = sidecar::restart_sidecar(handle) {
                    eprintln!("[Tray] Failed to restart service: {}", e);
                }
            }
            "open_logs" => {
                match sidecar::logs_directory() {
                    Ok(logs_dir) => {
                        if let Err(e) = platform::open_directory(&logs_dir) {
                            eprintln!("[Tray] Failed to open logs directory: {}", e);
                        }
                    }
                    Err(e) => {
                        eprintln!("[Tray] Failed to get logs directory: {}", e);
                    }
                }
            }
            "quit" => {
                sidecar::cleanup_on_exit();
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
