# Clawdbot Windows Portable Version Creator

# 设置 UTF-8 编码，避免中文乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

param(
    [string]$OutputDir = "..\..\clawdbot-portable"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Join-Path $ScriptDir "../.."

Write-Host ""
Write-Host "================================================"
Write-Host " Clawdbot Windows Portable Creator"
Write-Host "================================================"
Write-Host ""

$OutputPath = if ([System.IO.Path]::IsPathRooted($OutputDir)) {
    $OutputDir
} else {
    Join-Path $ScriptDir $OutputDir
}

Write-Host "Output directory: $OutputPath"

if (Test-Path $OutputPath) {
    Write-Host "Cleaning old output directory..."
    Remove-Item -Path $OutputPath -Recurse -Force
}
New-Item -ItemType Directory -Path $OutputPath | Out-Null

Write-Host "Copying build output..."
Copy-Item -Path "$RootDir\dist" -Destination "$OutputPath\dist" -Recurse

Write-Host "Copying package.json..."
Copy-Item -Path "$RootDir\package.json" -Destination "$OutputPath\"

Write-Host "Creating start.bat..."
"@echo off`r`necho Starting Clawdbot...`r`nnode dist\entry.js gateway run --port 18789`r`npause" | Out-File -FilePath "$OutputPath\start.bat" -Encoding ASCII

Write-Host "Creating setup.bat..."
"@echo off`r`necho Starting Clawdbot Setup...`r`nstart `"`" node dist\entry.js gateway run --port 18789`r`ntimeout /t 3 /nobreak >nul`r`nstart `"`" http://localhost:18789/setup`r`necho Browser opened. Press any key to close.`r`npause" | Out-File -FilePath "$OutputPath\setup.bat" -Encoding ASCII

Write-Host "Creating README.md..."
"# Clawdbot Portable`n`n## Quick Start`n`n1. Make sure Node.js 22+ is installed`n2. Run: npm install --omit=dev`n3. Run: setup.bat`n`n## URLs`n`n- Setup: http://localhost:18789/setup`n- Console: http://localhost:18789/" | Out-File -FilePath "$OutputPath\README.md" -Encoding UTF8

Write-Host ""
Write-Host "================================================"
Write-Host " Portable version created!"
Write-Host "================================================"
Write-Host ""
Write-Host "Location: $OutputPath"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. cd $OutputPath"
Write-Host "  2. npm install --omit=dev"
Write-Host "  3. .\setup.bat"
Write-Host ""
