# 将 Chrome 扩展复制到 Tauri 资源目录
# 确保打包时包含在最外层

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$TauriRoot = "$ProjectRoot\apps\windows\src-tauri"
$ChromeExtSource = "$ProjectRoot\assets\chrome-extension"
$ChromeExtDest = "$TauriRoot\chrome-extension"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " 复制 Chrome 扩展到 Tauri 资源目录" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查源目录
if (-not (Test-Path $ChromeExtSource)) {
    Write-Error "Chrome 扩展源目录不存在: $ChromeExtSource"
    exit 1
}

# 检查是否有 manifest.json
if (-not (Test-Path "$ChromeExtSource\manifest.json")) {
    Write-Error "manifest.json 不存在于: $ChromeExtSource"
    exit 1
}

# 删除旧的目标目录（如果存在）
if (Test-Path $ChromeExtDest) {
    Write-Host "[清理] 删除旧的 chrome-extension..." -ForegroundColor Yellow
    Remove-Item $ChromeExtDest -Recurse -Force
}

# 复制
Write-Host "[复制] chrome-extension → Tauri 资源目录..." -ForegroundColor Green
Copy-Item $ChromeExtSource $ChromeExtDest -Recurse -Force

# 验证
if (Test-Path "$ChromeExtDest\manifest.json") {
    $fileCount = (Get-ChildItem $ChromeExtDest -Recurse -File).Count
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " ✓ 复制成功!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "目标位置: $ChromeExtDest"
    Write-Host "文件数量: $fileCount"
    Write-Host ""
    Write-Host "打包后，用户将在安装目录看到 chrome-extension 文件夹"
    Write-Host "可直接拖到 chrome://extensions 页面使用"
} else {
    Write-Error "复制失败: manifest.json 未找到于目标目录"
    exit 1
}
