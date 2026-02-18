# ClawdbotCN 完整构建脚本（包含 Chrome 扩展）
# 确保 Chrome 扩展出现在安装包最外层

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ClawdbotCN 完整构建（含Chrome扩展）" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $ProjectRoot

# Step 1: 复制 Chrome 扩展到 Tauri 资源目录
Write-Host "[1/4] 复制 Chrome 扩展到 Tauri 资源目录..." -ForegroundColor Green

$TauriRoot = "$ProjectRoot\apps\windows\src-tauri"
$ChromeExtSource = "$ProjectRoot\assets\chrome-extension"
$ChromeExtDest = "$TauriRoot\chrome-extension"

if (-not (Test-Path $ChromeExtSource)) {
    Write-Error "Chrome 扩展源目录不存在: $ChromeExtSource"
    exit 1
}

if (-not (Test-Path "$ChromeExtSource\manifest.json")) {
    Write-Error "manifest.json 不存在于: $ChromeExtSource"
    exit 1
}

if (Test-Path $ChromeExtDest) {
    Remove-Item $ChromeExtDest -Recurse -Force
}

Copy-Item $ChromeExtSource $ChromeExtDest -Recurse -Force

if (Test-Path "$ChromeExtDest\manifest.json") {
    Write-Host "  ✓ Chrome 扩展已复制到 Tauri 资源目录" -ForegroundColor Green
    Write-Host "    位置: $ChromeExtDest" -ForegroundColor Gray
} else {
    Write-Error "复制失败: manifest.json 未找到"
    exit 1
}
Write-Host ""

# Step 2: 构建后端
Write-Host "[2/4] 构建后端代码..." -ForegroundColor Green
pnpm build
if ($LASTEXITCODE -ne 0) {
    Write-Error "后端构建失败"
    exit 1
}
Write-Host "  ✓ 后端构建完成" -ForegroundColor Green
Write-Host ""

# Step 3: 构建前端 UI
Write-Host "[3/4] 构建前端 UI..." -ForegroundColor Green
if (Test-Path "ui\package.json") {
    Push-Location ui
    if (-not (Test-Path "node_modules")) {
        Write-Host "  安装 UI 依赖..." -ForegroundColor Gray
        pnpm install
    }
    pnpm build
    $uiBuildResult = $LASTEXITCODE
    Pop-Location

    if ($uiBuildResult -ne 0) {
        Write-Warning "UI 构建失败（继续）"
    } else {
        Write-Host "  ✓ UI 构建完成" -ForegroundColor Green
    }
} else {
    Write-Host "  ⊘ 跳过（无 UI）" -ForegroundColor Gray
}
Write-Host ""

# Step 4: 构建 Tauri 应用
Write-Host "[4/4] 构建 Tauri 桌面应用..." -ForegroundColor Green
Write-Host "  这可能需要几分钟..." -ForegroundColor Gray

# 添加 Rust 到 PATH
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"

# 设置 MSVC 环境（如果存在）
$vcvarsPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
if (Test-Path $vcvarsPath) {
    $tempBat = [System.IO.Path]::GetTempFileName() + ".bat"
    $tempOut = [System.IO.Path]::GetTempFileName()

    @"
@echo off
call "$vcvarsPath"
set > "$tempOut"
"@ | Out-File -FilePath $tempBat -Encoding ASCII

    cmd /c $tempBat

    Get-Content $tempOut | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $name = $matches[1]
            $value = $matches[2]
            Set-Item -Path "env:$name" -Value $value
        }
    }

    Remove-Item $tempBat, $tempOut
}

# 进入 Tauri 目录构建
Push-Location "$TauriRoot"
pnpm tauri build
$tauriBuildResult = $LASTEXITCODE
Pop-Location

if ($tauriBuildResult -ne 0) {
    Write-Error "Tauri 构建失败"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " ✓ 构建完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 查找生成的安装包
$bundlePath = "$TauriRoot\target\release\bundle\nsis"
if (Test-Path $bundlePath) {
    $installers = Get-ChildItem $bundlePath -Filter "*.exe"
    if ($installers) {
        Write-Host "安装包位置:" -ForegroundColor Cyan
        foreach ($installer in $installers) {
            Write-Host "  $($installer.FullName)" -ForegroundColor Yellow
            Write-Host "  大小: $([math]::Round($installer.Length/1MB, 2)) MB" -ForegroundColor Gray
        }
        Write-Host ""
        Write-Host "✨ Chrome 扩展已包含在安装包中" -ForegroundColor Green
        Write-Host "   用户安装后可在以下位置找到:" -ForegroundColor Gray
        Write-Host "   C:\Program Files\Clawdbot\chrome-extension" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   或直接拖拽安装目录中的 chrome-extension 文件夹" -ForegroundColor Gray
        Write-Host "   到 chrome://extensions 页面即可加载！" -ForegroundColor Gray
    }
} else {
    Write-Warning "未找到安装包输出目录: $bundlePath"
}

Write-Host ""
Write-Host "提示: 如需重新构建，请先运行:" -ForegroundColor Cyan
Write-Host "  Remove-Item '$TauriRoot\target' -Recurse -Force" -ForegroundColor Gray
Write-Host ""
