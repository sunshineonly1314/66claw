// Prevents additional console window on Windows in release builds.
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod platform;
mod sidecar;
mod tray;

use tauri::Manager;

/// Inject the gateway auth token and URL into the WebView so the UI can
/// connect to the local gateway without the user needing to configure anything.
///
/// Uses DOMContentLoaded to ensure the page is ready before setting the hash.
/// The UI's `applySettingsFromUrl` extracts `#token=<value>&gatewayUrl=<value>`,
/// saves to localStorage, then cleans the URL — same flow as `openclawcn dashboard`.
fn inject_gateway_token(app: &tauri::App) {
    let token = sidecar::gateway_token();
    let port = sidecar::gateway_port();
    if let Some(window) = app.get_webview_window("main") {
        let js = format!(
            r#"(function() {{
                function inject() {{
                    if (!window.location.hash.includes('token=')) {{
                        window.location.hash = 'token={token}&gatewayUrl=ws%3A%2F%2F127.0.0.1%3A{port}';
                    }}
                }}
                if (document.readyState === 'loading') {{
                    document.addEventListener('DOMContentLoaded', inject);
                }} else {{
                    inject();
                }}
            }})()"#,
            token = token,
            port = port,
        );
        let _ = window.eval(&js);
    }
}

/// Show a user-friendly error page in the WebView when the sidecar fails.
///
/// Uses `textContent` to safely render the error message without innerHTML
/// injection risks. The error page is self-contained with inline styles.
fn show_error_page(app: &tauri::App, error_msg: &str) {
    if let Some(window) = app.get_webview_window("main") {
        // Escape for embedding inside a JS single-quoted string.
        let escaped = error_msg
            .replace('\\', "\\\\")
            .replace('\'', "\\'")
            .replace('\n', "\\n")
            .replace('\r', "\\r");
        let js = format!(
            r#"(function() {{
                function show() {{
                    var c = document.createElement('div');
                    c.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:system-ui,sans-serif;background:#1a1a2e;color:#e0e0e0;text-align:center;padding:40px';
                    var icon = document.createElement('div');
                    icon.style.cssText = 'font-size:48px;margin-bottom:20px';
                    icon.textContent = '\u26A0\uFE0F';
                    var h = document.createElement('h1');
                    h.style.cssText = 'margin:0 0 12px;font-size:22px;color:#fff';
                    h.textContent = '\u670D\u52A1\u542F\u52A8\u5931\u8D25';
                    var p = document.createElement('p');
                    p.style.cssText = 'margin:0 0 24px;font-size:14px;color:#aaa;max-width:480px;line-height:1.6;white-space:pre-wrap';
                    p.textContent = '{escaped}';
                    var btn = document.createElement('button');
                    btn.style.cssText = 'padding:10px 28px;border:none;border-radius:8px;background:#4a6cf7;color:#fff;font-size:14px;cursor:pointer';
                    btn.textContent = '\u91CD\u65B0\u52A0\u8F7D';
                    btn.onclick = function() {{ location.reload(); }};
                    c.appendChild(icon);
                    c.appendChild(h);
                    c.appendChild(p);
                    c.appendChild(btn);
                    document.body.innerHTML = '';
                    document.body.appendChild(c);
                }}
                if (document.readyState === 'loading') {{
                    document.addEventListener('DOMContentLoaded', show);
                }} else {{
                    show();
                }}
            }})()"#,
            escaped = escaped,
        );
        let _ = window.eval(&js);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            #[cfg(desktop)]
            tray::setup_tray(app)?;

            let handle = app.handle().clone();
            match sidecar::start_sidecar(handle) {
                Ok(()) => {
                    inject_gateway_token(app);
                }
                Err(e) => {
                    eprintln!("[Setup] Sidecar failed: {}", e);
                    show_error_page(
                        app,
                        &format!(
                            "后台服务启动失败，请尝试重新打开应用。\n\n错误详情：{}",
                            e
                        ),
                    );
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_gateway_info,
            commands::start_service,
            commands::stop_service,
            commands::restart_service,
            commands::get_service_status,
            commands::open_logs_directory,
        ])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                sidecar::cleanup_on_exit();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
