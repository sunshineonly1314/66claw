use tauri::{AppHandle, Manager};
use std::process::{Command, Child, Stdio};
use std::sync::Mutex;
use std::path::PathBuf;
use std::fs::OpenOptions;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

static SIDECAR_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

pub fn start_sidecar(app: AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Get the app executable directory (where ClawdbotCN.exe is installed)
    let exe_path = std::env::current_exe()?;
    let app_dir = exe_path.parent().ok_or("Failed to get app directory")?;

    println!("App directory: {:?}", app_dir);

    // Paths relative to installation directory
    let node_path = app_dir.join("node").join("node.exe");
    let backend_path = app_dir.join("dist").join("entry.js");
    let extensions_dir = app_dir.join("extensions");
    let skills_dir = app_dir.join("skills");

    // Verify paths exist
    if !node_path.exists() {
        println!("WARNING: node.exe not found at {:?}", node_path);
        println!("  Sidecar will not start. This is normal in dev mode.");
        return Ok(());
    }

    if !backend_path.exists() {
        println!("WARNING: backend entry.js not found at {:?}", backend_path);
        return Ok(());
    }

    println!("Starting Node.js sidecar...");
    println!("  Node: {:?}", node_path);
    println!("  Backend: {:?}", backend_path);

    // Create log file for debugging
    let log_path = app_dir.join("sidecar.log");
    let log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .ok();

    let mut command = Command::new(&node_path);
    command
        .arg(&backend_path)
        .arg("gateway")
        .arg("run")
        .arg("--port")
        .arg("18789")
        .arg("--allow-unconfigured")  // Allow running without config file
        .env("CLAWDBOT_GATEWAY_TOKEN", "clawdbot-local-dev")  // Token via env var
        .env("CLAWDBOT_BUNDLED_PLUGINS_DIR", &extensions_dir)
        .env("CLAWDBOT_BUNDLED_SKILLS_DIR", &skills_dir)
        .env("NODE_PATH", app_dir.join("node"))
        .env("CLAWDBOT_NO_RESPAWN", "1")  // Prevent entry.js from respawning
        .env("NODE_OPTIONS", "--disable-warning=ExperimentalWarning")
        .current_dir(app_dir);  // Set working directory to app directory

    // Redirect output to log file if available, otherwise to null
    if let Some(ref file) = log_file {
        command
            .stdout(file.try_clone().unwrap())
            .stderr(file.try_clone().unwrap());
    } else {
        command
            .stdout(Stdio::null())
            .stderr(Stdio::null());
    }

    // Hide console window on Windows
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let child = command.spawn()
        .map_err(|e| format!("Failed to spawn Node.js sidecar: {}. Node: {:?}, Backend: {:?}", e, node_path, backend_path))?;

    let mut process = SIDECAR_PROCESS.lock().unwrap();
    *process = Some(child);

    println!("Node.js sidecar started on port 18789");
    Ok(())
}

pub fn stop_sidecar() -> Result<(), Box<dyn std::error::Error>> {
    let mut process = SIDECAR_PROCESS.lock().unwrap();
    if let Some(mut child) = process.take() {
        child.kill()?;
        println!("Node.js sidecar stopped");
    }
    Ok(())
}
