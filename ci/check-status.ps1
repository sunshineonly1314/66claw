Write-Host "=== Port 8888 ==="
Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,State,OwningProcess

Write-Host "=== frpc process ==="
Get-Process frpc -ErrorAction SilentlyContinue | Select-Object Id,CPU,StartTime

Write-Host "=== Registry autostart ==="
$r = Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -ErrorAction SilentlyContinue
if ($r."ClawdbotCN-Webhook") { Write-Host "Webhook: OK" } else { Write-Host "Webhook: MISSING" }
if ($r."ClawdbotCN-FRP")     { Write-Host "FRP:     OK" } else { Write-Host "FRP:     MISSING" }

Write-Host "=== External health check ==="
try {
    $h = Invoke-WebRequest -Uri "http://106.15.198.253:9999/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "Tunnel OK: $($h.Content)"
} catch {
    Write-Host "Tunnel FAIL: $_"
}
