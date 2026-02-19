use std::fs::OpenOptions;
use std::net::TcpListener;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use tauri::AppHandle;

use crate::platform;

static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

/// Runtime-generated token for Tauri <-> Gateway auth.
/// Generated once per app launch; passed to both sidecar and WebView.
static GATEWAY_TOKEN: Mutex<Option<String>> = Mutex::new(None);

const GATEWAY_PORT: u16 = 18789;

fn is_dev_mode() -> bool {
    std::env::var("TAURI_DEV").is_ok() || cfg!(debug_assertions)
}

/// Generate a 48-char hex token for local Tauri <-> Gateway auth.
///
/// NOTE: This is NOT a cryptographically secure random generator (CSPRNG).
/// It uses `DefaultHasher` (SipHash) seeded with the current time and PID.
/// This is sufficient for localhost-only auth where the attacker would need
/// local access to the machine. If the gateway ever accepts remote connections,
/// replace this with `getrandom` or `rand::OsRng`.
fn generate_token() -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use std::time::SystemTime;

    let mut hasher = DefaultHasher::new();
    SystemTime::now().hash(&mut hasher);
    std::process::id().hash(&mut hasher);
    let h1 = hasher.finish();

    let mut hasher2 = DefaultHasher::new();
    h1.hash(&mut hasher2);
    (h1 ^ 0xDEAD_BEEF_CAFE_BABE).hash(&mut hasher2);
    let h2 = hasher2.finish();

    let mut hasher3 = DefaultHasher::new();
    h2.hash(&mut hasher3);
    (h2 ^ 0x1234_5678_9ABC_DEF0).hash(&mut hasher3);
    let h3 = hasher3.finish();

    format!("{:016x}{:016x}{:016x}", h1, h2, h3)
}

/// Try to kill any process occupying the gateway port.
/// On Windows, uses `netstat` + `taskkill`. On Unix, uses `lsof` + `kill`.
/// Returns true if a process was found and killed.
fn try_kill_port_occupant() -> bool {
    #[cfg(target_os = "windows")]
    {
        // Use netstat to find PID occupying the port
        let output = Command::new("cmd")
            .args(["/C", &format!("netstat -ano | findstr :{} | findstr LISTENING", GATEWAY_PORT)])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // Parse PID from netstat output: "  TCP  127.0.0.1:18789  ...  LISTENING  12345"
            for line in stdout.lines() {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if let Some(pid_str) = parts.last() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        if pid == 0 || pid == std::process::id() {
                            continue;
                        }
                        println!("[Sidecar] Found process {} occupying port {}, killing...", pid, GATEWAY_PORT);
                        let kill_result = Command::new("taskkill")
                            .args(["/F", "/PID", &pid.to_string()])
                            .creation_flags(0x08000000)
                            .output();
                        if let Ok(r) = kill_result {
                            if r.status.success() {
                                println!("[Sidecar] Killed process {}", pid);
                                // Wait for port to be released
                                std::thread::sleep(std::time::Duration::from_millis(1000));
                                return true;
                            }
                        }
                    }
                }
            }
        }
        false
    }
    #[cfg(not(target_os = "windows"))]
    {
        // Use lsof to find PID
        let output = Command::new("lsof")
            .args(["-ti", &format!(":{}", GATEWAY_PORT)])
            .output();

        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            for pid_str in stdout.lines() {
                if let Ok(pid) = pid_str.trim().parse::<u32>() {
                    if pid == 0 || pid == std::process::id() {
                        continue;
                    }
                    println!("[Sidecar] Found process {} occupying port {}, killing...", pid, GATEWAY_PORT);
                    let _ = Command::new("kill").args(["-9", &pid.to_string()]).output();
                    std::thread::sleep(std::time::Duration::from_millis(1000));
                    return true;
                }
            }
        }
        false
    }
}

/// Check if the gateway port is available. If occupied, try to kill the occupant.
fn ensure_port_available() -> Result<(), String> {
    match TcpListener::bind(("127.0.0.1", GATEWAY_PORT)) {
        Ok(_listener) => Ok(()), // Port is free; listener drops immediately
        Err(_) => {
            println!(
                "[Sidecar] Port {} is occupied, attempting to kill occupying process...",
                GATEWAY_PORT
            );

            if try_kill_port_occupant() {
                // Verify port is now free
                match TcpListener::bind(("127.0.0.1", GATEWAY_PORT)) {
                    Ok(_) => {
                        println!("[Sidecar] Port {} is now available", GATEWAY_PORT);
                        Ok(())
                    }
                    Err(_) => Err(format!(
                        "端口 {} 仍被占用，无法自动释放。\n\n\
                         请手动关闭占用该端口的程序后重试。",
                        GATEWAY_PORT
                    )),
                }
            } else {
                Err(format!(
                    "端口 {} 已被其他程序占用，且无法自动释放。\n\n\
                     可能原因：\n\
                     \u{2022} 已有一个 ClawdbotCN 实例在运行\n\
                     \u{2022} 其他程序正在使用该端口\n\n\
                     请关闭占用该端口的程序后重试。",
                    GATEWAY_PORT
                ))
            }
        }
    }
}

fn resolve_app_dir() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let exe_path = std::env::current_exe()?;
    let exe_dir = exe_path
        .parent()
        .ok_or("Failed to get app directory")?;

    // On macOS, the exe is at <app>/Contents/MacOS/<binary>.
    // Tauri bundles "resources/**/*" into <app>/Contents/Resources/resources/.
    // On Windows, resources are next to the exe.
    #[cfg(target_os = "macos")]
    {
        let resources_dir = exe_dir
            .parent() // Contents/
            .map(|p| p.join("Resources").join("resources"))
            .unwrap_or_else(|| exe_dir.to_path_buf());
        Ok(resources_dir)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(exe_dir.to_path_buf())
    }
}

fn open_log_file(log_path: &Path) -> Option<std::fs::File> {
    if let Some(parent) = log_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .ok()
}

pub fn start_sidecar(_app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = resolve_app_dir()?;
    println!("[Sidecar] App directory: {:?}", app_dir);

    let node_path = platform::resolve_node_path(&app_dir);
    let backend_path = app_dir.join("dist").join("entry.js");
    let extensions_dir = app_dir.join("extensions");
    let skills_dir = app_dir.join("skills");

    // In dev mode, missing resources are expected — skip silently.
    // In release mode, missing node binary or backend entry is a hard error.
    if !node_path.exists() {
        if is_dev_mode() {
            println!(
                "[Sidecar] WARNING: node binary not found at {:?}. \
                 Sidecar will not start. This is normal in dev mode.",
                node_path
            );
            return Ok(());
        }
        return Err(format!(
            "Node.js \u{8FD0}\u{884C}\u{65F6}\u{672A}\u{627E}\u{5230}\u{FF1A}{}\n\n\
             \u{5B89}\u{88C5}\u{53EF}\u{80FD}\u{4E0D}\u{5B8C}\u{6574}\u{FF0C}\u{8BF7}\u{91CD}\u{65B0}\u{5B89}\u{88C5} ClawdbotCN\u{3002}",
            node_path.display()
        ).into());
    }

    if !backend_path.exists() {
        if is_dev_mode() {
            println!(
                "[Sidecar] WARNING: backend entry.js not found at {:?}.",
                backend_path
            );
            return Ok(());
        }
        return Err(format!(
            "\u{540E}\u{7AEF}\u{5165}\u{53E3}\u{6587}\u{4EF6}\u{672A}\u{627E}\u{5230}\u{FF1A}{}\n\n\
             \u{5B89}\u{88C5}\u{53EF}\u{80FD}\u{4E0D}\u{5B8C}\u{6574}\u{FF0C}\u{8BF7}\u{91CD}\u{65B0}\u{5B89}\u{88C5} ClawdbotCN\u{3002}",
            backend_path.display()
        ).into());
    }

    // Check port availability; auto-kill stale gateway if port is occupied.
    ensure_port_available().map_err(|msg| -> Box<dyn std::error::Error> { msg.into() })?;

    // Generate a random token for this session.
    let token = generate_token();
    {
        let mut stored = GATEWAY_TOKEN.lock().unwrap();
        *stored = Some(token.clone());
    }

    println!("[Sidecar] Starting Node.js sidecar...");
    println!("  Node: {:?}", node_path);
    println!("  Backend: {:?}", backend_path);
    println!("  Port: {}", GATEWAY_PORT);
    println!("  Dev mode: {}", is_dev_mode());

    // Log file
    let log_path = platform::resolve_log_path(&app_dir);
    let log_file = open_log_file(&log_path);

    let mut command = Command::new(&node_path);
    command
        .arg(&backend_path)
        .arg("gateway")
        .arg("run")
        .arg("--port")
        .arg(GATEWAY_PORT.to_string())
        .arg("--allow-unconfigured")
        .env("OPENCLAWCN_GATEWAY_TOKEN", &token)
        .env("OPENCLAWCN_BUNDLED_PLUGINS_DIR", &extensions_dir)
        .env("OPENCLAWCN_BUNDLED_SKILLS_DIR", &skills_dir)
        .env("OPENCLAWCN_DESKTOP_MODE", "1")
        .env("OPENCLAWCN_NO_RESPAWN", "1")
        .env("NODE_OPTIONS", "--disable-warning=ExperimentalWarning")
        .current_dir(&app_dir);

    // Platform-specific: set NODE_PATH
    platform::configure_node_env(&mut command, &app_dir);

    // Redirect output to log file or null
    if let Some(ref file) = log_file {
        if let (Ok(stdout), Ok(stderr)) = (file.try_clone(), file.try_clone()) {
            command.stdout(stdout).stderr(stderr);
        }
    } else {
        command.stdout(Stdio::null()).stderr(Stdio::null());
    }

    // Platform-specific process flags (e.g. hide console on Windows)
    platform::configure_process_flags(&mut command);

    let child = command.spawn().map_err(|e| -> Box<dyn std::error::Error> {
        format!(
            "\u{65E0}\u{6CD5}\u{542F}\u{52A8}\u{540E}\u{53F0}\u{670D}\u{52A1}\u{FF1A}{}\n\n\u{8BF7}\u{68C0}\u{67E5}\u{5B89}\u{88C5}\u{662F}\u{5426}\u{5B8C}\u{6574}\u{3002}",
            e
        )
        .into()
    })?;

    let mut process = SIDECAR_PROCESS.lock().unwrap();
    *process = Some(child);

    println!("[Sidecar] Node.js sidecar started on port {}", GATEWAY_PORT);
    Ok(())
}

pub fn stop_sidecar() -> Result<(), Box<dyn std::error::Error>> {
    let mut process = SIDECAR_PROCESS.lock().unwrap();
    if let Some(mut child) = process.take() {
        child.kill()?;
        // Reap the child process to avoid zombie/handle leak.
        let _ = child.wait();
        println!("[Sidecar] Node.js sidecar stopped");
    }
    Ok(())
}

pub fn cleanup_on_exit() {
    if let Err(e) = stop_sidecar() {
        eprintln!("[Sidecar] Error stopping sidecar: {}", e);
    }
}

/// Returns true if the sidecar is currently running.
pub fn is_sidecar_running() -> bool {
    let process = SIDECAR_PROCESS.lock().unwrap();
    process.is_some()
}

/// Restart the sidecar process.
pub fn restart_sidecar(app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    println!("[Sidecar] Restarting sidecar...");
    stop_sidecar()?;
    // Small delay to ensure the port is released
    std::thread::sleep(std::time::Duration::from_millis(500));
    start_sidecar(app)?;
    Ok(())
}

/// Returns the gateway token so the WebView URL can include `#token=...`.
/// In production, the token is generated at startup. In dev mode (sidecar not
/// started), attempts to read the token from the gateway config file so the
/// WebView can connect to a separately-started gateway instance.
pub fn gateway_token() -> String {
    let stored = GATEWAY_TOKEN.lock().unwrap().clone();
    if let Some(token) = stored {
        return token;
    }

    // Dev mode fallback: read token from gateway config file.
    if let Some(token) = read_config_token() {
        return token;
    }

    "openclawcn-desktop-local".to_string()
}

/// Try to read gateway.auth.token from the default config file.
fn read_config_token() -> Option<String> {
    let home = dirs::home_dir()?;
    let config_path = home.join(".openclawcn").join("openclawcn.json");
    let contents = std::fs::read_to_string(&config_path).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&contents).ok()?;
    parsed
        .get("gateway")?
        .get("auth")?
        .get("token")?
        .as_str()
        .map(|s| s.to_string())
}

/// Returns the gateway port number.
/// In dev mode, reads `GATEWAY_PORT` env var so Tauri connects to the
/// externally-started gateway (e.g. on port 19001) instead of the
/// production default (18789).
pub fn gateway_port() -> u16 {
    if is_dev_mode() {
        if let Ok(val) = std::env::var("GATEWAY_PORT") {
            if let Ok(port) = val.parse::<u16>() {
                return port;
            }
        }
    }
    GATEWAY_PORT
}

/// Returns the path to the logs directory.
pub fn logs_directory() -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_dir = resolve_app_dir()?;
    let logs_dir = app_dir.join("logs");

    // Create logs directory if it doesn't exist
    if !logs_dir.exists() {
        std::fs::create_dir_all(&logs_dir)?;
    }

    Ok(logs_dir)
}
