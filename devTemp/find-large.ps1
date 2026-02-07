# 查找大文件
Write-Host "=== build/wsl-offline 子目录 ===" -ForegroundColor Cyan
Get-ChildItem -Path "D:\codeknowledge\clawdbot-main\clawdbot-main\build\wsl-offline" -Directory -Force | ForEach-Object {
    $folder = $_
    $size = 0
    Get-ChildItem -Path $folder.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $size += $_.Length
    }
    [PSCustomObject]@{
        SizeMB = [math]::Round($size / 1MB, 2)
        Name = $folder.Name
    }
} | Sort-Object SizeMB -Descending | Format-Table -AutoSize

Write-Host "=== build/output 子目录 ===" -ForegroundColor Cyan
Get-ChildItem -Path "D:\codeknowledge\clawdbot-main\clawdbot-main\build\output" -Directory -Force | ForEach-Object {
    $folder = $_
    $size = 0
    Get-ChildItem -Path $folder.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $size += $_.Length
    }
    [PSCustomObject]@{
        SizeMB = [math]::Round($size / 1MB, 2)
        Name = $folder.Name
    }
} | Sort-Object SizeMB -Descending | Format-Table -AutoSize

Write-Host "=== build 根目录大文件 TOP 20 ===" -ForegroundColor Cyan
Get-ChildItem -Path "D:\codeknowledge\clawdbot-main\clawdbot-main\build" -Recurse -File -Force -ErrorAction SilentlyContinue | 
    Sort-Object Length -Descending | 
    Select-Object -First 20 @{N='SizeMB';E={[math]::Round($_.Length/1MB,2)}}, FullName |
    Format-Table -AutoSize
