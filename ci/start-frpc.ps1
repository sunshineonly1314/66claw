# 启动FRP客户端
# 如果被Defender拦截，需要先以管理员身份运行:
#   Add-MpPreference -ExclusionPath "E:\frp"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigFile = Join-Path $ScriptDir "frpc.toml"

# 查找frpc.exe
$FrpcCandidates = @("E:\frp\frpc.exe", "C:\frp\frpc.exe", "C:\frp\frp_0.61.1_windows_amd64\frpc.exe")
$FrpcExe = $null
foreach ($c in $FrpcCandidates) {
    if (Test-Path $c) { $FrpcExe = $c; break }
}

if (-not $FrpcExe) {
    Write-Host "ERROR: 找不到 frpc.exe，请先运行 install-frpc.ps1"
    exit 1
}

Write-Host "=== FRP 客户端启动 ==="
Write-Host "frpc: $FrpcExe"
Write-Host "配置: $ConfigFile"
Write-Host ""
Write-Host "端口映射:"
Write-Host "  本地8888 → 阿里云9999  (Gitee Webhook)"
Write-Host "  本地22   → 阿里云6022  (Windows SSH)"
Write-Host ""
Write-Host "Gitee Webhook URL: http://106.15.198.253:9999/webhook"
Write-Host ""

while ($true) {
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 连接中..."
    & $FrpcExe -c $ConfigFile
    $exit = $LASTEXITCODE
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] 断开(exit=$exit)，5秒后重连..."
    Start-Sleep -Seconds 5
}
