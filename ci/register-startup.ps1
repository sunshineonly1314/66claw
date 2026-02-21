$CiDir = "D:\codeknowledge\clawdbot-main\clawdbot-main\ci"
$RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"

$webhookCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$CiDir\webhook-loop.ps1`""
Set-ItemProperty -Path $RegPath -Name "ClawdbotCN-Webhook" -Value $webhookCmd
Write-Host "OK: Webhook registered"

$frpcCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$CiDir\frpc-loop.ps1`""
Set-ItemProperty -Path $RegPath -Name "ClawdbotCN-FRP" -Value $frpcCmd
Write-Host "OK: FRP registered"

Write-Host "Verifying:"
(Get-ItemProperty -Path $RegPath)."ClawdbotCN-Webhook"
(Get-ItemProperty -Path $RegPath)."ClawdbotCN-FRP"
Write-Host "Done. Both services will auto-start silently on next login."
