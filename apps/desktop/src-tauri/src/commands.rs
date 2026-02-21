use serde::Serialize;
use tauri::AppHandle;

use crate::{platform, sidecar, tray};

#[derive(Debug, Serialize)]
pub struct GatewayInfo {
    pub port: u16,
    pub token: String,
}

#[derive(Debug, Serialize)]
pub struct ServiceStatus {
    pub running: bool,
    pub port: u16,
}

/// Returns the gateway connection info so the WebView can connect.
/// This is the primary IPC command — the UI fetches the token from here
/// instead of relying solely on URL hash injection.
#[tauri::command]
pub async fn get_gateway_info() -> Result<GatewayInfo, String> {
    Ok(GatewayInfo {
        port: sidecar::gateway_port(),
        token: sidecar::gateway_token(),
    })
}

/// Start the gateway sidecar service.
#[tauri::command]
pub async fn start_service(app: AppHandle) -> Result<String, String> {
    if sidecar::is_sidecar_running() {
        return Err("服务已在运行中".to_string());
    }

    sidecar::start_sidecar(app.clone())
        .map_err(|e| format!("启动服务失败: {}", e))?;

    tray::update_tray_menu_state(&app);
    Ok("服务启动成功".to_string())
}

/// Stop the gateway sidecar service.
#[tauri::command]
pub async fn stop_service(app: AppHandle) -> Result<String, String> {
    if !sidecar::is_sidecar_running() {
        return Err("服务未在运行".to_string());
    }

    sidecar::stop_sidecar()
        .map_err(|e| format!("停止服务失败: {}", e))?;

    tray::update_tray_menu_state(&app);
    Ok("服务已停止".to_string())
}

/// Restart the gateway sidecar service.
#[tauri::command]
pub async fn restart_service(app: AppHandle) -> Result<String, String> {
    sidecar::restart_sidecar(app.clone())
        .map_err(|e| format!("重启服务失败: {}", e))?;

    tray::update_tray_menu_state(&app);
    Ok("服务重启成功".to_string())
}

/// Get the service running status.
#[tauri::command]
pub async fn get_service_status() -> Result<ServiceStatus, String> {
    Ok(ServiceStatus {
        running: sidecar::is_sidecar_running(),
        port: sidecar::gateway_port(),
    })
}

/// Check if gateway needs first-run setup.
/// Uses the gateway's own `needsSetup` field from /api/health, which calls
/// shouldShowSetupWizard() — the single source of truth for setup state.
#[tauri::command]
pub async fn check_needs_setup() -> Result<bool, String> {
    let port = sidecar::gateway_port();
    let url = format!("http://127.0.0.1:{}/api/health", port);

    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("health check failed: {}", e))?;

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("parse health failed: {}", e))?;

    // Use the gateway's authoritative needsSetup field
    if let Some(needs) = body.get("needsSetup").and_then(|v| v.as_bool()) {
        return Ok(needs);
    }

    // Fallback: if needsSetup field is missing (older gateway), check providers
    if let Some(providers) = body.get("providers").and_then(|p| p.as_object()) {
        for (_name, provider) in providers {
            if provider.get("status").and_then(|s| s.as_str()) == Some("ok") {
                return Ok(false);
            }
        }
    }

    Ok(true)
}

/// Open the sidecar log file in the system file explorer (with file selected).
#[tauri::command]
pub async fn open_logs_directory() -> Result<String, String> {
    let log_path = sidecar::log_file_path()
        .map_err(|e| format!("获取日志路径失败: {}", e))?;

    platform::open_file_in_explorer(&log_path)
        .map_err(|e| format!("打开日志文件失败: {}", e))?;

    Ok(format!("已打开日志: {}", log_path.display()))
}
