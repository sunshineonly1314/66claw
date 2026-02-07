# ClawdbotCN Gateway Silent Launcher (PowerShell)
# Calls start-gateway.bat silently
# Replaces StartGateway.vbs for Windows 11+ compatibility

$ErrorActionPreference = "SilentlyContinue"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Split-Path -Parent $ScriptDir

$startScript = Join-Path $InstallDir "start-gateway.bat"

if (Test-Path $startScript) {
    # Run start-gateway.bat silently
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c `"$startScript`""
    $psi.WorkingDirectory = $InstallDir
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $psi.CreateNoWindow = $true
    $psi.UseShellExecute = $false
    
    [System.Diagnostics.Process]::Start($psi) | Out-Null
}
