<#
.SYNOPSIS
  ClawdbotCN / OpenClawCN 全量卸载脚本 (Windows)

.DESCRIPTION
  彻底清除所有 ClawdbotCN / OpenClawCN 安装痕迹，包括：
    1. 停止并杀死所有相关进程
    2. 移除 Windows 计划任务 (Gateway + Node Service)
    3. 删除程序安装目录 (%LOCALAPPDATA%\ClawdbotCN)
    4. 删除 Tauri WebView2 数据 (%LOCALAPPDATA%\com.clawdbot.cn.desktop)
    5. 删除用户数据目录 (~\.openclawcn 及所有 legacy 目录)
    6. 删除 E:\openclawcn (开发/部署目录)
    7. 删除 Windows 临时文件中的 gateway 锁 + 修复隧道临时文件 + sidecar.log
    8. 清理注册表卸载项 (遗留的 Inno Setup / NSIS 项)
    9. 清除 Windows Defender 排除项
   10. 删除桌面/开始菜单快捷方式
   11. 清理用户 PATH 环境变量中的 ClawdbotCN 条目
   12. 删除 openclawcn.cmd CLI wrapper
   13. 清理 PowerShell Profile 中的自动补全残留

  运行后等于全新环境，下次安装不会有任何历史残留。

.PARAMETER DryRun
  预览模式：仅显示将要删除的内容，不实际执行删除。

.PARAMETER Force
  跳过确认提示，直接执行。

.PARAMETER KeepData
  保留用户数据 (~\.openclawcn)，只卸载应用程序。
  这是普通卸载模式，等同于 uninstall（非 full-uninstall）。

.EXAMPLE
  # 全量卸载（交互确认）
  .\full-uninstall.ps1

  # 全量卸载（跳过确认）
  .\full-uninstall.ps1 -Force

  # 预览模式
  .\full-uninstall.ps1 -DryRun

  # 普通卸载（保留用户数据）
  .\full-uninstall.ps1 -KeepData
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [switch]$Force,
    [switch]$KeepData
)

$ErrorActionPreference = "Continue"
$script:removedCount = 0
$script:failedCount = 0
$script:skippedCount = 0

# ── Helpers ──────────────────────────────────────────────────────────────

function Write-Header($text) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Write-Step($text) {
    Write-Host ""
    Write-Host "── $text ──" -ForegroundColor Yellow
}

function Remove-SafePath {
    param(
        [string]$Path,
        [string]$Label
    )
    if (-not $Path -or [string]::IsNullOrWhiteSpace($Path)) { return }

    $resolved = [System.IO.Path]::GetFullPath($Path)

    # Safety: never delete root, home, or system dirs
    $root = [System.IO.Path]::GetPathRoot($resolved)
    if ($resolved -eq $root) {
        Write-Host "  [SKIP] Refusing to delete root path: $resolved" -ForegroundColor Red
        $script:skippedCount++
        return
    }
    $home = $env:USERPROFILE
    if ($resolved -eq $home) {
        Write-Host "  [SKIP] Refusing to delete home directory: $resolved" -ForegroundColor Red
        $script:skippedCount++
        return
    }
    $blocked = @("C:\Windows", "C:\Program Files", "C:\Program Files (x86)", "C:\ProgramData")
    foreach ($b in $blocked) {
        if ($resolved.ToLower().StartsWith($b.ToLower())) {
            Write-Host "  [SKIP] Refusing to delete system path: $resolved" -ForegroundColor Red
            $script:skippedCount++
            return
        }
    }

    if (-not (Test-Path $resolved)) {
        Write-Host "  [--] $Label  (not found)" -ForegroundColor DarkGray
        return
    }

    if ($DryRun) {
        Write-Host "  [DRY] Would remove: $Label" -ForegroundColor Magenta
        Write-Host "        Path: $resolved" -ForegroundColor DarkGray
        $script:skippedCount++
        return
    }

    try {
        Remove-Item -Path $resolved -Recurse -Force -ErrorAction Stop
        Write-Host "  [OK] Removed: $Label" -ForegroundColor Green
        $script:removedCount++
    } catch {
        Write-Host "  [FAIL] $Label : $_" -ForegroundColor Red
        $script:failedCount++
    }
}

# ── Banner ───────────────────────────────────────────────────────────────

if ($KeepData) {
    Write-Header "ClawdbotCN 普通卸载 (保留用户数据)"
} else {
    Write-Header "ClawdbotCN 全量卸载 (Full Uninstall)"
    Write-Host ""
    Write-Host "  !! 警告: 此操作将删除所有数据，包括配置文件、会话记录、" -ForegroundColor Red
    Write-Host "     Agent 工作区、数据库等。操作不可恢复！" -ForegroundColor Red
}

if ($DryRun) {
    Write-Host ""
    Write-Host "  [预览模式] 不会实际删除任何文件" -ForegroundColor Magenta
}

# ── Confirmation ─────────────────────────────────────────────────────────

if (-not $Force -and -not $DryRun) {
    Write-Host ""
    $confirm = Read-Host "确定要继续吗？输入 YES 确认"
    if ($confirm -ne "YES") {
        Write-Host "已取消。" -ForegroundColor Yellow
        exit 0
    }
}

# ══════════════════════════════════════════════════════════════════════════
# Step 1: Kill all related processes
# ══════════════════════════════════════════════════════════════════════════

Write-Step "Step 1: 停止相关进程"

$processNames = @("ClawdbotCN", "clawdbot-desktop", "OpenClawCN", "clawdbot")

foreach ($proc in $processNames) {
    $running = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if ($running) {
        if ($DryRun) {
            Write-Host "  [DRY] Would kill process: $proc (PID: $($running.Id -join ', '))" -ForegroundColor Magenta
        } else {
            $running | Stop-Process -Force -ErrorAction SilentlyContinue
            Write-Host "  [OK] Killed: $proc" -ForegroundColor Green
        }
    } else {
        Write-Host "  [--] $proc not running" -ForegroundColor DarkGray
    }
}

# Kill node.exe from ClawdbotCN / OpenClawCN install dir
$nodeProcs = Get-Process -Name node -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and ($_.Path -match "ClawdbotCN" -or $_.Path -match "OpenClawCN" -or $_.Path -match "openclawcn") }
if ($nodeProcs) {
    if ($DryRun) {
        Write-Host "  [DRY] Would kill $($nodeProcs.Count) bundled node.exe process(es)" -ForegroundColor Magenta
    } else {
        $nodeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Killed $($nodeProcs.Count) bundled node.exe process(es)" -ForegroundColor Green
    }
}

# Kill gateway on port 18789
try {
    $gatewayConns = Get-NetTCPConnection -LocalPort 18789 -State Listen -ErrorAction SilentlyContinue
    if ($gatewayConns) {
        foreach ($conn in $gatewayConns) {
            if ($DryRun) {
                Write-Host "  [DRY] Would kill gateway process PID $($conn.OwningProcess) on port 18789" -ForegroundColor Magenta
            } else {
                Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
                Write-Host "  [OK] Killed gateway PID $($conn.OwningProcess) on port 18789" -ForegroundColor Green
            }
        }
    }
} catch {
    Write-Host "  [--] No gateway on port 18789" -ForegroundColor DarkGray
}

# Wait for file handles to release
if (-not $DryRun) {
    Write-Host "  等待文件句柄释放..." -ForegroundColor DarkGray
    Start-Sleep -Seconds 2
}

# ══════════════════════════════════════════════════════════════════════════
# Step 2: Remove Windows Scheduled Tasks
# ══════════════════════════════════════════════════════════════════════════

Write-Step "Step 2: 移除计划任务 (Gateway + Node Service)"

# Match: "OpenClawCN Gateway", "OpenClawCN Gateway (dev)", "OpenClawCN Gateway (work)", etc.
$taskPatterns = @("OpenClawCN Gateway*", "OpenClawCN Node*", "ClawdbotCN*")

foreach ($pattern in $taskPatterns) {
    try {
        $tasks = schtasks /Query /FO LIST 2>$null | Select-String "TaskName:" |
            ForEach-Object { ($_ -replace "^.*TaskName:\s*", "").Trim() } |
            Where-Object { $_ -like "*$($pattern.Replace('*',''))*" }

        if ($tasks) {
            foreach ($task in $tasks) {
                if ($DryRun) {
                    Write-Host "  [DRY] Would remove scheduled task: $task" -ForegroundColor Magenta
                } else {
                    schtasks /Delete /TN "$task" /F 2>$null | Out-Null
                    Write-Host "  [OK] Removed task: $task" -ForegroundColor Green
                    $script:removedCount++
                }
            }
        } else {
            Write-Host "  [--] No matching tasks for: $pattern" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "  [--] Could not query tasks: $_" -ForegroundColor DarkGray
    }
}

# ══════════════════════════════════════════════════════════════════════════
# Step 3: Remove application install directory
# ══════════════════════════════════════════════════════════════════════════

Write-Step "Step 3: 删除应用安装目录"

# Tauri NSIS default: %LOCALAPPDATA%\<productName>
$installDirs = @(
    "$env:LOCALAPPDATA\ClawdbotCN",
    "$env:LOCALAPPDATA\OpenClawCN",
    "$env:LOCALAPPDATA\Programs\ClawdbotCN",
    "$env:LOCALAPPDATA\Programs\OpenClawCN"
)

foreach ($dir in $installDirs) {
    Remove-SafePath -Path $dir -Label "安装目录: $dir"
}

# ══════════════════════════════════════════════════════════════════════════
# Step 4: Remove Tauri WebView2 data
# ══════════════════════════════════════════════════════════════════════════

Write-Step "Step 4: 删除 WebView2 数据"

$webviewDirs = @(
    "$env:LOCALAPPDATA\com.clawdbot.cn.desktop",
    "$env:LOCALAPPDATA\com.xiangdong.ai.desktop"
)

foreach ($dir in $webviewDirs) {
    Remove-SafePath -Path $dir -Label "WebView2 数据: $dir"
}

# ══════════════════════════════════════════════════════════════════════════
# Step 5: Remove user data directories (full uninstall only)
# ══════════════════════════════════════════════════════════════════════════

if (-not $KeepData) {
    Write-Step "Step 5: 删除用户数据目录"

    $home = $env:USERPROFILE

    # Current + all legacy state directories
    $stateDirs = @(
        "$home\.openclawcn",
        "$home\.clawdbotcn",
        "$home\.clawdbot",
        "$home\.moldbot",
        "$home\.moltbot"
    )

    # Also check for profile-suffixed directories: ~/.openclawcn-<profile>
    $profileDirs = Get-ChildItem -Path $home -Directory -Filter ".openclawcn-*" -ErrorAction SilentlyContinue
    if ($profileDirs) {
        foreach ($pd in $profileDirs) {
            $stateDirs += $pd.FullName
        }
    }

    foreach ($dir in $stateDirs) {
        Remove-SafePath -Path $dir -Label "用户数据: $dir"
    }

    # Default agent workspace
    $defaultWorkspace = "$home\clawd"
    if (Test-Path $defaultWorkspace) {
        Remove-SafePath -Path $defaultWorkspace -Label "Agent 工作区: $defaultWorkspace"
    }
} else {
    Write-Step "Step 5: 用户数据 (已跳过 - KeepData 模式)"
    Write-Host "  [SKIP] 保留用户数据目录" -ForegroundColor Yellow
}

# ══════════════════════════════════════════════════════════════════════════
# Step 6: Remove E:\openclawcn (dev/deploy directory)
# ══════════════════════════════════════════════════════════════════════════

if (-not $KeepData) {
    Write-Step "Step 6: 删除开发/部署目录"

    Remove-SafePath -Path "E:\openclawcn" -Label "开发/部署目录: E:\openclawcn"
} else {
    Write-Step "Step 6: 开发/部署目录 (已跳过 - KeepData 模式)"
}

# ══════════════════════════════════════════════════════════════════════════
# Step 7: Remove temp files (gateway locks)
# ══════════════════════════════════════════════════════════════════════════

Write-Step "Step 7: 清理临时文件"

$tempDir = [System.IO.Path]::GetTempPath()

# Gateway lock directories: %TEMP%\openclawcn*
$lockDirs = Get-ChildItem -Path $tempDir -Directory -Filter "openclawcn*" -ErrorAction SilentlyContinue
if ($lockDirs) {
    foreach ($ld in $lockDirs) {
        Remove-SafePath -Path $ld.FullName -Label "Gateway 锁: $($ld.Name)"
    }
} else {
    Write-Host "  [--] No gateway lock files in temp" -ForegroundColor DarkGray
}

# Repair tunnel temp directory: %TEMP%\clawdbot-repair
Remove-SafePath -Path "$tempDir\clawdbot-repair" -Label "修复隧道临时文件: clawdbot-repair"

# Sidecar log next to exe (Windows-specific: log sits beside the .exe)
$installDirCandidates = @(
    "$env:LOCALAPPDATA\ClawdbotCN",
    "$env:LOCALAPPDATA\OpenClawCN",
    "$env:LOCALAPPDATA\Programs\ClawdbotCN",
    "$env:LOCALAPPDATA\Programs\OpenClawCN"
)
foreach ($idir in $installDirCandidates) {
    $sidecarLog = "$idir\sidecar.log"
    if (Test-Path $sidecarLog) {
        Remove-SafePath -Path $sidecarLog -Label "Sidecar 日志: $sidecarLog"
    }
}

# ══════════════════════════════════════════════════════════════════════════
# Step 8: Clean up registry entries
# ══════════════════════════════════════════════════════════════════════════

Write-Step "Step 8: 清理注册表"

$regKeys = @(
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ClawdbotCN";       Label = "ClawdbotCN (current NSIS)" },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\OpenClawCN_is1";   Label = "OpenClawCN (old Inno Setup)" },
    @{ Path = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ClawdbotService_is1"; Label = "ClawdbotService (old)" },
    @{ Path = "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Clawdbot";         Label = "Clawdbot (old NSIS)" },
    @{ Path = "HKCU:\Software\xiangdong";                                                    Label = "OEM: xiangdong" },
    @{ Path = "HKCU:\Software\clawdbot";                                                     Label = "Vendor: clawdbot" }
)

foreach ($key in $regKeys) {
    if (Test-Path $key.Path) {
        if ($DryRun) {
            Write-Host "  [DRY] Would remove registry: $($key.Label)" -ForegroundColor Magenta
            Write-Host "        Key: $($key.Path)" -ForegroundColor DarkGray
        } else {
            try {
                Remove-Item -Path $key.Path -Recurse -Force -ErrorAction Stop
                Write-Host "  [OK] Removed registry: $($key.Label)" -ForegroundColor Green
                $script:removedCount++
            } catch {
                Write-Host "  [FAIL] Registry $($key.Label): $_" -ForegroundColor Red
                $script:failedCount++
            }
        }
    } else {
        Write-Host "  [--] $($key.Label)  (not found)" -ForegroundColor DarkGray
    }
}

# ══════════════════════════════════════════════════════════════════════════
# Step 9: Remove Windows Defender exclusion
# ══════════════════════════════════════════════════════════════════════════

Write-Step "Step 9: 清除 Windows Defender 排除项"

$defenderPaths = @(
    "$env:LOCALAPPDATA\ClawdbotCN",
    "$env:LOCALAPPDATA\OpenClawCN",
    "$env:LOCALAPPDATA\Programs\ClawdbotCN"
)

foreach ($dp in $defenderPaths) {
    try {
        $exclusions = (Get-MpPreference -ErrorAction SilentlyContinue).ExclusionPath
        if ($exclusions -and ($exclusions -contains $dp)) {
            if ($DryRun) {
                Write-Host "  [DRY] Would remove Defender exclusion: $dp" -ForegroundColor Magenta
            } else {
                Remove-MpPreference -ExclusionPath $dp -ErrorAction Stop
                Write-Host "  [OK] Removed Defender exclusion: $dp" -ForegroundColor Green
                $script:removedCount++
            }
        }
    } catch {
        Write-Host "  [--] Defender exclusion skip: $_" -ForegroundColor DarkGray
    }
}

# ══════════════════════════════════════════════════════════════════════════
# Step 10: Remove desktop/start menu shortcuts
# ══════════════════════════════════════════════════════════════════════════

Write-Step "Step 10: 删除快捷方式"

$shortcutLocations = @(
    "$env:USERPROFILE\Desktop",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
    "$env:ProgramData\Microsoft\Windows\Start Menu\Programs"
)

$shortcutNames = @("ClawdbotCN.lnk", "OpenClawCN.lnk", "ClawdbotCN - Shortcut.lnk")

foreach ($loc in $shortcutLocations) {
    foreach ($name in $shortcutNames) {
        $lnk = Join-Path $loc $name
        if (Test-Path $lnk) {
            if ($DryRun) {
                Write-Host "  [DRY] Would remove shortcut: $lnk" -ForegroundColor Magenta
            } else {
                Remove-Item -Path $lnk -Force -ErrorAction SilentlyContinue
                Write-Host "  [OK] Removed shortcut: $name (from $loc)" -ForegroundColor Green
                $script:removedCount++
            }
        }
    }
}

# ══════════════════════════════════════════════════════════════════════════
# Step 11: Clean PATH environment variable
# ══════════════════════════════════════════════════════════════════════════

Write-Step "Step 11: 清理 PATH 环境变量"

# POSTINSTALL hook adds $INSTDIR to HKCU:\Environment\Path
# We need to remove any ClawdbotCN/OpenClawCN entries
try {
    $regKey = "HKCU:\Environment"
    $curPath = (Get-ItemProperty -Path $regKey -Name Path -ErrorAction SilentlyContinue).Path
    if ($curPath) {
        $entries = $curPath -split ";" | Where-Object { $_ -ne "" }
        $cleanEntries = $entries | Where-Object {
            $_ -notmatch "ClawdbotCN" -and $_ -notmatch "OpenClawCN" -and $_ -notmatch "openclawcn"
        }
        $removedEntries = $entries | Where-Object {
            $_ -match "ClawdbotCN" -or $_ -match "OpenClawCN" -or $_ -match "openclawcn"
        }

        if ($removedEntries) {
            foreach ($re in $removedEntries) {
                if ($DryRun) {
                    Write-Host "  [DRY] Would remove from PATH: $re" -ForegroundColor Magenta
                } else {
                    Write-Host "  [OK] Removing from PATH: $re" -ForegroundColor Green
                    $script:removedCount++
                }
            }
            if (-not $DryRun) {
                $newPath = $cleanEntries -join ";"
                if ($newPath) {
                    Set-ItemProperty -Path $regKey -Name Path -Value $newPath -Type ExpandString
                } else {
                    Remove-ItemProperty -Path $regKey -Name Path -ErrorAction SilentlyContinue
                }

                # Broadcast WM_SETTINGCHANGE so open terminals refresh PATH
                try {
                    if (-not ([System.Management.Automation.PSTypeName]'Win32.NativePathMethods').Type) {
                        Add-Type -Namespace Win32 -Name NativePathMethods -MemberDefinition '
                            [DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
                            public static extern IntPtr SendMessageTimeout(
                                IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam,
                                uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);'
                    }
                    $HWND_BROADCAST = [IntPtr]0xffff
                    $WM_SETTINGCHANGE = 0x1a
                    $result = [UIntPtr]::Zero
                    [Win32.NativePathMethods]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [UIntPtr]::Zero, "Environment", 2, 5000, [ref]$result) | Out-Null
                    Write-Host "  [OK] 环境变量变更已广播" -ForegroundColor Green
                } catch {
                    Write-Host "  [--] 广播环境变量变更失败 (非关键): $_" -ForegroundColor DarkGray
                }
            }
        } else {
            Write-Host "  [--] PATH 中无 ClawdbotCN 相关条目" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  [--] 用户 PATH 为空" -ForegroundColor DarkGray
    }
} catch {
    Write-Host "  [FAIL] PATH 清理失败: $_" -ForegroundColor Red
    $script:failedCount++
}

# ══════════════════════════════════════════════════════════════════════════
# Step 12: Remove openclawcn.cmd CLI wrapper
# ══════════════════════════════════════════════════════════════════════════

Write-Step "Step 12: 删除 CLI wrapper"

foreach ($idir in $installDirCandidates) {
    $cmdWrapper = "$idir\openclawcn.cmd"
    if (Test-Path $cmdWrapper) {
        Remove-SafePath -Path $cmdWrapper -Label "CLI wrapper: $cmdWrapper"
    }
}

# ══════════════════════════════════════════════════════════════════════════
# Step 13: Clean up PowerShell profile completion residuals
# ══════════════════════════════════════════════════════════════════════════

Write-Step "Step 13: 清理 PowerShell 自动补全残留"

# The CLI `openclawcn completion --install` appends lines to the PowerShell profile:
#   # OpenClawCN Completion
#   source "~/.openclawcn/completions/openclawcn.ps1"
# The cache files are inside ~/.openclawcn (already deleted), but the profile
# lines remain and will cause errors on every new PowerShell session.

$psProfiles = @(
    "$env:USERPROFILE\Documents\PowerShell\Microsoft.PowerShell_profile.ps1",
    "$env:USERPROFILE\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1"
)

foreach ($prof in $psProfiles) {
    if (Test-Path $prof) {
        $content = Get-Content $prof -Raw -ErrorAction SilentlyContinue
        if ($content -and ($content -match "OpenClawCN Completion|openclawcn completion|openclawcn\.ps1")) {
            if ($DryRun) {
                Write-Host "  [DRY] Would clean completion lines from $prof" -ForegroundColor Magenta
            } else {
                try {
                    $lines = Get-Content $prof
                    $cleaned = $lines | Where-Object {
                        $_ -notmatch "# OpenClawCN Completion" -and
                        $_ -notmatch "openclawcn completion" -and
                        $_ -notmatch "openclawcn\.ps1" -and
                        $_ -notmatch "openclawcn\.zsh" -and
                        $_ -notmatch "openclawcn\.bash"
                    }
                    Set-Content -Path $prof -Value $cleaned -Encoding UTF8
                    Write-Host "  [OK] Cleaned completion lines from $prof" -ForegroundColor Green
                    $script:removedCount++
                } catch {
                    Write-Host "  [FAIL] Could not clean $prof : $_" -ForegroundColor Red
                    $script:failedCount++
                }
            }
        } else {
            Write-Host "  [--] No completion lines in $prof" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  [--] $prof  (not found)" -ForegroundColor DarkGray
    }
}

# ══════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  完成!" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "  [预览模式] 以上为将要执行的操作，未实际删除任何内容" -ForegroundColor Magenta
    Write-Host "  移除 -DryRun 参数以实际执行" -ForegroundColor Magenta
} else {
    Write-Host "  已删除: $($script:removedCount) 项" -ForegroundColor Green
    if ($script:failedCount -gt 0) {
        Write-Host "  失败:   $($script:failedCount) 项 (可能需要管理员权限)" -ForegroundColor Red
    }
    if ($script:skippedCount -gt 0) {
        Write-Host "  跳过:   $($script:skippedCount) 项" -ForegroundColor Yellow
    }

    Write-Host ""
    if ($KeepData) {
        Write-Host "  用户数据已保留在 ~\.openclawcn，下次安装可恢复配置。" -ForegroundColor Yellow
    } else {
        Write-Host "  所有数据已清除，下次安装将是全新环境。" -ForegroundColor Green
    }
}

Write-Host ""
