use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder};
use tauri::{App, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::{platform, repair, sidecar};

/// Stored tray state for lifecycle management and dynamic menu control.
pub struct TrayState {
    /// Keep TrayIcon alive for the entire app lifetime.
    /// Dropping it would remove the icon from the system tray.
    pub _icon: TrayIcon,
    pub start_service: MenuItem<tauri::Wry>,
    pub stop_service: MenuItem<tauri::Wry>,
    pub restart_service: MenuItem<tauri::Wry>,
}

/// Update tray menu items enabled state based on whether the service is running.
pub fn update_tray_menu_state(app: &tauri::AppHandle) {
    let running = sidecar::is_sidecar_running();
    if let Some(state) = app.try_state::<TrayState>() {
        let _ = state.start_service.set_enabled(!running);
        let _ = state.stop_service.set_enabled(running);
        let _ = state.restart_service.set_enabled(running);
    }
}

/// Show an error message to the user via the WebView alert dialog.
/// Ensures the window is visible first (user may have hidden it to tray).
fn show_tray_error(app: &tauri::AppHandle, msg: &str) {
    eprintln!("[Tray] {}", msg);
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let escaped = msg
            .replace('\\', "\\\\")
            .replace('\'', "\\'")
            .replace('\n', "\\n")
            .replace('\r', "");
        let _ = window.eval(&format!("alert('{}')", escaped));
    }
}

/// Open the repair assistant in a dedicated window.
/// If the window already exists, focus it instead of creating a new one.
fn open_repair_assistant(app: &tauri::AppHandle) {
    // Re-use existing window if already open
    if let Some(window) = app.get_webview_window("repair-assistant") {
        let _ = window.show();
        let _ = window.set_focus();
        return;
    }

    match WebviewWindowBuilder::new(
        app,
        "repair-assistant",
        WebviewUrl::App("repair-assistant.html".into()),
    )
    .title("ClawdbotCN 检修助手")
    .inner_size(960.0, 640.0)
    .resizable(true)
    .center()
    .visible(true)
    .build()
    {
        Ok(_) => {}
        Err(e) => {
            show_tray_error(app, &format!("打开检修助手失败: {}", e));
        }
    }
}

/// Run `openclawcn doctor --fix --non-interactive` from the tray menu.
/// Opens a minimal result window (local HTML, no Gateway dependency) since
/// the main WebView may be unavailable when Gateway is down.
fn run_doctor_from_tray(app: &tauri::AppHandle) {
    let handle = app.app_handle().clone();

    // Open or re-use the doctor result window
    if let Some(window) = handle.get_webview_window("doctor-result") {
        let _ = window.show();
        let _ = window.set_focus();
        // Reset to loading state
        let _ = window.eval(
            "document.getElementById('output').innerHTML=\
             '<span class=\"spin\"></span>正在运行 Doctor，请稍候...'"
        );
    } else {
        match WebviewWindowBuilder::new(
            &handle,
            "doctor-result",
            WebviewUrl::App("doctor-result.html".into()),
        )
        .title("Doctor 自检修复")
        .inner_size(680.0, 480.0)
        .resizable(true)
        .center()
        .visible(true)
        .build()
        {
            Ok(_) => {}
            Err(e) => {
                show_tray_error(&handle, &format!("打开 Doctor 窗口失败: {}", e));
                return;
            }
        }
    }

    // Run doctor in background thread to avoid blocking the tray event loop
    std::thread::spawn(move || {
        let result = repair::repair_actions::apply_fix(&handle, "run_doctor");

        // Escape the message for safe injection into JS
        let status = if result.success { "Doctor 完成" } else { "Doctor 失败" };
        let escaped_msg = result.message
            .replace('\\', "\\\\")
            .replace('\'', "\\'")
            .replace('\n', "\\n")
            .replace('\r', "");

        let js = format!(
            "document.getElementById('output').textContent=\
             '--- {} ---\\n\\n{}'",
            status, escaped_msg
        );

        if let Some(window) = handle.get_webview_window("doctor-result") {
            let _ = window.eval(&js);
        }

        // Refresh tray menu state in case doctor fixed the service
        update_tray_menu_state(&handle);
    });
}

pub fn setup_tray(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let start_item =
        MenuItem::with_id(app, "start_service", "▶ 启动服务", true, None::<&str>)?;
    let stop_item =
        MenuItem::with_id(app, "stop_service", "⏸ 停止服务", false, None::<&str>)?;
    let restart_item =
        MenuItem::with_id(app, "restart_service", "🔄 重启服务", false, None::<&str>)?;

    let menu = Menu::with_items(
        app,
        &[
            &MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?,
            &MenuItem::with_id(app, "hide", "隐藏到托盘", true, None::<&str>)?,
            &MenuItem::new(app, "───", false, None::<&str>)?,
            &start_item,
            &stop_item,
            &restart_item,
            &MenuItem::new(app, "───", false, None::<&str>)?,
            &MenuItem::with_id(app, "open_logs", "📁 查看日志", true, None::<&str>)?,
            &MenuItem::with_id(app, "repair_assistant", "🔧 检修助手", true, None::<&str>)?,
            &MenuItem::with_id(app, "run_doctor", "🩺 Doctor 自检修复", true, None::<&str>)?,
            &MenuItem::new(app, "───", false, None::<&str>)?,
            &MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?,
        ],
    )?;

    let tray_icon = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("ClawdbotCN")
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
                let handle = app.app_handle().clone();
                std::thread::spawn(move || {
                    match sidecar::start_sidecar(handle.clone()) {
                        Ok(()) => {
                            println!("[Tray] Service started");
                        }
                        Err(e) => {
                            show_tray_error(&handle, &format!("启动服务失败: {}", e));
                        }
                    }
                    update_tray_menu_state(&handle);
                });
            }
            "stop_service" => {
                let handle = app.app_handle().clone();
                std::thread::spawn(move || {
                    match sidecar::stop_sidecar() {
                        Ok(()) => {
                            println!("[Tray] Service stopped");
                        }
                        Err(e) => {
                            show_tray_error(&handle, &format!("停止服务失败: {}", e));
                        }
                    }
                    update_tray_menu_state(&handle);
                });
            }
            "restart_service" => {
                let handle = app.app_handle().clone();
                std::thread::spawn(move || {
                    match sidecar::restart_sidecar(handle.clone()) {
                        Ok(()) => {
                            println!("[Tray] Service restarted");
                        }
                        Err(e) => {
                            show_tray_error(&handle, &format!("重启服务失败: {}", e));
                        }
                    }
                    update_tray_menu_state(&handle);
                });
            }
            "open_logs" => {
                match sidecar::log_file_path() {
                    Ok(log_path) => {
                        if let Err(e) = platform::open_file_in_explorer(&log_path) {
                            show_tray_error(app, &format!("打开日志文件失败: {}", e));
                        }
                    }
                    Err(e) => {
                        show_tray_error(app, &format!("获取日志路径失败: {}", e));
                    }
                }
            }
            "repair_assistant" => {
                open_repair_assistant(app);
            }
            "run_doctor" => {
                run_doctor_from_tray(app);
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

    // Store TrayIcon + menu item handles in app state.
    // TrayIcon must live as long as the app — dropping it removes the tray icon.
    app.manage(TrayState {
        _icon: tray_icon,
        start_service: start_item,
        stop_service: stop_item,
        restart_service: restart_item,
    });

    Ok(())
}
