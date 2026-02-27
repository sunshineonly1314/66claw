# Setup scheduled tasks for ClawdbotCN CI services (Webhook + FRP)
# Uses wscript.exe + VBS wrapper for truly windowless execution (no black flash)

$ErrorActionPreference = "Stop"

$CiDir = "D:\codeknowledge\clawdbot-main\clawdbot-main\ci"
$User = "KEVINUP\72793"

# ── 1. Webhook task ──────────────────────────────────────────────────────────
Write-Host "Creating ClawdbotCN-Webhook task..." -ForegroundColor Cyan

$whAction = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument "`"$CiDir\start-webhook-hidden.vbs`"" `
    -WorkingDirectory $CiDir

$whTrigger = New-ScheduledTaskTrigger -AtLogOn -User $User
$whTrigger.Delay = "PT10S"

$whSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([System.TimeSpan]::Zero) `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -Hidden `
    -MultipleInstances IgnoreNew

$whPrincipal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName "ClawdbotCN-Webhook" `
    -Action $whAction `
    -Trigger $whTrigger `
    -Settings $whSettings `
    -Principal $whPrincipal `
    -Description "ClawdbotCN Webhook Server - listens for Gitee webhooks and triggers CI builds" `
    -Force | Out-Null

Write-Host "  OK: ClawdbotCN-Webhook created" -ForegroundColor Green

# ── 2. FRP task ──────────────────────────────────────────────────────────────
Write-Host "Creating ClawdbotCN-FRP task..." -ForegroundColor Cyan

$frpAction = New-ScheduledTaskAction `
    -Execute "wscript.exe" `
    -Argument "`"$CiDir\start-frpc-hidden.vbs`"" `
    -WorkingDirectory $CiDir

$frpTrigger = New-ScheduledTaskTrigger -AtLogOn -User $User
$frpTrigger.Delay = "PT10S"

$frpSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([System.TimeSpan]::Zero) `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -Hidden `
    -MultipleInstances IgnoreNew

$frpPrincipal = New-ScheduledTaskPrincipal -UserId $User -LogonType Interactive -RunLevel Limited

Register-ScheduledTask `
    -TaskName "ClawdbotCN-FRP" `
    -Action $frpAction `
    -Trigger $frpTrigger `
    -Settings $frpSettings `
    -Principal $frpPrincipal `
    -Description "ClawdbotCN FRP Client - maintains tunnel to FRP server for remote build access" `
    -Force | Out-Null

Write-Host "  OK: ClawdbotCN-FRP created" -ForegroundColor Green

# ── 3. Verify ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Verifying tasks..." -ForegroundColor Cyan
Get-ScheduledTask -TaskName "ClawdbotCN-Webhook","ClawdbotCN-FRP" | Format-Table TaskName, State, Description -AutoSize

Write-Host "Done! Both tasks will auto-start at logon (10s delay, completely hidden via wscript+VBS)." -ForegroundColor Green
