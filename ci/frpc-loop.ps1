# frpc 自动重连循环（由任务计划后台调用）
$CiDir = "D:\codeknowledge\clawdbot-main\clawdbot-main\ci"
$FrpcExe = "E:\frp\frpc.exe"
$ConfigFile = "$CiDir\frpc.toml"
$LogFile = "$CiDir\frpc.log"

function Write-Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

Write-Log "frpc-loop started"

while ($true) {
    Write-Log "Connecting to FRP server..."
    & $FrpcExe -c $ConfigFile 2>&1 | ForEach-Object { Write-Log $_ }
    Write-Log "frpc exited, reconnecting in 5s..."
    Start-Sleep -Seconds 5
}
