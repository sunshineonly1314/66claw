# ClawdbotCN Tray Launcher (PowerShell)
# Launch tray app silently
# Replaces StartTray.vbs for Windows 11+ compatibility

$ErrorActionPreference = "SilentlyContinue"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Split-Path -Parent $ScriptDir

$trayScript = Join-Path $InstallDir "ClawdbotTray.ps1"

if (Test-Path $trayScript) {
    # Launch PowerShell tray app silently
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "powershell.exe"
    $psi.Arguments = "-ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -File `"$trayScript`""
    $psi.WorkingDirectory = $InstallDir
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $psi.CreateNoWindow = $true
    $psi.UseShellExecute = $false
    
    [System.Diagnostics.Process]::Start($psi) | Out-Null
}
