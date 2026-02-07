# 扫描D盘 codeknowledge 目录
Write-Host "=== D:\codeknowledge 各项目大小 ===" -ForegroundColor Cyan
$projects = Get-ChildItem -Path "D:\codeknowledge" -Directory -Force -ErrorAction SilentlyContinue

foreach ($proj in $projects) {
    $size = 0
    Get-ChildItem -Path $proj.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $size += $_.Length
    }
    Write-Host ("{0,10:N2} GB - {1}" -f ($size/1GB), $proj.Name)
}

Write-Host ""
Write-Host "=== D:\ 根目录各文件夹大小 (TOP 15) ===" -ForegroundColor Cyan
$rootDirs = Get-ChildItem -Path "D:\" -Directory -Force -ErrorAction SilentlyContinue

$results = foreach ($dir in $rootDirs) {
    $size = 0
    Get-ChildItem -Path $dir.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $size += $_.Length
    }
    [PSCustomObject]@{
        SizeGB = [math]::Round($size / 1GB, 2)
        Name = $dir.Name
    }
}

$results | Sort-Object SizeGB -Descending | Select-Object -First 15 | Format-Table -AutoSize
