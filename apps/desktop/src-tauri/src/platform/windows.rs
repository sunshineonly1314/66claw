#![cfg(target_os = "windows")]

use std::path::{Path, PathBuf};
use std::process::Command;

/// Windows: `app_dir/node/node.exe`
pub fn resolve_node_path(app_dir: &Path) -> PathBuf {
    app_dir.join("node").join("node.exe")
}

/// Windows: log file next to the executable.
pub fn resolve_log_path(app_dir: &Path) -> PathBuf {
    app_dir.join("sidecar.log")
}

/// Windows: NODE_PATH points to the node directory.
pub fn configure_node_env(command: &mut Command, app_dir: &Path) {
    command.env("NODE_PATH", app_dir.join("node"));
}

/// Windows: hide the console window spawned by the sidecar.
pub fn configure_process_flags(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

/// Windows: open a directory in Explorer.
pub fn open_directory(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    Command::new("explorer")
        .arg(path)
        .spawn()?;
    Ok(())
}
