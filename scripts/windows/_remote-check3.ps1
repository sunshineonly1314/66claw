$ErrorActionPreference = 'Continue'
$target = "SunBin@192.168.0.102"
$PS = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"

# Create the check script content as a single encoded command
$scriptBlock = @'
$ErrorActionPreference = 'Continue'
Write-Host "=== Machine ==="
Write-Host "  Hostname: $env:COMPUTERNAME"
Write-Host "  User: $env:USERNAME"
Write-Host ""
Write-Host "=== Node ==="
try { $v = & node --version 2>&1; Write-Host "  $v" } catch { Write-Host "  NOT FOUND" }
Write-Host ""
Write-Host "=== Installers ==="
$exes = Get-ChildItem "E:\clawdbuild\ClawdbotCN-Setup-*.exe" -ErrorAction SilentlyContinue
if ($exes) { $exes | ForEach-Object { Write-Host ("  " + $_.Name + " (" + [math]::Round($_.Length/1MB,1) + " MB)") } }
else { Write-Host "  (none)" }
Write-Host ""
Write-Host "=== Test Dir ==="
if (Test-Path "E:\clawdbuild\test\ClawdbotCN\dist\entry.js") { Write-Host "  Existing test install" }
else { Write-Host "  No test install" }
Write-Host ""
Write-Host "=== Port 18789 ==="
$c = Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue
if ($c) { Write-Host ("  IN USE PID: " + ($c.OwningProcess -join ",")) }
else { Write-Host "  Free" }
Write-Host ""
Write-Host "=== Old Config ==="
$d = "$env:USERPROFILE\.clawdbot"
if (Test-Path $d) { Write-Host "  [EXISTS] $d" } else { Write-Host "  [NOT EXISTS]" }
Write-Host ""
Write-Host "=== Workspace ==="
$ws = "D:\cicd-workspace\openclawcn"
if (Test-Path $ws) { Write-Host "  [OK] $ws" } else { Write-Host "  [MISSING] $ws" }
'@

# Encode as Base64 for -EncodedCommand
$bytes = [System.Text.Encoding]::Unicode.GetBytes($scriptBlock)
$encodedCmd = [Convert]::ToBase64String($bytes)

Write-Host "Executing remote environment check on KEVINSUN..."
$out = & ssh -o StrictHostKeyChecking=no $target "$PS -NoProfile -EncodedCommand $encodedCmd" 2>&1
$out | ForEach-Object { Write-Host $_ }
