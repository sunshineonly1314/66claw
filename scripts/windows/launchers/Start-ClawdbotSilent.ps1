# ClawdbotCN Silent Launcher (PowerShell)
# Launch clawdbot.bat without showing command window
# Replaces clawdbot-silent.vbs for Windows 11+ compatibility

param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$Arguments
)

$ErrorActionPreference = "SilentlyContinue"

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = Split-Path -Parent $ScriptDir

# Build argument string
$argString = ""
if ($Arguments) {
    $argString = $Arguments -join " "
}

# Run clawdbot.bat silently
$batPath = Join-Path $InstallDir "clawdbot.bat"

if (Test-Path $batPath) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c `"$batPath`" $argString"
    $psi.WorkingDirectory = $InstallDir
    $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $psi.CreateNoWindow = $true
    $psi.UseShellExecute = $false
    
    [System.Diagnostics.Process]::Start($psi) | Out-Null
}
