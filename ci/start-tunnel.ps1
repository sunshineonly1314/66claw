# SSH 反向隧道：本机 8888 → 阿里云 9999
# 保持连接：autossh 风格，断线自动重连

$ALIYUN = "root@106.15.198.253"
$LOCAL_PORT = 8888
$REMOTE_PORT = 9999

Write-Host "启动 SSH 反向隧道..."
Write-Host "本机 localhost:$LOCAL_PORT → 阿里云 $REMOTE_PORT"
Write-Host "Gitee Webhook URL: http://106.15.198.253:${REMOTE_PORT}/webhook"
Write-Host ""
Write-Host "按 Ctrl+C 停止隧道"
Write-Host ""

# -N: 不执行命令，只做转发
# -R: 反向隧道，远端 9999 → 本地 8888
# -o ServerAliveInterval=30: 每30秒发心跳，保持连接
# -o ExitOnForwardFailure=yes: 转发失败时退出
while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Connecting tunnel..."
    ssh -N `
        -o StrictHostKeyChecking=no `
        -o ServerAliveInterval=30 `
        -o ServerAliveCountMax=3 `
        -o ExitOnForwardFailure=yes `
        -R "0.0.0.0:${REMOTE_PORT}:localhost:${LOCAL_PORT}" `
        $ALIYUN
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Tunnel disconnected, reconnecting in 5s..."
    Start-Sleep -Seconds 5
}
