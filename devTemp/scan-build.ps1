# 扫描build目录大小
$Path = "D:\codeknowledge\clawdbot-main\clawdbot-main\build"

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

Write-Host "=== build 目录分析 ===" -ForegroundColor Cyan
$results | Sort-Object SizeMB -Descending | Format-Table -AutoSize
