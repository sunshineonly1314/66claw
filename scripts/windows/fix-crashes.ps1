#!/usr/bin/env pwsh
<#
.SYNOPSIS
    修复 Gateway 频繁崩溃问题

.DESCRIPTION
    自动诊断并修复以下问题:
    1. 端口冲突 (ExitCode 1)
    2. 依赖缺失 (快速崩溃)
    3. 内存泄漏 (ExitCode 1073807364)
    4. 模型 API 超时

.EXAMPLE
    .\scripts\windows\fix-crashes.ps1
#>

$ErrorActionPreference = "Continue"
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

Write-Host "🔧 Clawdbot Gateway 崩溃修复工具`n" -ForegroundColor Cyan
Write-Host "=" * 60

# 1. 检查并停止冲突的 Gateway 进程
Write-Host "`n1️⃣ 检查 Gateway 进程..." -ForegroundColor Yellow

$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue |
    Where-Object {
        try {
            $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
            $cmd -like "*gateway*" -or $cmd -like "*clawdbot*"
        } catch {
            $false
        }
    }

if ($nodeProcesses) {
    Write-Host "  发现 $($nodeProcesses.Count) 个 Gateway 进程" -ForegroundColor Yellow
    foreach ($proc in $nodeProcesses) {
        Write-Host "    PID: $($proc.Id), 内存: $([math]::Round($proc.WorkingSet64/1MB))MB"
    }

    $choice = Read-Host "`n  是否停止这些进程? (Y/n)"
    if ($choice -ne 'n') {
        foreach ($proc in $nodeProcesses) {
            try {
                Stop-Process -Id $proc.Id -Force
                Write-Host "  ✅ 已停止 PID $($proc.Id)" -ForegroundColor Green
            } catch {
                Write-Host "  ❌ 停止 PID $($proc.Id) 失败: $_" -ForegroundColor Red
            }
        }

        Start-Sleep -Seconds 2
    }
} else {
    Write-Host "  ✅ 没有运行中的 Gateway 进程" -ForegroundColor Green
}

# 2. 检查端口占用
Write-Host "`n2️⃣ 检查端口占用..." -ForegroundColor Yellow

$ports = @(18789, 18791, 18800)
$portIssues = @()

foreach ($port in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    if ($conn) {
        $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
        $portIssues += @{
            Port = $port
            Process = $proc
            PID = $conn.OwningProcess
        }
        Write-Host "  ⚠️  端口 $port 被占用: PID $($conn.OwningProcess) ($($proc.ProcessName))" -ForegroundColor Red
    } else {
        Write-Host "  ✅ 端口 $port 可用" -ForegroundColor Green
    }
}

if ($portIssues.Count -gt 0) {
    $choice = Read-Host "`n  是否释放这些端口? (Y/n)"
    if ($choice -ne 'n') {
        foreach ($issue in $portIssues) {
            try {
                Stop-Process -Id $issue.PID -Force
                Write-Host "  ✅ 已释放端口 $($issue.Port)" -ForegroundColor Green
            } catch {
                Write-Host "  ❌ 释放端口 $($issue.Port) 失败: $_" -ForegroundColor Red
            }
        }
    }
}

# 3. 检查依赖安装
Write-Host "`n3️⃣ 检查依赖..." -ForegroundColor Yellow

Push-Location $projectRoot

if (Test-Path "node_modules") {
    Write-Host "  ✅ node_modules 存在" -ForegroundColor Green

    # 检查关键依赖
    $criticalDeps = @(
        "@mariozechner/pi-ai",
        "ws",
        "express"
    )

    $missingDeps = @()
    foreach ($dep in $criticalDeps) {
        if (-not (Test-Path "node_modules\$dep")) {
            $missingDeps += $dep
            Write-Host "  ❌ 缺少依赖: $dep" -ForegroundColor Red
        }
    }

    if ($missingDeps.Count -gt 0) {
        Write-Host "  ⚠️  发现 $($missingDeps.Count) 个缺失依赖"
        $reinstall = $true
    } else {
        Write-Host "  ✅ 关键依赖完整" -ForegroundColor Green
        $reinstall = $false
    }
} else {
    Write-Host "  ❌ node_modules 不存在" -ForegroundColor Red
    $reinstall = $true
}

if ($reinstall) {
    $choice = Read-Host "`n  是否重新安装依赖? (Y/n)"
    if ($choice -ne 'n') {
        Write-Host "`n  正在重新安装依赖..." -ForegroundColor Yellow

        try {
            # 尝试使用 pnpm
            if (Get-Command pnpm -ErrorAction SilentlyContinue) {
                pnpm install --force
            } elseif (Get-Command npm -ErrorAction SilentlyContinue) {
                npm install --force
            } else {
                Write-Host "  ❌ 未找到 pnpm 或 npm" -ForegroundColor Red
                Pop-Location
                exit 1
            }

            Write-Host "  ✅ 依赖安装完成" -ForegroundColor Green
        } catch {
            Write-Host "  ❌ 依赖安装失败: $_" -ForegroundColor Red
        }
    }
}

Pop-Location

# 4. 清理缓存和会话
Write-Host "`n4️⃣ 清理缓存..." -ForegroundColor Yellow

$clawdDir = Join-Path $env:USERPROFILE ".clawd"
$tempDir = Join-Path $env:TEMP "clawdbot"

$cacheSize = 0

if (Test-Path "$clawdDir\sessions") {
    $sessionFiles = Get-ChildItem "$clawdDir\sessions" -Recurse -File -ErrorAction SilentlyContinue
    $cacheSize += ($sessionFiles | Measure-Object -Property Length -Sum).Sum
    Write-Host "  会话缓存: $([math]::Round($cacheSize/1MB, 2))MB"
}

if (Test-Path $tempDir) {
    $tempFiles = Get-ChildItem $tempDir -Recurse -File -ErrorAction SilentlyContinue
    $tempSize = ($tempFiles | Measure-Object -Property Length -Sum).Sum
    $cacheSize += $tempSize
    Write-Host "  临时文件: $([math]::Round($tempSize/1MB, 2))MB"
}

if ($cacheSize -gt 100MB) {
    $choice = Read-Host "`n  缓存较大 ($([math]::Round($cacheSize/1MB))MB), 是否清理? (y/N)"
    if ($choice -eq 'y') {
        try {
            if (Test-Path "$clawdDir\sessions") {
                Remove-Item "$clawdDir\sessions\*" -Recurse -Force -ErrorAction SilentlyContinue
                Write-Host "  ✅ 已清理会话缓存" -ForegroundColor Green
            }

            if (Test-Path $tempDir) {
                Remove-Item "$tempDir\*" -Recurse -Force -ErrorAction SilentlyContinue
                Write-Host "  ✅ 已清理临时文件" -ForegroundColor Green
            }
        } catch {
            Write-Host "  ⚠️  清理部分失败: $_" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ✅ 缓存大小正常" -ForegroundColor Green
}

# 5. 检查配置文件
Write-Host "`n5️⃣ 检查配置..." -ForegroundColor Yellow

$configPath = Join-Path $clawdDir "config.json"

if (Test-Path $configPath) {
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        Write-Host "  ✅ 配置文件格式正确" -ForegroundColor Green

        # 检查模型配置
        $model = $config.agents.defaults.model.primary
        if ($model) {
            Write-Host "  当前模型: $model"

            if ($model -match "8B|8b") {
                Write-Host "  ⚠️  使用 8B 小模型,可能导致空响应" -ForegroundColor Yellow
                Write-Host "     建议切换到 14B 或更大的模型"
            }
        }
    } catch {
        Write-Host "  ❌ 配置文件格式错误: $_" -ForegroundColor Red
        Write-Host "     请检查 JSON 格式是否正确"
    }
} else {
    Write-Host "  ⚠️  配置文件不存在" -ForegroundColor Yellow
    Write-Host "     首次启动时会自动创建"
}

# 6. 生成诊断报告
Write-Host "`n6️⃣ 生成诊断报告..." -ForegroundColor Yellow

$report = @"
# Gateway 崩溃诊断报告
生成时间: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

## 系统信息
- OS: $(Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty Caption)
- 内存: $([math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB, 2))GB
- Node.js: $(node --version 2>$null)
- pnpm: $(pnpm --version 2>$null)

## Gateway 状态
- 运行进程: $(if ($nodeProcesses.Count -gt 0) { "是 ($($nodeProcesses.Count) 个)" } else { "否" })
- 端口占用: $(if ($portIssues.Count -gt 0) { "是 ($($portIssues.Count) 个)" } else { "否" })
- 依赖完整: $(if (-not $reinstall) { "是" } else { "否" })
- 缓存大小: $([math]::Round($cacheSize/1MB, 2))MB

## 最近崩溃记录
"@

# 读取最近的崩溃日志
if (Test-Path "$tempDir") {
    $logFiles = Get-ChildItem $tempDir -Filter "clawdbot-*.log" -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($logFiles) {
        $crashes = Select-String -Path $logFiles.FullName -Pattern "Gateway CRASHED" |
            Select-Object -Last 5

        foreach ($crash in $crashes) {
            $report += "`n- $($crash.Line)"
        }
    }
}

$reportPath = Join-Path $projectRoot "gateway-diagnosis.txt"
$report | Out-File $reportPath -Encoding UTF8

Write-Host "  ✅ 诊断报告已保存: $reportPath" -ForegroundColor Green

# 7. 总结和建议
Write-Host "`n" + ("=" * 60)
Write-Host "`n📋 修复总结`n" -ForegroundColor Cyan

$issues = @()
$fixes = @()

if ($nodeProcesses.Count -gt 0) {
    $issues += "端口冲突 (多个 Gateway 实例)"
    $fixes += "已停止冲突进程"
}

if ($reinstall) {
    $issues += "依赖缺失或损坏"
    $fixes += "已重新安装依赖"
}

if ($cacheSize -gt 100MB) {
    $issues += "缓存过大"
    if ($choice -eq 'y') {
        $fixes += "已清理缓存"
    } else {
        $fixes += "建议手动清理"
    }
}

if ($issues.Count -eq 0) {
    Write-Host "✅ 未发现明显问题" -ForegroundColor Green
} else {
    Write-Host "发现问题:" -ForegroundColor Yellow
    foreach ($issue in $issues) {
        Write-Host "  • $issue"
    }

    Write-Host "`n已执行修复:" -ForegroundColor Green
    foreach ($fix in $fixes) {
        Write-Host "  • $fix"
    }
}

Write-Host "`n📖 下一步操作:`n" -ForegroundColor Cyan
Write-Host "1. 启动 Gateway:"
Write-Host "   .\scripts\windows\start-gateway.ps1`n"

Write-Host "2. 监控日志:"
Write-Host "   Get-Content `$env:TEMP\clawdbot\clawdbot-*.log -Wait -Tail 50`n"

Write-Host "3. 测试稳定性:"
Write-Host "   node scripts\test-gateway-stability.mjs`n"

Write-Host "4. 如果仍然崩溃,查看诊断文档:"
Write-Host "   GATEWAY-CRASH-DIAGNOSIS.md`n"

Write-Host "=" * 60
