# Clawdbot Bundled Skills 打包脚本
# 
# 功能：
# 1. 复制所有 CN 镜像 Skills 到输出目录
# 2. 生成 skills-index.json 索引文件
# 3. 统计打包信息
#
# 用法：
#   .\scripts\windows\package-bundled-skills.ps1 [-OutputDir <path>] [-SourceDir <path>]

# 设置 UTF-8 编码，避免中文乱码
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

param(
    [string]$OutputDir = "build\bundled-skills",
    [string]$SourceDir = "clawdhub-skills-mirror\cn\skills",
    [switch]$SkipCopy,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "`n🔧 Clawdbot Bundled Skills 打包工具`n" -ForegroundColor Cyan

# 获取项目根目录
$RootDir = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$FullSourceDir = Join-Path $RootDir $SourceDir
$FullOutputDir = Join-Path $RootDir $OutputDir
$SkillsOutputDir = Join-Path $FullOutputDir "skills"

# 检查源目录
if (-not (Test-Path $FullSourceDir)) {
    Write-Host "❌ 源目录不存在: $FullSourceDir" -ForegroundColor Red
    exit 1
}

Write-Host "📂 源目录: $FullSourceDir"
Write-Host "📦 输出目录: $FullOutputDir`n"

# Step 1: 清理并创建输出目录
if (-not $SkipCopy) {
    Write-Host "🗑️  清理输出目录..." -ForegroundColor Yellow
    if (Test-Path $FullOutputDir) {
        Remove-Item -Path $FullOutputDir -Recurse -Force
    }
    New-Item -Path $SkillsOutputDir -ItemType Directory -Force | Out-Null
}

# Step 2: 复制 Skills 文件
if (-not $SkipCopy) {
    Write-Host "📋 复制 Skills 文件..." -ForegroundColor Yellow
    
    $skillDirs = Get-ChildItem -Path $FullSourceDir -Directory
    $copiedCount = 0
    
    foreach ($dir in $skillDirs) {
        $skillMdPath = Join-Path $dir.FullName "SKILL.md"
        $skillMdPathLower = Join-Path $dir.FullName "skill.md"
        
        if ((Test-Path $skillMdPath) -or (Test-Path $skillMdPathLower)) {
            $destPath = Join-Path $SkillsOutputDir $dir.Name
            Copy-Item -Path $dir.FullName -Destination $destPath -Recurse
            $copiedCount++
            
            if ($Verbose) {
                Write-Host "  ✅ $($dir.Name)" -ForegroundColor Green
            }
        } else {
            if ($Verbose) {
                Write-Host "  ⚠️  跳过 $($dir.Name) (无 SKILL.md)" -ForegroundColor Yellow
            }
        }
    }
    
    Write-Host "   复制了 $copiedCount 个 Skills`n" -ForegroundColor Green
}

# Step 3: 生成索引文件
Write-Host "📝 生成索引文件..." -ForegroundColor Yellow

$indexScript = Join-Path $RootDir "scripts\generate-bundled-skills-index.mjs"
$indexOutput = Join-Path $FullOutputDir "skills-index.json"

if (Test-Path $indexScript) {
    & node $indexScript --source $SkillsOutputDir --output $indexOutput
} else {
    Write-Host "❌ 索引生成脚本不存在: $indexScript" -ForegroundColor Red
    exit 1
}

# Step 4: 统计信息
Write-Host "`n📊 打包统计:" -ForegroundColor Cyan

$skillCount = (Get-ChildItem $SkillsOutputDir -Directory).Count
$totalSize = (Get-ChildItem $FullOutputDir -Recurse | Measure-Object -Property Length -Sum).Sum
$totalSizeMB = [math]::Round($totalSize / 1MB, 2)

Write-Host "   Skills 数量: $skillCount"
Write-Host "   总大小: $totalSizeMB MB"
Write-Host "   输出目录: $FullOutputDir"

# 列出最大的 Skills
Write-Host "`n📦 最大的 Skills:" -ForegroundColor Cyan
Get-ChildItem $SkillsOutputDir -Directory | ForEach-Object {
    $size = (Get-ChildItem $_.FullName -Recurse | Measure-Object -Property Length -Sum).Sum
    [PSCustomObject]@{
        Name = $_.Name
        SizeKB = [math]::Round($size / 1KB, 1)
    }
} | Sort-Object SizeKB -Descending | Select-Object -First 10 | ForEach-Object {
    Write-Host "   $($_.Name): $($_.SizeKB) KB"
}

Write-Host "`n✅ 打包完成!`n" -ForegroundColor Green
Write-Host "💡 下一步:" -ForegroundColor Yellow
Write-Host "   1. 在安装程序中包含 $FullOutputDir 目录"
Write-Host "   2. 安装时设置 CLAWDBOT_BUNDLED_SKILLS_DIR 环境变量"
Write-Host "   3. 将 skills-index.json 复制到用户目录 (~/.clawdbot/)"
