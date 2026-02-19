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
/// saves to localStorage, then cleans the URL -- same flow as `openclawcn dashboard`.
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

/// Inject a loading screen that displays while the gateway is starting up.
/// The loading screen auto-hides once the WebSocket connection to the gateway
/// succeeds (detected by polling the port).
fn inject_loading_screen(app: &tauri::App) {
    let port = sidecar::gateway_port();
    if let Some(window) = app.get_webview_window("main") {
        let js = format!(
            r#"(function() {{
                function showLoading() {{
                    // Don't inject if already exists
                    if (document.getElementById('clawdbot-loading-overlay')) return;

                    var overlay = document.createElement('div');
                    overlay.id = 'clawdbot-loading-overlay';
                    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0f0f1a;color:#e0e0e0;font-family:system-ui,-apple-system,sans-serif;transition:opacity 0.5s ease';

                    var spinner = document.createElement('div');
                    spinner.style.cssText = 'width:48px;height:48px;border:3px solid rgba(74,108,247,0.2);border-top-color:#4a6cf7;border-radius:50%;animation:clawdbot-spin 0.8s linear infinite;margin-bottom:24px';

                    var style = document.createElement('style');
                    style.textContent = '@keyframes clawdbot-spin {{ from {{ transform:rotate(0deg) }} to {{ transform:rotate(360deg) }} }}';
                    document.head.appendChild(style);

                    var title = document.createElement('h2');
                    title.style.cssText = 'margin:0 0 8px;font-size:18px;font-weight:600;color:#fff';
                    title.textContent = '\u6B63\u5728\u542F\u52A8 ClawdbotCN...';

                    var sub = document.createElement('p');
                    sub.style.cssText = 'margin:0;font-size:13px;color:#888';
                    sub.textContent = '\u540E\u53F0\u670D\u52A1\u6B63\u5728\u521D\u59CB\u5316\uFF0C\u8BF7\u7A0D\u5019';

                    var dots = document.createElement('span');
                    dots.id = 'clawdbot-loading-dots';
                    dots.textContent = '';
                    sub.appendChild(dots);

                    overlay.appendChild(spinner);
                    overlay.appendChild(title);
                    overlay.appendChild(sub);
                    document.body.appendChild(overlay);

                    // Animate dots
                    var dotCount = 0;
                    var dotTimer = setInterval(function() {{
                        dotCount = (dotCount + 1) % 4;
                        var d = document.getElementById('clawdbot-loading-dots');
                        if (d) d.textContent = '.'.repeat(dotCount);
                    }}, 500);

                    // Poll gateway until it responds, then fade out
                    var attempts = 0;
                    var maxAttempts = 120; // 60 seconds max wait
                    var pollTimer = setInterval(function() {{
                        attempts++;
                        var elapsed = attempts / 2; // each attempt = 500ms
                        // Progressive messages with antivirus guidance
                        if (elapsed >= 30 && elapsed < 45) {{
                            sub.textContent = '\u542F\u52A8\u65F6\u95F4\u8F83\u957F\uFF0C\u8BF7\u8010\u5FC3\u7B49\u5F85\u2026';
                            sub.style.color = '#fbbf24';
                        }} else if (elapsed >= 45) {{
                            sub.innerHTML = '\u2139\uFE0F \u5982\u957F\u65F6\u95F4\u65E0\u54CD\u5E94\uFF0C\u53EF\u80FD\u662F\u6740\u6BD2\u8F6F\u4EF6\u62E6\u622A\u4E86 node.exe<br><span style="font-size:11px;opacity:0.7">\u8BF7\u5C06\u5B89\u88C5\u76EE\u5F55\u6DFB\u52A0\u5230\u6740\u6BD2\u8F6F\u4EF6\u4FE1\u4EFB\u5217\u8868</span>';
                        }}
                        if (attempts > maxAttempts) {{
                            clearInterval(pollTimer);
                            clearInterval(dotTimer);
                            sub.innerHTML = '\u542F\u52A8\u8D85\u65F6\u3002\u5E38\u89C1\u539F\u56E0\uFF1A<br>\u2022 360/\u706B\u7ED2/Defender \u62E6\u622A\u4E86 node.exe<br>\u2022 \u7AEF\u53E3 18789 \u88AB\u5176\u4ED6\u7A0B\u5E8F\u5360\u7528';
                            sub.style.color = '#f87171';
                            return;
                        }}
                        fetch('http://127.0.0.1:{port}/api/health', {{ mode: 'no-cors' }})
                            .then(function() {{
                                clearInterval(pollTimer);
                                clearInterval(dotTimer);
                                var el = document.getElementById('clawdbot-loading-overlay');
                                if (el) {{
                                    el.style.opacity = '0';
                                    setTimeout(function() {{ el.remove(); }}, 500);
                                }}
                            }})
                            .catch(function() {{}});
                    }}, 500);
                }}

                if (document.readyState === 'loading') {{
                    document.addEventListener('DOMContentLoaded', showLoading);
                }} else {{
                    showLoading();
                }}
            }})()"#,
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

            // Show loading screen immediately while gateway starts up
            inject_loading_screen(app);

            match sidecar::start_sidecar(handle) {
                Ok(()) => {
                    inject_gateway_token(app);
                }
                Err(e) => {
                    eprintln!("[Setup] Sidecar failed: {}", e);
                    show_error_page(
                        app,
                        &format!(
                            "\u{540E}\u{53F0}\u{670D}\u{52A1}\u{542F}\u{52A8}\u{5931}\u{8D25}\u{FF0C}\u{8BF7}\u{5C1D}\u{8BD5}\u{91CD}\u{65B0}\u{6253}\u{5F00}\u{5E94}\u{7528}\u{3002}\n\n\u{9519}\u{8BEF}\u{8BE6}\u{60C5}\u{FF1A}{}",
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
