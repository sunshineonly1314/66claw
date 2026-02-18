# All-in-One Tauri 打包资源准备脚本
# 功能: 将 ClawdbotCN 的所有运行时资源复制到临时打包目录

$ErrorActionPreference = "Stop"

# 项目根目录
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$BundleDir = "E:\clawdbuild\tauri-bundle-staging"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Tauri All-in-One 资源准备" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "项目根目录: $ProjectRoot"
Write-Host "输出目录: $BundleDir"
Write-Host ""

# 清理旧目录
if (Test-Path $BundleDir) {
    Write-Host "[清理] 删除旧的打包目录..." -ForegroundColor Yellow
    Remove-Item $BundleDir -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $BundleDir | Out-Null

# 1. 复制 node.exe
Write-Host "[1/9] 复制 Node.js 运行时..." -ForegroundColor Green
$nodeExe = "$ProjectRoot\scripts\windows\node-portable\node.exe"
if (Test-Path $nodeExe) {
    Copy-Item $nodeExe "$BundleDir\node.exe" -Force
    Write-Host "  ✓ node.exe ($([math]::Round((Get-Item "$BundleDir\node.exe").Length/1MB, 2)) MB)"
} else {
    Write-Error "node.exe 未找到: $nodeExe"
}

# 2. 复制编译后的 dist/
Write-Host "[2/9] 复制编译后的后端代码 (dist/)..." -ForegroundColor Green
if (Test-Path "$ProjectRoot\dist") {
    Copy-Item "$ProjectRoot\dist" "$BundleDir\dist" -Recurse -Force
    $distSize = (Get-ChildItem "$BundleDir\dist" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "  ✓ dist/ ($([math]::Round($distSize, 2)) MB)"
} else {
    Write-Error "dist/ 目录未找到，请先运行 pnpm build"
}

# 3. 复制生产依赖 node_modules
Write-Host "[3/9] 复制生产依赖 (node_modules/)..." -ForegroundColor Green
$prodNodeModules = "E:\clawdbuild\test-prod-deps\node_modules"
if (Test-Path $prodNodeModules) {
    Write-Host "  正在复制 node_modules (这可能需要几分钟)..."
    robocopy "$prodNodeModules" "$BundleDir\node_modules" /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    $nmSize = (Get-ChildItem "$BundleDir\node_modules" -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
    Write-Host "  ✓ node_modules/ ($([math]::Round($nmSize, 2)) MB)"
} else {
    Write-Error "生产 node_modules 未找到: $prodNodeModules"
}

# 4. 复制 skills (使用 skills-merged 或本地 skills)
Write-Host "[4/9] 复制技能包 (skills/)..." -ForegroundColor Green
if (Test-Path "$ProjectRoot\skills-merged") {
    Copy-Item "$ProjectRoot\skills-merged" "$BundleDir\skills" -Recurse -Force
    $skillsCount = (Get-ChildItem "$BundleDir\skills" -Directory).Count
    Write-Host "  ✓ skills/ ($skillsCount 个技能)"
} elseif (Test-Path "$ProjectRoot\skills") {
    Copy-Item "$ProjectRoot\skills" "$BundleDir\skills" -Recurse -Force
    Write-Host "  ✓ skills/ (本地技能)"
} else {
    Write-Warning "  ! 未找到 skills 目录，将在运行时下载"
}

# 5. 复制 extensions (排除 node_modules)
Write-Host "[5/9] 复制扩展 (extensions/)..." -ForegroundColor Green
if (Test-Path "$ProjectRoot\extensions") {
    robocopy "$ProjectRoot\extensions" "$BundleDir\extensions" /E /XD node_modules .turbo /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    $extCount = (Get-ChildItem "$BundleDir\extensions" -Directory).Count
    Write-Host "  ✓ extensions/ ($extCount 个扩展)"
} else {
    Write-Warning "  ! 未找到 extensions 目录"
}

# 6. 复制 tools
Write-Host "[6/9] 复制工具二进制 (tools/)..." -ForegroundColor Green
$toolsSource = "$ProjectRoot\scripts\windows\bundled-bins"
if (Test-Path $toolsSource) {
    New-Item -ItemType Directory -Force -Path "$BundleDir\tools" | Out-Null
    Copy-Item "$toolsSource\*" "$BundleDir\tools\" -Force
    $toolsCount = (Get-ChildItem "$BundleDir\tools" -File).Count
    Write-Host "  ✓ tools/ ($toolsCount 个工具)"
} else {
    Write-Warning "  ! 未找到 bundled-bins 目录"
}

# 7. 复制数据和文档
Write-Host "[7/9] 复制数据和文档..." -ForegroundColor Green
if (Test-Path "$ProjectRoot\data") {
    Copy-Item "$ProjectRoot\data" "$BundleDir\data" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ data/"
}
if (Test-Path "$ProjectRoot\docs-cn\reference\templates") {
    New-Item -ItemType Directory -Force -Path "$BundleDir\docs\reference" | Out-Null
    Copy-Item "$ProjectRoot\docs-cn\reference\templates" "$BundleDir\docs\reference\templates" -Recurse -Force
    Write-Host "  ✓ docs/reference/templates/"
}

# 8. 复制必要的构建文件
Write-Host "[8/9] 复制构建文件..." -ForegroundColor Green
Copy-Item "$ProjectRoot\package.json" "$BundleDir\package.json" -Force
if (Test-Path "$ProjectRoot\patches") {
    Copy-Item "$ProjectRoot\patches" "$BundleDir\patches" -Recurse -Force
}
if (Test-Path "$ProjectRoot\scripts\postinstall.js") {
    New-Item -ItemType Directory -Force -Path "$BundleDir\scripts" | Out-Null
    Copy-Item "$ProjectRoot\scripts\postinstall.js" "$BundleDir\scripts\postinstall.js" -Force
}
Write-Host "  ✓ 构建文件"

# 9. 复制 Chrome 扩展到最外层（方便用户直接拖拽）
Write-Host "[9/10] 复制 Chrome 扩展到最外层..." -ForegroundColor Green
$chromeExtSource = "$ProjectRoot\assets\chrome-extension"
if (Test-Path $chromeExtSource) {
    Copy-Item "$chromeExtSource" "$BundleDir\chrome-extension" -Recurse -Force
    Write-Host "  ✓ chrome-extension/ (用户可直接拖到Chrome)"
} else {
    Write-Warning "  ! 未找到 chrome-extension 目录: $chromeExtSource"
}

# 10. 统计总大小
Write-Host "[10/10] 统计资源大小..." -ForegroundColor Green
$totalSize = (Get-ChildItem $BundleDir -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " 资源准备完成!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "总大小: $([math]::Round($totalSize, 2)) MB"
Write-Host "输出目录: $BundleDir"
Write-Host ""
Write-Host "✨ Chrome扩展位置: $BundleDir\chrome-extension"
Write-Host "   用户可直接拖到 chrome://extensions 页面"
Write-Host ""
Write-Host "下一步: 运行 build-tauri-full.ps1 构建桌面应用"
