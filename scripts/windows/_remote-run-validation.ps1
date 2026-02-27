$ErrorActionPreference = 'Continue'
$target = "SunBin@192.168.0.102"
$PS = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"

# The validation script is already uploaded to C:\Users\SunBin\post-build-validation.ps1
# Execute it with parameters via EncodedCommand

$cmd = @'
& C:\Users\SunBin\post-build-validation.ps1 `
    -InstallerPath "E:\clawdbuild\ClawdbotCN-Setup-2026.2.15-x64.exe" `
    -InstallDir "E:\clawdbuild\test\ClawdbotCN" `
    -LogDir "E:\clawdbuild\logs" `
    -Port 18789 `
    -Cleanup
Write-Host "EXIT_CODE: $LASTEXITCODE"
'@

$bytes = [System.Text.Encoding]::Unicode.GetBytes($cmd)
$encoded = [Convert]::ToBase64String($bytes)

Write-Host "=== Starting remote validation on KEVINSUN ==="
Write-Host "This may take 3-5 minutes (silent install + gateway startup + tests + cleanup)..."
Write-Host ""

$out = & ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 $target "$PS -NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded" 2>&1
$out | ForEach-Object { Write-Host $_ }
