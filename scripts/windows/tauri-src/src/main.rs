// Prevents additional console window on Windows in release builds
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod sidecar;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Start Node.js sidecar
            let handle = app.handle().clone();
            sidecar::start_sidecar(handle)?;

            // Setup tray icon
            #[cfg(desktop)]
            {
                use tauri::tray::{TrayIconBuilder, MouseButton, MouseButtonState};
                use tauri::menu::{Menu, MenuItem};

                let menu = Menu::with_items(
                    app,
                    &[
                        &MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?,
                        &MenuItem::with_id(app, "hide", "隐藏到托盘", true, None::<&str>)?,
                        &MenuItem::new(app, "分隔符", false, None::<&str>)?,
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
                        "quit" => {
                            std::process::exit(0);
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
                            if let Some(app) = tray.app_handle().get_webview_window("main") {
                                let _ = app.show();
                                let _ = app.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_config,
            commands::update_config,
            commands::get_channels,
            commands::send_message,
            commands::get_messages,
            commands::get_chat_history,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
