$ErrorActionPreference = 'Continue'
$target = "SunBin@192.168.0.102"
$PS = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"

# Step 1: Verify script exists on remote
Write-Host "=== Verifying script on KEVINSUN ==="
$verify = & ssh -o StrictHostKeyChecking=no $target "dir D:\cicd-workspace\openclawcn\scripts\windows\post-build-validation.ps1" 2>&1
$verify | ForEach-Object { Write-Host "  $_" }

# Step 2: Run validation remotely via EncodedCommand
$cmd = @'
& D:\cicd-workspace\openclawcn\scripts\windows\post-build-validation.ps1 `
    -InstallerPath "E:\clawdbuild\ClawdbotCN-Setup-2026.2.15-x64.exe" `
    -InstallDir "E:\clawdbuild\test\ClawdbotCN" `
    -LogDir "E:\clawdbuild\logs" `
    -Port 18789 `
    -Cleanup
Write-Host "VALIDATION_EXIT: $LASTEXITCODE"
'@

$bytes = [System.Text.Encoding]::Unicode.GetBytes($cmd)
$encoded = [Convert]::ToBase64String($bytes)

Write-Host ""
Write-Host "=== Starting validation on KEVINSUN ==="
Write-Host "Install + Gateway + HTTP + WS + Cleanup, may take 3-5 min..."
Write-Host ""

$out = & ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 $target "$PS -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded" 2>&1
$out | ForEach-Object { Write-Host $_ }
