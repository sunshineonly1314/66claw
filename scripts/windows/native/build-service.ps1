# Build ClawdbotService.exe - Native .NET Windows Service
# Uses Windows built-in C# compiler (csc.exe)
# No external dependencies required!

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceFile = Join-Path $ScriptDir "ClawdbotService.cs"
$OutputFile = Join-Path $ScriptDir "ClawdbotService.exe"

Write-Host "Building ClawdbotService.exe..." -ForegroundColor Cyan

# FORCE delete old exe to ensure fresh compile
if (Test-Path $OutputFile) {
    Remove-Item $OutputFile -Force
    Write-Host "  Removed old exe for fresh compile"
}

# Find csc.exe (Windows built-in C# compiler)
$cscPaths = @(
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe",
    "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

$csc = $null
foreach ($path in $cscPaths) {
    if (Test-Path $path) {
        $csc = $path
        break
    }
}

if (-not $csc) {
    Write-Host "ERROR: C# compiler (csc.exe) not found!" -ForegroundColor Red
    exit 1
}

Write-Host "  Using compiler: $csc"

# Compile
# /target:winexe - Windows application (no console window)
# /optimize - Optimize code
# /r: - Reference assemblies
$compileArgs = @(
    "/target:winexe",
    "/optimize",
    "/nologo",
    "/r:System.Windows.Forms.dll",
    "/r:System.Drawing.dll",
    "/out:`"$OutputFile`"",
    "`"$SourceFile`""
)

Write-Host "  Compiling..."

# Run compiler
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $csc
$psi.Arguments = $compileArgs -join " "
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$process = [System.Diagnostics.Process]::Start($psi)
$stdout = $process.StandardOutput.ReadToEnd()
$stderr = $process.StandardError.ReadToEnd()
$process.WaitForExit()

if ($stdout) { Write-Host $stdout }
if ($stderr) { Write-Host $stderr -ForegroundColor Yellow }

if ($process.ExitCode -eq 0 -and (Test-Path $OutputFile)) {
    $fileInfo = Get-Item $OutputFile
    Write-Host "  [OK] Built successfully: $OutputFile" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round($fileInfo.Length / 1KB, 1)) KB"
} else {
    Write-Host "  [FAILED] Compilation failed (exit code: $($process.ExitCode))" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Features:" -ForegroundColor Cyan
Write-Host "  - System tray icon with context menu"
Write-Host "  - Gateway process management (completely hidden)"
Write-Host "  - Health check every 5 seconds"
Write-Host "  - Auto-restart (Watchdog) every 15 seconds"
Write-Host "  - Single exe, no dependencies"
Write-Host ""
Write-Host "Usage:" -ForegroundColor Cyan
Write-Host "  ClawdbotService.exe          # Start tray + gateway"
Write-Host "  ClawdbotService.exe open     # Start + open browser"
Write-Host "  ClawdbotService.exe setup    # Start + open setup wizard"
