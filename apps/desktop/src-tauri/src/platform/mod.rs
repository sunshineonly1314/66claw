mod macos;
mod windows;

use std::path::{Path, PathBuf};
use std::process::Command;

/// Returns the path to the bundled Node.js binary.
pub fn resolve_node_path(app_dir: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        windows::resolve_node_path(app_dir)
    }
    #[cfg(target_os = "macos")]
    {
        macos::resolve_node_path(app_dir)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        // Linux fallback — same layout as macOS.
        app_dir.join("node").join("bin").join("node")
    }
}

/// Returns the path where sidecar logs should be written.
pub fn resolve_log_path(app_dir: &Path) -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        windows::resolve_log_path(app_dir)
    }
    #[cfg(target_os = "macos")]
    {
        macos::resolve_log_path(app_dir)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        app_dir.join("sidecar.log")
    }
}

/// Set NODE_PATH and any platform-specific environment variables.
pub fn configure_node_env(command: &mut Command, app_dir: &Path) {
    #[cfg(target_os = "windows")]
    {
        windows::configure_node_env(command, app_dir);
    }
    #[cfg(target_os = "macos")]
    {
        macos::configure_node_env(command, app_dir);
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        command.env("NODE_PATH", app_dir.join("node").join("lib").join("node_modules"));
    }
}

/// Apply platform-specific process creation flags.
pub fn configure_process_flags(command: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        windows::configure_process_flags(command);
    }
    #[cfg(target_os = "macos")]
    {
        macos::configure_process_flags(command);
    }
}

/// Open a directory in the system file explorer.
pub fn open_directory(path: &Path) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(target_os = "windows")]
    {
        windows::open_directory(path)
    }
    #[cfg(target_os = "macos")]
    {
        macos::open_directory(path)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        // Linux fallback
        Command::new("xdg-open")
            .arg(path)
            .spawn()?;
        Ok(())
    }
}
