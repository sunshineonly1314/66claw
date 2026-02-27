$ErrorActionPreference = 'Continue'
$target = "SunBin@192.168.0.102"

Write-Host "=== Remote Environment Check on KEVINSUN ==="

# Use a temp PS1 file to avoid escaping issues
$tempScript = [System.IO.Path]::GetTempFileName() + ".ps1"
@'
Write-Host "=== Machine ==="
Write-Host "  Hostname: $env:COMPUTERNAME"
Write-Host "  User: $env:USERNAME"

Write-Host ""
Write-Host "=== Node ==="
try { Write-Host ("  " + (& node --version 2>&1)) } catch { Write-Host "  NOT FOUND" }

Write-Host ""
Write-Host "=== Workspace ==="
$ws = "D:\cicd-workspace\openclawcn"
if (Test-Path $ws) {
    Write-Host "  [OK] $ws exists"
    $scripts = Join-Path $ws "scripts\windows\post-build-validation.ps1"
    if (Test-Path $scripts) { Write-Host "  [OK] post-build-validation.ps1" }
    else { Write-Host "  [MISSING] post-build-validation.ps1" }
} else {
    Write-Host "  [MISSING] $ws"
}

Write-Host ""
Write-Host "=== Installers ==="
$exes = Get-ChildItem "E:\clawdbuild\ClawdbotCN-Setup-*.exe" -ErrorAction SilentlyContinue
if ($exes) {
    foreach ($e in $exes) {
        Write-Host ("  " + $e.Name + " (" + [math]::Round($e.Length/1MB,1) + " MB, " + $e.LastWriteTime + ")")
    }
} else {
    Write-Host "  (none found)"
}

Write-Host ""
Write-Host "=== Test Install Dir ==="
if (Test-Path "E:\clawdbuild\test\ClawdbotCN\dist\entry.js") {
    Write-Host "  Existing test install found"
} else {
    Write-Host "  No test install"
}

Write-Host ""
Write-Host "=== Port 18789 ==="
$c = Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue
if ($c) {
    Write-Host ("  IN USE by PID: " + ($c.OwningProcess -join ","))
} else {
    Write-Host "  Free"
}

Write-Host ""
Write-Host "=== Old Clawdbot Config ==="
$oldDir = "$env:USERPROFILE\.clawdbot"
if (Test-Path $oldDir) { Write-Host "  [EXISTS] $oldDir (will trigger installer dialog!)" }
else { Write-Host "  [NOT EXISTS] $oldDir (OK, no dialog)" }
'@ | Set-Content -Path $tempScript -Encoding UTF8

# SCP the script to remote
Write-Host "Uploading check script..."
& scp -o StrictHostKeyChecking=no $tempScript "${target}:env-check.ps1" 2>&1 | Out-Null

# Execute remotely via cmd.exe which then calls PowerShell (Windows SSH default shell is cmd)
Write-Host "Executing..."
$out = & ssh -o StrictHostKeyChecking=no $target "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -ExecutionPolicy Bypass -File C:\Users\SunBin\env-check.ps1" 2>&1
$out | ForEach-Object { Write-Host $_ }

# Cleanup local temp
Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
