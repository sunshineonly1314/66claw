$ErrorActionPreference = "Stop"

$FrpDir = "E:\frp"
$FrpcExe = "$FrpDir\frpc.exe"
$ZipFile = "$FrpDir\frp.zip"
$Url = "https://github.com/fatedier/frp/releases/download/v0.61.1/frp_0.61.1_windows_amd64.zip"

New-Item -ItemType Directory -Path $FrpDir -Force | Out-Null

if (Test-Path $FrpcExe) {
    Write-Host "frpc 已存在: $FrpcExe"
    & $FrpcExe --version
    exit 0
}

# 尝试从C:\frp复制
if (Test-Path "C:\frp\frpc.exe") {
    Write-Host "从 C:\frp 复制..."
    Copy-Item "C:\frp\frpc.exe" $FrpcExe -Force
    Write-Host "Done"
    & $FrpcExe --version
    exit 0
}

# 从C:\frp解压目录复制
if (Test-Path "C:\frp\frp_0.61.1_windows_amd64\frpc.exe") {
    Write-Host "从 C:\frp\frp_0.61.1_windows_amd64 复制..."
    Copy-Item "C:\frp\frp_0.61.1_windows_amd64\frpc.exe" $FrpcExe -Force
    Write-Host "Done"
    & $FrpcExe --version
    exit 0
}

# 下载
Write-Host "下载 frp v0.61.1..."
Invoke-WebRequest -Uri $Url -OutFile $ZipFile -UseBasicParsing
Write-Host "解压..."
Expand-Archive -Path $ZipFile -DestinationPath $FrpDir -Force
Copy-Item "$FrpDir\frp_0.61.1_windows_amd64\frpc.exe" $FrpcExe -Force
Write-Host "安装完成: $FrpcExe"
& $FrpcExe --version
