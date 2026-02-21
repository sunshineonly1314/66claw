$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Config = Get-Content (Join-Path $ScriptDir "config.json") | ConvertFrom-Json

$WIN_HOST = $Config.builders.windows.host
$WIN_USER = $Config.builders.windows.user
$MAC_HOST = $Config.builders.macos.host
$MAC_USER = $Config.builders.macos.user

Write-Host "=== Testing SSH to Windows builder ($WIN_USER@$WIN_HOST) ==="
$out = ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${WIN_USER}@${WIN_HOST}" 'powershell -Command Write-Host "Win-OK"' 2>&1
Write-Host "SSH result: $out"

Write-Host "=== Testing SSH to Mac mini ($MAC_USER@$MAC_HOST) ==="
$out2 = ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "${MAC_USER}@${MAC_HOST}" 'echo mac-ok' 2>&1
Write-Host "SSH result: $out2"

Write-Host "=== Testing SCP upload ==="
"test content" | Out-File -FilePath "$env:TEMP\ci-test.txt" -Encoding utf8
scp -o StrictHostKeyChecking=no "$env:TEMP\ci-test.txt" "${WIN_USER}@${WIN_HOST}:ci-test.txt" 2>&1
Write-Host "SCP exit: $LASTEXITCODE"
