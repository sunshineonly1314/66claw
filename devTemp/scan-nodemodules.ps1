# 扫描node_modules中最大的包
$Path = "D:\codeknowledge\clawdbot-main\clawdbot-main\node_modules"

$folders = Get-ChildItem -Path $Path -Directory -ErrorAction SilentlyContinue

$results = foreach ($folder in $folders) {
    $size = 0
    Get-ChildItem -Path $folder.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $size += $_.Length
    }
    [PSCustomObject]@{
        SizeMB = [math]::Round($size / 1MB, 2)
        Name = $folder.Name
    }
}

Write-Host "=== node_modules 目录分析 (TOP 30) ===" -ForegroundColor Cyan
$results | Sort-Object SizeMB -Descending | Select-Object -First 30 | Format-Table -AutoSize
