# 扫描clawdbot-src子目录
$Path = "D:\codeknowledge\clawdbot-main\clawdbot-main\build\wsl-offline\clawdbot-src"

Write-Host "=== clawdbot-src 子目录大小 ===" -ForegroundColor Cyan
$folders = Get-ChildItem -Path $Path -Directory -Force -ErrorAction SilentlyContinue

foreach ($folder in $folders) {
    $size = 0
    Get-ChildItem -Path $folder.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $size += $_.Length
    }
    Write-Host ("{0,12:N2} MB - {1}" -f ($size/1MB), $folder.Name)
}
