$Config = Get-Content "d:\codeknowledge\clawdbot-main\clawdbot-main\ci\config.json" | ConvertFrom-Json
$WIN_HOST = $Config.builders.windows.host
$WIN_USER = $Config.builders.windows.user
$MAC_HOST = $Config.builders.macos.host
$MAC_USER = $Config.builders.macos.user

Write-Host "=== Windows 构建机 ($WIN_USER@$WIN_HOST) ==="
$out = ssh -o StrictHostKeyChecking=no "${WIN_USER}@${WIN_HOST}" 'powershell -Command "node --version; git --version; Write-Host OK"' 2>&1
Write-Host $out

Write-Host ""
Write-Host "=== Mac mini ($MAC_USER@$MAC_HOST) ==="
$out2 = ssh -o StrictHostKeyChecking=no "${MAC_USER}@${MAC_HOST}" 'node --version; git --version; echo OK' 2>&1
Write-Host $out2
