# Clawdbot Windows 安装验证脚本
# 用于验证安装后插件是否正确部署
#
# 使用方法:
#   .\verify-installation.ps1
#   .\verify-installation.ps1 -InstallDir "D:\Clawdbot"

# 设置 UTF-8 编码，避免中文乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

param(
    [string]$InstallDir = "C:\Program Files\Clawdbot"
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Clawdbot 安装验证" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "安装目录: $InstallDir"
Write-Host ""

# 检查安装目录是否存在
if (-not (Test-Path $InstallDir)) {
    Write-Host "❌ 安装目录不存在: $InstallDir" -ForegroundColor Red
    Write-Host ""
    Write-Host "提示: 使用 -InstallDir 参数指定正确的安装路径" -ForegroundColor Yellow
    exit 1
}

$errors = 0
$warnings = 0

# ============================================
# 1. 核心组件检查
# ============================================
Write-Host "1. 核心组件" -ForegroundColor White
Write-Host "   ─────────────────────────────────" -ForegroundColor DarkGray

$coreItems = @(
    @{ Name = "Node.js 运行时"; Path = "node\node.exe" },
    @{ Name = "程序入口"; Path = "dist\entry.js" },
    @{ Name = "package.json"; Path = "package.json" }
)

foreach ($item in $coreItems) {
    $fullPath = Join-Path $InstallDir $item.Path
    if (Test-Path $fullPath) {
        Write-Host "   ✅ $($item.Name)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $($item.Name) - 缺失" -ForegroundColor Red
        $errors++
    }
}

# ============================================
# 2. 中国区渠道插件检查
# ============================================
Write-Host ""
Write-Host "2. 中国区渠道插件" -ForegroundColor White
Write-Host "   ─────────────────────────────────" -ForegroundColor DarkGray

# 中国区核心插件
$chinaPlugins = @(
    @{ Name = "飞书 (Feishu)"; Dir = "feishu"; Required = $true },
    @{ Name = "钉钉 (DingTalk)"; Dir = "dingtalk"; Required = $true },
    @{ Name = "企业微信 (WeCom)"; Dir = "wecom"; Required = $false },
    @{ Name = "通义千问认证"; Dir = "qwen-portal-auth"; Required = $false }
)

foreach ($plugin in $chinaPlugins) {
    $pluginDir = Join-Path $InstallDir "extensions\$($plugin.Dir)"
    $packageJson = Join-Path $pluginDir "package.json"
    $indexTs = Join-Path $pluginDir "index.ts"
    
    if (Test-Path $pluginDir) {
        if ((Test-Path $packageJson) -or (Test-Path $indexTs)) {
            Write-Host "   ✅ $($plugin.Name)" -ForegroundColor Green
        } else {
            Write-Host "   ⚠️  $($plugin.Name) - 目录存在但结构不完整" -ForegroundColor Yellow
            $warnings++
        }
    } else {
        if ($plugin.Required) {
            Write-Host "   ❌ $($plugin.Name) - 未安装" -ForegroundColor Red
            $errors++
        } else {
            Write-Host "   ⚪ $($plugin.Name) - 未安装 (可选)" -ForegroundColor Gray
        }
    }
}

# ============================================
# 3. 国际渠道插件检查 (可选)
# ============================================
Write-Host ""
Write-Host "3. 国际渠道插件 (可选)" -ForegroundColor White
Write-Host "   ─────────────────────────────────" -ForegroundColor DarkGray

# 所有支持 Windows 的插件
$internationalPlugins = @(
    # 认证
    "copilot-proxy", "google-antigravity-auth", "google-gemini-cli-auth",
    # 国际通讯
    "telegram", "discord", "slack", "whatsapp", "signal", "msteams", "googlechat", "matrix", "mattermost", "line", "twitch",
    # 亚洲区
    "zalo", "zalouser",
    # 功能增强
    "memory-core", "voice-call", "lobster", "llm-task", "open-prose", "diagnostics-otel",
    # 其他
    "nextcloud-talk", "nostr", "tlon"
)

foreach ($plugin in $internationalPlugins) {
    $pluginDir = Join-Path $InstallDir "extensions\$plugin"
    if (Test-Path $pluginDir) {
        Write-Host "   ✅ $plugin" -ForegroundColor Green
    } else {
        Write-Host "   ⚪ $plugin" -ForegroundColor Gray
    }
}

# ============================================
# 4. node_modules 检查
# ============================================
Write-Host ""
Write-Host "4. 关键依赖模块" -ForegroundColor White
Write-Host "   ─────────────────────────────────" -ForegroundColor DarkGray

$criticalModules = @("chalk", "typescript", "@anthropic-ai/sdk", "@sinclair/typebox", "zod")

foreach ($module in $criticalModules) {
    $modulePath = Join-Path $InstallDir "node_modules\$module"
    if (Test-Path $modulePath) {
        Write-Host "   ✅ $module" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $module - 缺失" -ForegroundColor Red
        $errors++
    }
}

# ============================================
# 结果汇总
# ============================================
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host " 验证结果" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "✅ 所有检查通过！安装完整。" -ForegroundColor Green
    exit 0
} elseif ($errors -eq 0) {
    Write-Host "⚠️  有 $warnings 个警告，但核心功能完整。" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "❌ 发现 $errors 个错误，$warnings 个警告" -ForegroundColor Red
    Write-Host ""
    Write-Host "建议操作:" -ForegroundColor Yellow
    Write-Host "  1. 重新运行安装程序" -ForegroundColor Yellow
    Write-Host "  2. 检查安装日志" -ForegroundColor Yellow
    Write-Host "  3. 联系技术支持" -ForegroundColor Yellow
    exit 1
}
