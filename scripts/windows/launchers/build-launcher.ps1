# Build ClawdbotLauncher.exe from C# source
# Uses Windows built-in C# compiler (csc.exe)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$SourceFile = Join-Path $ScriptDir "ClawdbotLauncher.cs"
$OutputFile = Join-Path $ScriptDir "ClawdbotLauncher.exe"

Write-Host "Building ClawdbotLauncher.exe..." -ForegroundColor Cyan

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
    Write-Host "Paths checked:"
    $cscPaths | ForEach-Object { Write-Host "  - $_" }
    exit 1
}

Write-Host "  Using compiler: $csc"

# Compile
# /target:winexe - Windows application (no console window)
# /optimize - Optimize code
# /nologo - Suppress logo
$compileArgs = @(
    "/target:winexe",
    "/optimize",
    "/nologo",
    "/out:`"$OutputFile`"",
    "`"$SourceFile`""
)

Write-Host "  Compiling..."
$process = Start-Process -FilePath $csc -ArgumentList $compileArgs -Wait -PassThru -NoNewWindow

if ($process.ExitCode -eq 0 -and (Test-Path $OutputFile)) {
    $fileInfo = Get-Item $OutputFile
    Write-Host "  [OK] Built successfully: $OutputFile" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round($fileInfo.Length / 1KB, 1)) KB"
} else {
    Write-Host "  [FAILED] Compilation failed" -ForegroundColor Red
    exit 1
}
