$ErrorActionPreference = "Stop"
$fnmDir = Join-Path $env:USERPROFILE ".fnm"
$env:PATH = "$fnmDir;$env:PATH"

Write-Host "Installing Node.js 22.16.0 via fnm..."
& "$fnmDir\fnm.exe" install 22.16.0
& "$fnmDir\fnm.exe" default 22.16.0
& "$fnmDir\fnm.exe" use 22.16.0

# Get the fnm node path
$fnmEnv = & "$fnmDir\fnm.exe" env --shell power-shell 2>&1
Write-Host "fnm env output:"
Write-Host $fnmEnv

# List installed versions
& "$fnmDir\fnm.exe" list
