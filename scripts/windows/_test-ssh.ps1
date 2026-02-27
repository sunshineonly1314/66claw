$ErrorActionPreference = 'Continue'
$target = "SunBin@192.168.0.102"

Write-Host "Testing SSH to $target ..."
$out = & ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 $target 'powershell -Command "Write-Host SSH-OK; hostname; whoami"' 2>&1
Write-Host "Exit code: $LASTEXITCODE"
Write-Host "Output:"
$out | ForEach-Object { Write-Host "  $_" }
