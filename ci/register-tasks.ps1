$CiDir = "D:\codeknowledge\clawdbot-main\clawdbot-main\ci"
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 0) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

$wArg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"" + $CiDir + "\webhook-loop.ps1`""
$a1 = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $wArg -WorkingDirectory $CiDir
Register-ScheduledTask -TaskName "ClawdbotCN-Webhook" -Action $a1 -Trigger $trigger -Settings $settings -Principal $principal -Description "ClawdbotCN Webhook Server port 8888" -Force | Out-Null
Write-Host "OK: ClawdbotCN-Webhook"

$fArg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"" + $CiDir + "\frpc-loop.ps1`""
$a2 = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $fArg -WorkingDirectory $CiDir
Register-ScheduledTask -TaskName "ClawdbotCN-FRP" -Action $a2 -Trigger $trigger -Settings $settings -Principal $principal -Description "ClawdbotCN FRP Tunnel" -Force | Out-Null
Write-Host "OK: ClawdbotCN-FRP"

Get-Process frpc -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Start-ScheduledTask -TaskName "ClawdbotCN-Webhook" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 3
Start-ScheduledTask -TaskName "ClawdbotCN-FRP"
Start-Sleep -Seconds 5

$port = Get-NetTCPConnection -LocalPort 8888 -ErrorAction SilentlyContinue
if ($port) { Write-Host "OK: port 8888 listening" } else { Write-Host "WARN: 8888 not up yet" }

$frpc = Get-Process frpc -ErrorAction SilentlyContinue
if ($frpc) { Write-Host "OK: frpc PID $($frpc.Id)" } else { Write-Host "WARN: frpc not detected" }

Write-Host "Done."
