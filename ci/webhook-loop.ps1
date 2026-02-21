# webhook-server 自动重启循环（由任务计划后台调用）
$CiDir = "D:\codeknowledge\clawdbot-main\clawdbot-main\ci"
$LogFile = "$CiDir\webhook.log"
$ErrFile = "$CiDir\webhook-err.log"

function Write-Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

Write-Log "webhook-loop started"

while ($true) {
    Write-Log "Starting webhook server..."
    & node "$CiDir\webhook-server.js" 2>&1 | ForEach-Object { Write-Log $_ }
    Write-Log "webhook server exited, restarting in 3s..."
    Start-Sleep -Seconds 3
}
