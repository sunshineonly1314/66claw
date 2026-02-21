$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Config = Get-Content (Join-Path $ScriptDir "config.json") | ConvertFrom-Json

$WIN_HOST = $Config.builders.windows.host
$WIN_USER = $Config.builders.windows.user

New-Item -ItemType Directory -Path "C:\Temp" -Force | Out-Null
"test content" | Out-File -FilePath "C:\Temp\ci-test.txt" -Encoding utf8 -Force

# 用正斜杠路径
scp -o StrictHostKeyChecking=no "C:/Temp/ci-test.txt" "${WIN_USER}@${WIN_HOST}:ci-test.txt" 2>&1
Write-Host "Exit: $LASTEXITCODE"
