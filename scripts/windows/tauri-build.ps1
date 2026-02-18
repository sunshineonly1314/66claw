# Build Tauri application with proper environment setup

$ErrorActionPreference = "Stop"

# Add Rust to PATH
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"

# Setup MSVC environment
$vcvarsPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
$tempBat = [System.IO.Path]::GetTempFileName() + ".bat"
$tempOut = [System.IO.Path]::GetTempFileName()

# Create a batch file that sets up MSVC env and outputs the environment
@"
@echo off
call "$vcvarsPath"
set > "$tempOut"
"@ | Out-File -FilePath $tempBat -Encoding ASCII

# Run the batch file
cmd /c $tempBat

# Load the environment variables
Get-Content $tempOut | ForEach-Object {
    if ($_ -match '^([^=]+)=(.*)$') {
        $name = $matches[1]
        $value = $matches[2]
        Set-Item -Path "env:$name" -Value $value
    }
}

# Clean up temp files
Remove-Item $tempBat, $tempOut

Write-Host "========================================"
Write-Host "Building ClawdbotCN with Tauri CLI v2"
Write-Host "========================================"
Write-Host ""
Write-Host "Frontend: ../../../dist/control-ui"
Write-Host "This will properly embed frontend resources."
Write-Host ""

# Navigate to tauri-src directory
Set-Location "tauri-src"

# Run Tauri build
pnpm tauri build --verbose

Write-Host ""
Write-Host "========================================"
Write-Host "Build Complete"
Write-Host "========================================"
