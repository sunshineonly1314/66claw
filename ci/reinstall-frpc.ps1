$ErrorActionPreference = "Stop"

# 删除被隔离的旧文件
Write-Host "清理旧文件..."
Remove-Item "E:\frp" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "C:\frp" -Recurse -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 重新下载到E盘
$FrpDir = "E:\frp"
New-Item -ItemType Directory -Path $FrpDir -Force | Out-Null

$Url = "https://github.com/fatedier/frp/releases/download/v0.61.1/frp_0.61.1_windows_amd64.zip"
$ZipFile = "$FrpDir\frp.zip"

Write-Host "下载 frp v0.61.1..."
Invoke-WebRequest -Uri $Url -OutFile $ZipFile -UseBasicParsing
Write-Host "解压..."
Expand-Archive -Path $ZipFile -DestinationPath $FrpDir -Force

$FrpcSrc = "$FrpDir\frp_0.61.1_windows_amd64\frpc.exe"
$FrpcDst = "$FrpDir\frpc.exe"
Copy-Item $FrpcSrc $FrpcDst -Force
Remove-Item $ZipFile -Force

Write-Host "测试..."
& $FrpcDst --version
Write-Host "安装成功: $FrpcDst"
