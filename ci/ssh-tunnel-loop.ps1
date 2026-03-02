# SSH 反向隧道守护脚本（替代 frpc-loop.ps1）
# 功能：通过 SSH 反向隧道将本地端口映射到阿里云 253，替代 frp
#
# 隧道映射（等价于原 frpc.toml）：
#   本地 8888 → 253:9999  (Gitee Webhook)
#   本地 22   → 253:6022  (Windows SSH 远程访问)
#
# 安全优势：
#   - 253 只需开放 22 端口（SSH），关闭 7000/9999/6022/6023
#   - 全部流量 SSH 加密，无额外明文协议
#   - 无 frp token 泄露风险

$CiDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogFile = Join-Path $CiDir "ssh-tunnel.log"

# ── 配置 ──────────────────────────────────────────────────────────
# 从环境变量读取，避免硬编码凭据到仓库
$ALIYUN_HOST = if ($env:CI_ALIYUN_HOST) { $env:CI_ALIYUN_HOST } else { "root@106.15.198.253" }

# 重连间隔（秒）
$RECONNECT_DELAY = 5

# ── 日志 ──────────────────────────────────────────────────────────
function Write-Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
}

# ── 日志轮转（防止日志文件无限增长）────────────────────────────────
function Rotate-Log {
    if (Test-Path $LogFile) {
        $size = (Get-Item $LogFile).Length
        if ($size -gt 10MB) {
            $backup = "$LogFile.bak"
            if (Test-Path $backup) { Remove-Item $backup -Force }
            Rename-Item $LogFile $backup -Force
            Write-Log "Log rotated"
        }
    }
}

# ── 主循环 ─────────────────────────────────────────────────────────
Write-Log "ssh-tunnel-loop started (replacing frpc)"

while ($true) {
    Rotate-Log
    Write-Log "Connecting SSH tunnel to $ALIYUN_HOST ..."

    # 直接调用 ssh（与 frpc-loop.ps1 / start-tunnel.ps1 一致的模式）
    # -N: 不执行远程命令，只做转发
    # -R: 反向隧道
    # ServerAliveInterval/CountMax: 心跳保活，断网自动退出
    # ExitOnForwardFailure: 端口绑定失败立即退出（避免空连接）
    ssh -N `
        -o StrictHostKeyChecking=accept-new `
        -o ServerAliveInterval=30 `
        -o ServerAliveCountMax=3 `
        -o ExitOnForwardFailure=yes `
        -o TCPKeepAlive=yes `
        -o ConnectTimeout=10 `
        -R "0.0.0.0:9999:localhost:8888" `
        -R "0.0.0.0:6022:localhost:22" `
        $ALIYUN_HOST 2>&1 | ForEach-Object { Write-Log $_ }

    Write-Log "SSH tunnel exited, reconnecting in ${RECONNECT_DELAY}s..."
    Start-Sleep -Seconds $RECONNECT_DELAY
}
