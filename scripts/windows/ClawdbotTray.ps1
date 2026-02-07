# ClawdbotCN 中文AI 系统托盘应用 - Windows Native 版本
# 显示 Gateway 运行状态，提供快捷操作菜单
#
# 功能：
# - 系统托盘图标显示 Gateway 运行状态
# - 右键菜单：启动/停止/重启/打开控制台
# - 状态变化时气球通知
# - 双击打开 Web 控制台

[CmdletBinding()]
param(
    [int]$CheckInterval = 5  # 状态检查间隔（秒）
)

$ErrorActionPreference = "Continue"

# ============================================
# 配置
# ============================================
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallDir = $ScriptDir
$Port = 18789
$BaseUrl = "http://localhost:$Port"
$ConfigFile = Join-Path $env:USERPROFILE ".clawdbot\clawdbot.json"

# 日志配置
$TrayLogDir = Join-Path $InstallDir "logs"
$TrayLogFile = Join-Path $TrayLogDir "tray.log"

# ============================================
# 日志函数
# ============================================
function Write-TrayLog {
    param([string]$Message)
    try {
        if (-not (Test-Path $TrayLogDir)) {
            New-Item -ItemType Directory -Path $TrayLogDir -Force | Out-Null
        }
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Add-Content -Path $TrayLogFile -Value "[$timestamp] $Message" -Encoding UTF8
    } catch {}
}

Write-TrayLog "========== ClawdbotCN 托盘应用启动 =========="

# ============================================
# 加载 Windows Forms
# ============================================
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    Write-TrayLog "Windows Forms 加载成功"
} catch {
    Write-TrayLog "Windows Forms 加载失败: $_"
    exit 1
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ============================================
# 多实例检测
# ============================================
$mutexName = "Global\ClawdbotCNTrayMutex"
$mutex = $null
try {
    $mutex = [System.Threading.Mutex]::OpenExisting($mutexName)
    Write-TrayLog "检测到已有实例运行，退出"
    exit 0
} catch {
    $mutex = New-Object System.Threading.Mutex($true, $mutexName)
}

# ============================================
# 状态检测函数
# ============================================

function Test-PortListening {
    try {
        $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        return $connection -ne $null
    } catch {
        return $false
    }
}

function Test-GatewayReady {
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
        return ($response.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Get-GatewayStatus {
    $portListening = Test-PortListening
    $gatewayReady = $false
    
    if ($portListening) {
        $gatewayReady = Test-GatewayReady
    }
    
    if ($gatewayReady) {
        return @{
            Status = "Running"
            StatusText = "运行中"
            Color = "Green"
            PortListening = $portListening
        }
    } elseif ($portListening) {
        return @{
            Status = "Starting"
            StatusText = "启动中"
            Color = "Yellow"
            PortListening = $portListening
        }
    } else {
        return @{
            Status = "Stopped"
            StatusText = "已停止"
            Color = "Red"
            PortListening = $portListening
        }
    }
}

# ============================================
# 操作函数
# ============================================

function Start-Gateway {
    Write-TrayLog "启动 Gateway..."
    
    $startScript = Join-Path $InstallDir "start-gateway.bat"
    
    if (-not (Test-Path $startScript)) {
        Write-TrayLog "启动脚本未找到: $startScript"
        return
    }
    
    # 调用启动脚本（它会设置所有必要的环境变量）
    Start-Process cmd -ArgumentList "/c", "`"$startScript`"" -WindowStyle Hidden -WorkingDirectory $InstallDir
    
    Write-TrayLog "Gateway 启动命令已发送"
}

function Stop-Gateway {
    Write-TrayLog "停止 Gateway..."
    
    # 查找并停止 Gateway 进程
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
        $_.MainWindowTitle -match "Clawdbot" -or $_.Path -match "Clawdbot"
    } | Stop-Process -Force -ErrorAction SilentlyContinue
    
    # 也停止监听 18789 端口的进程
    try {
        $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($conn) {
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    } catch {}
    
    Write-TrayLog "Gateway 停止命令已发送"
}

function Restart-Gateway {
    Write-TrayLog "重启 Gateway..."
    Stop-Gateway
    Start-Sleep -Seconds 2
    Start-Gateway
}

function Open-WebUI {
    # Token 用于认证
    $token = "clawdbot2026"
    
    # 检查是否已配置
    if (Test-Path $ConfigFile) {
        $content = Get-Content $ConfigFile -Raw -ErrorAction SilentlyContinue
        if ($content -match '"apiKey"' -or $content -match '"models"') {
            # 已配置，打开主页带 token
            $openUrl = "$BaseUrl/?token=$token"
        } else {
            # 未配置，打开 setup 页面（setup 页面会自动获取 token）
            $openUrl = "$BaseUrl/setup"
        }
    } else {
        # 配置文件不存在，打开 setup
        $openUrl = "$BaseUrl/setup"
    }
    
    Write-TrayLog "打开控制台: $openUrl"
    Start-Process $openUrl
}

function Open-LogViewer {
    $logDir = Join-Path $InstallDir "logs"
    if (Test-Path $logDir) {
        Start-Process explorer.exe -ArgumentList $logDir
    } else {
        [System.Windows.Forms.MessageBox]::Show("日志目录不存在", "提示", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
    }
}

function Copy-ErrorInfo {
    $status = Get-GatewayStatus
    
    $errorInfo = @"
ClawdbotCN 状态报告
时间: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
状态: $($status.StatusText)
端口监听: $($status.PortListening)
安装目录: $InstallDir
配置文件: $ConfigFile
"@
    
    Set-Clipboard -Value $errorInfo
    [System.Windows.Forms.MessageBox]::Show("状态信息已复制到剪贴板！`n`n请发送给客服协助解决。", "已复制", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
}

# ============================================
# 创建托盘图标
# ============================================

$IconPath = Join-Path $InstallDir "clawdbot.ico"
$icon = $null

if (Test-Path $IconPath) {
    try {
        $icon = New-Object System.Drawing.Icon($IconPath)
        Write-TrayLog "自定义图标加载成功"
    } catch {
        Write-TrayLog "自定义图标加载失败: $_"
        $icon = [System.Drawing.SystemIcons]::Application
    }
} else {
    Write-TrayLog "使用系统图标 (未找到: $IconPath)"
    $icon = [System.Drawing.SystemIcons]::Application
}

try {
    $notifyIcon = New-Object System.Windows.Forms.NotifyIcon
    $notifyIcon.Icon = $icon
    $notifyIcon.Text = "ClawdbotCN - 检查中..."
    $notifyIcon.Visible = $true
    Write-TrayLog "托盘图标创建成功"
} catch {
    Write-TrayLog "托盘图标创建失败: $_"
    exit 1
}

# ============================================
# 创建右键菜单
# ============================================
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

# 打开控制台（放在最上面，最常用）
$menuWebUI = New-Object System.Windows.Forms.ToolStripMenuItem
$menuWebUI.Text = "打开控制台"
$menuWebUI.Font = New-Object System.Drawing.Font($menuWebUI.Font, [System.Drawing.FontStyle]::Bold)
$menuWebUI.Add_Click({ Open-WebUI })
$contextMenu.Items.Add($menuWebUI) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# 状态显示
$menuStatus = New-Object System.Windows.Forms.ToolStripMenuItem
$menuStatus.Text = "状态: 检查中..."
$menuStatus.Enabled = $false
$contextMenu.Items.Add($menuStatus) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# 启动
$menuStart = New-Object System.Windows.Forms.ToolStripMenuItem
$menuStart.Text = "启动服务"
$menuStart.Add_Click({
    $menuStatus.Text = "状态: 启动中..."
    $notifyIcon.Text = "ClawdbotCN - 启动中..."
    Start-Gateway
    $notifyIcon.ShowBalloonTip(2000, "ClawdbotCN 中文AI", "正在启动服务...", [System.Windows.Forms.ToolTipIcon]::Info)
})
$contextMenu.Items.Add($menuStart) | Out-Null

# 停止
$menuStop = New-Object System.Windows.Forms.ToolStripMenuItem
$menuStop.Text = "停止服务"
$menuStop.Add_Click({
    $menuStatus.Text = "状态: 停止中..."
    $notifyIcon.Text = "ClawdbotCN - 停止中..."
    Stop-Gateway
    $notifyIcon.ShowBalloonTip(2000, "ClawdbotCN 中文AI", "服务已停止", [System.Windows.Forms.ToolTipIcon]::Info)
})
$contextMenu.Items.Add($menuStop) | Out-Null

# 重启
$menuRestart = New-Object System.Windows.Forms.ToolStripMenuItem
$menuRestart.Text = "重启服务"
$menuRestart.Add_Click({
    $menuStatus.Text = "状态: 重启中..."
    $notifyIcon.Text = "ClawdbotCN - 重启中..."
    $notifyIcon.ShowBalloonTip(2000, "ClawdbotCN 中文AI", "正在重启服务...", [System.Windows.Forms.ToolTipIcon]::Info)
    Restart-Gateway
})
$contextMenu.Items.Add($menuRestart) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# 帮助子菜单
$menuHelp = New-Object System.Windows.Forms.ToolStripMenuItem
$menuHelp.Text = "帮助"

$menuViewLogs = New-Object System.Windows.Forms.ToolStripMenuItem
$menuViewLogs.Text = "查看日志"
$menuViewLogs.Add_Click({ Open-LogViewer })
$menuHelp.DropDownItems.Add($menuViewLogs) | Out-Null

$menuCopyError = New-Object System.Windows.Forms.ToolStripMenuItem
$menuCopyError.Text = "复制状态信息"
$menuCopyError.Add_Click({ Copy-ErrorInfo })
$menuHelp.DropDownItems.Add($menuCopyError) | Out-Null

$contextMenu.Items.Add($menuHelp) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# 退出
$menuExit = New-Object System.Windows.Forms.ToolStripMenuItem
$menuExit.Text = "退出托盘程序"
$menuExit.Add_Click({
    $timer.Stop()
    $timer.Dispose()
    $notifyIcon.Visible = $false
    $notifyIcon.Dispose()
    if ($mutex) {
        $mutex.ReleaseMutex()
        $mutex.Dispose()
    }
    [System.Windows.Forms.Application]::Exit()
})
$contextMenu.Items.Add($menuExit) | Out-Null

$notifyIcon.ContextMenuStrip = $contextMenu

# ============================================
# 双击事件
# ============================================
$notifyIcon.Add_DoubleClick({ Open-WebUI })

# ============================================
# 状态监控定时器
# ============================================
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = $CheckInterval * 1000

$script:lastStatus = $null

$timer.Add_Tick({
    $status = Get-GatewayStatus
    
    # 更新状态显示
    $menuStatus.Text = "状态: $($status.StatusText)"
    
    $trayText = "ClawdbotCN - $($status.StatusText)"
    if ($trayText.Length -gt 63) {
        $trayText = $trayText.Substring(0, 60) + "..."
    }
    $notifyIcon.Text = $trayText
    
    # 更新菜单状态
    switch ($status.Status) {
        "Running" {
            $menuStart.Enabled = $false
            $menuStop.Enabled = $true
            $menuRestart.Enabled = $true
            $menuWebUI.Enabled = $true
        }
        "Starting" {
            $menuStart.Enabled = $false
            $menuStop.Enabled = $true
            $menuRestart.Enabled = $true
            $menuWebUI.Enabled = $false
        }
        default {
            $menuStart.Enabled = $true
            $menuStop.Enabled = $false
            $menuRestart.Enabled = $false
            $menuWebUI.Enabled = $false
        }
    }
    
    # 状态变化通知
    if ($null -ne $script:lastStatus -and $script:lastStatus.Status -ne $status.Status) {
        if ($status.Status -eq "Running") {
            $notifyIcon.ShowBalloonTip(3000, "ClawdbotCN 中文AI", "服务已启动`n双击托盘图标打开控制台", [System.Windows.Forms.ToolTipIcon]::Info)
        } elseif ($status.Status -eq "Stopped" -and $script:lastStatus.Status -eq "Running") {
            # Gateway 崩溃了，显示更明确的提示
            $notifyIcon.ShowBalloonTip(5000, "ClawdbotCN 中文AI", "服务异常停止！`n守护进程正在尝试自动恢复...`n如长时间未恢复，请右键重启", [System.Windows.Forms.ToolTipIcon]::Warning)
            Write-TrayLog "Gateway crashed! Watchdog should auto-restart."
        }
    }
    
    $script:lastStatus = $status
})

$timer.Start()
Write-TrayLog "状态监控定时器已启动"

# ============================================
# 初始状态检查并自动启动
# ============================================
Write-TrayLog "检查 Gateway 状态..."
$initialStatus = Get-GatewayStatus

if ($initialStatus.Status -eq "Running") {
    Write-TrayLog "Gateway 已在运行"
    $notifyIcon.ShowBalloonTip(2000, "ClawdbotCN 中文AI", "托盘应用已启动`n服务运行中", [System.Windows.Forms.ToolTipIcon]::Info)
} else {
    Write-TrayLog "Gateway 未运行，自动启动..."
    $notifyIcon.ShowBalloonTip(2000, "ClawdbotCN 中文AI", "正在启动服务...", [System.Windows.Forms.ToolTipIcon]::Info)
    
    # 自动启动 Gateway
    Start-Gateway
    
    # 等待启动完成 (最多 30 秒)
    $waitCount = 0
    $maxWait = 15
    while ($waitCount -lt $maxWait) {
        Start-Sleep -Seconds 2
        $waitCount++
        $checkStatus = Get-GatewayStatus
        if ($checkStatus.Status -eq "Running") {
            Write-TrayLog "Gateway 启动成功，用时 $($waitCount * 2) 秒"
            $notifyIcon.ShowBalloonTip(3000, "ClawdbotCN 中文AI", "服务已启动`n双击托盘图标打开控制台", [System.Windows.Forms.ToolTipIcon]::Info)
            break
        }
        Write-TrayLog "等待 Gateway 启动... ($waitCount/$maxWait)"
    }
    
    if ($waitCount -ge $maxWait) {
        Write-TrayLog "Gateway 启动超时"
        $notifyIcon.ShowBalloonTip(5000, "ClawdbotCN 中文AI", "服务启动超时`n请右键选择'启动服务'重试", [System.Windows.Forms.ToolTipIcon]::Warning)
    }
    
    # 更新状态
    $initialStatus = Get-GatewayStatus
}

$script:lastStatus = $initialStatus

# ============================================
# 运行消息循环
# ============================================
Write-TrayLog "开始运行消息循环..."
try {
    [System.Windows.Forms.Application]::Run()
} catch {
    Write-TrayLog "消息循环异常: $_"
} finally {
    Write-TrayLog "托盘应用已退出"
}
