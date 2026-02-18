# ============================================================================
# OpenClawCN 企业微信自动安装脚本
# ============================================================================
# 使用方法：
# 1. 以管理员身份打开 PowerShell
# 2. 运行: powershell -ExecutionPolicy Bypass -File install-openclawcn-wecom.ps1
# ============================================================================

param(
    [string]$InstallPath = "D:\OpenClawCN",
    [string]$SetupExePath = "E:\clawdbuild\ClawdbotCN-Full-Setup-2026.2.0-x64.exe"
)

# 颜色输出函数
function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-Step {
    param([string]$Message)
    Write-ColorOutput "`n===> $Message" "Cyan"
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[√] $Message" "Green"
}

function Write-Error-Custom {
    param([string]$Message)
    Write-ColorOutput "[×] $Message" "Red"
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput "[i] $Message" "Yellow"
}

# ============================================================================
# 步骤 1：检查系统环境
# ============================================================================
Write-Step "步骤 1/7: 检查系统环境"

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error-Custom "需要管理员权限！请右键点击 PowerShell，选择'以管理员身份运行'"
    pause
    exit 1
}
Write-Success "管理员权限检查通过"

# 检查安装包
if (-not (Test-Path $SetupExePath)) {
    Write-Error-Custom "找不到安装包: $SetupExePath"
    Write-Info "请确认安装包路径是否正确"
    pause
    exit 1
}
Write-Success "找到安装包: $SetupExePath"

# ============================================================================
# 步骤 2：安装 OpenClawCN
# ============================================================================
Write-Step "步骤 2/7: 安装 OpenClawCN 到 $InstallPath"

if (Test-Path $InstallPath) {
    Write-Info "安装目录已存在，将进行覆盖安装"
}

Write-Info "开始安装（这可能需要 2-5 分钟）..."

# 静默安装
$installArgs = "/S /D=$InstallPath"
$process = Start-Process -FilePath $SetupExePath -ArgumentList $installArgs -Wait -PassThru

if ($process.ExitCode -ne 0) {
    Write-Error-Custom "安装失败，退出代码: $($process.ExitCode)"
    pause
    exit 1
}

Write-Success "OpenClawCN 安装完成"

# 验证安装
$exePath = Join-Path $InstallPath "openclawcn.exe"
if (-not (Test-Path $exePath)) {
    Write-Error-Custom "未找到可执行文件: $exePath"
    pause
    exit 1
}

# 获取版本
$version = & $exePath --version 2>&1
Write-Success "版本: $version"

# ============================================================================
# 步骤 3：收集企业微信配置信息
# ============================================================================
Write-Step "步骤 3/7: 收集企业微信配置信息"

Write-Info "请准备以下信息（可在企业微信管理后台获取）："
Write-Host ""

# 企业 ID
Write-Host "1. 企业 ID (corpId) - 在'我的企业'页面底部" -ForegroundColor Yellow
$corpId = Read-Host "   请输入企业 ID"

# AgentId
Write-Host "`n2. 应用 AgentId - 在自建应用详情页" -ForegroundColor Yellow
$agentId = Read-Host "   请输入 AgentId (纯数字)"

# Secret
Write-Host "`n3. 应用 Secret - 在自建应用详情页，点击'查看'" -ForegroundColor Yellow
$agentSecret = Read-Host "   请输入 Secret"

# 大模型 API Key
Write-Host "`n4. 大模型 API Key" -ForegroundColor Yellow
Write-Host "   支持: 通义千问/DeepSeek/智谱GLM 等" -ForegroundColor Gray
Write-Host "   如果还没申请，可以先留空，稍后手动配置" -ForegroundColor Gray
$apiKey = Read-Host "   请输入 API Key (可留空)"

if ([string]::IsNullOrWhiteSpace($apiKey)) {
    $apiKey = "YOUR_API_KEY_HERE"
    Write-Info "API Key 未填写，请稍后手动编辑配置文件"
}

Write-Success "配置信息收集完成"

# ============================================================================
# 步骤 4：创建配置文件
# ============================================================================
Write-Step "步骤 4/7: 创建配置文件"

$configDir = Join-Path $env:USERPROFILE ".openclawcn"
$configFile = Join-Path $configDir "config.json5"

# 创建目录
if (-not (Test-Path $configDir)) {
    New-Item -ItemType Directory -Force -Path $configDir | Out-Null
    Write-Success "创建配置目录: $configDir"
}

# 生成配置内容
$configContent = @"
{
  // ============================================================================
  // OpenClawCN 企业微信配置
  // 自动生成时间: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
  // ============================================================================

  gateway: {
    bind: "loopback",
    port: 18789,
  },

  channels: {
    wecom: {
      enabled: true,

      app: {
        corpId: "$corpId",
        agentId: $agentId,
        agentSecret: "$agentSecret",
        token: "",
        encodingAESKey: ""
      },

      dmPolicy: "open",
      groupPolicy: "allowlist",
      requireMention: true,
      webhookPath: "/wecom/webhook"
    }
  },

  models: {
    mode: "merge",
    providers: {
      "qwen-dashscope": {
        baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        apiKey: "$apiKey",
        api: "openai-completions",
        models: [
          {
            id: "qwen-max",
            name: "通义千问 Max",
            reasoning: false,
            input: ["text"],
            contextWindow: 32000,
            maxTokens: 8192,
          }
        ]
      }
    }
  },

  agent: {
    model: "qwen-max"
  }
}
"@

# 写入配置文件
$configContent | Out-File -FilePath $configFile -Encoding utf8 -Force
Write-Success "配置文件已创建: $configFile"

# ============================================================================
# 步骤 5：下载并配置 Ngrok
# ============================================================================
Write-Step "步骤 5/7: 配置 Ngrok（公网访问工具）"

$ngrokDir = "D:\ngrok"
$ngrokExe = Join-Path $ngrokDir "ngrok.exe"

if (-not (Test-Path $ngrokExe)) {
    Write-Info "Ngrok 未安装，开始下载..."

    $ngrokZip = "D:\ngrok.zip"
    $ngrokUrl = "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip"

    try {
        Invoke-WebRequest -Uri $ngrokUrl -OutFile $ngrokZip -UseBasicParsing
        Write-Success "下载完成"

        Expand-Archive -Path $ngrokZip -DestinationPath $ngrokDir -Force
        Remove-Item $ngrokZip -Force
        Write-Success "Ngrok 已安装到: $ngrokDir"
    } catch {
        Write-Error-Custom "下载失败: $_"
        Write-Info "请手动下载 Ngrok: https://ngrok.com/download"
        Write-Info "下载后解压到: $ngrokDir"
        pause
        exit 1
    }
} else {
    Write-Success "Ngrok 已安装: $ngrokExe"
}

# 配置 Ngrok Authtoken
Write-Host "`n请访问 https://dashboard.ngrok.com/get-started/your-authtoken" -ForegroundColor Yellow
Write-Host "（需要注册免费账号，复制 Authtoken）" -ForegroundColor Gray
$ngrokToken = Read-Host "请输入 Ngrok Authtoken (可留空，稍后配置)"

if (-not [string]::IsNullOrWhiteSpace($ngrokToken)) {
    & $ngrokExe config add-authtoken $ngrokToken
    Write-Success "Ngrok Authtoken 已配置"
} else {
    Write-Info "Ngrok Authtoken 未配置，请稍后手动运行: ngrok config add-authtoken YOUR_TOKEN"
}

# ============================================================================
# 步骤 6：创建启动脚本
# ============================================================================
Write-Step "步骤 6/7: 创建启动脚本"

# 网关启动脚本
$startGatewayScript = @"
# 启动 OpenClawCN 网关
Write-Host "正在启动 OpenClawCN 网关..." -ForegroundColor Green
Set-Location "$InstallPath"
.\openclawcn.exe gateway run
"@

$startGatewayFile = "D:\start-openclawcn-gateway.ps1"
$startGatewayScript | Out-File -FilePath $startGatewayFile -Encoding utf8 -Force
Write-Success "网关启动脚本: $startGatewayFile"

# Ngrok 启动脚本
$startNgrokScript = @"
# 启动 Ngrok
Write-Host "正在启动 Ngrok..." -ForegroundColor Green
Write-Host "请复制显示的 HTTPS 地址（Forwarding 行）" -ForegroundColor Yellow
Write-Host ""
& "$ngrokExe" http 18789
"@

$startNgrokFile = "D:\start-ngrok.ps1"
$startNgrokScript | Out-File -FilePath $startNgrokFile -Encoding utf8 -Force
Write-Success "Ngrok 启动脚本: $startNgrokFile"

# ============================================================================
# 步骤 7：显示后续步骤
# ============================================================================
Write-Step "步骤 7/7: 安装完成！后续步骤"

Write-Host ""
Write-ColorOutput "============================================================================" "Green"
Write-ColorOutput "  OpenClawCN 安装成功！" "Green"
Write-ColorOutput "============================================================================" "Green"
Write-Host ""

Write-ColorOutput "接下来的操作步骤：" "Cyan"
Write-Host ""

Write-Host "【1】启动服务（需要打开两个窗口）" -ForegroundColor Yellow
Write-Host ""
Write-Host "    窗口 1 - 启动网关:" -ForegroundColor White
Write-Host "    powershell -ExecutionPolicy Bypass -File D:\start-openclawcn-gateway.ps1" -ForegroundColor Gray
Write-Host ""
Write-Host "    窗口 2 - 启动 Ngrok:" -ForegroundColor White
Write-Host "    powershell -ExecutionPolicy Bypass -File D:\start-ngrok.ps1" -ForegroundColor Gray
Write-Host ""

Write-Host "【2】在 Ngrok 窗口中，复制 HTTPS 地址（类似 https://xxxx.ngrok-free.app）" -ForegroundColor Yellow
Write-Host ""

Write-Host "【3】配置企业微信回调" -ForegroundColor Yellow
Write-Host "    a. 打开企业微信管理后台: https://work.weixin.qq.com/wework_admin/" -ForegroundColor White
Write-Host "    b. 应用管理 → 点击您的自建应用 → 接收消息 → 设置API接收" -ForegroundColor White
Write-Host "    c. 填写:" -ForegroundColor White
Write-Host "       URL: https://你的ngrok地址/wecom/webhook" -ForegroundColor Gray
Write-Host "       Token: 点击'随机获取'，然后复制" -ForegroundColor Gray
Write-Host "       EncodingAESKey: 点击'随机获取'，然后复制" -ForegroundColor Gray
Write-Host "    d. 先不要点保存！" -ForegroundColor Red
Write-Host ""

Write-Host "【4】更新配置文件，填入 Token 和 EncodingAESKey" -ForegroundColor Yellow
Write-Host "    编辑文件: $configFile" -ForegroundColor White
Write-Host "    找到以下行并填入值:" -ForegroundColor White
Write-Host "        token: `"粘贴Token`"" -ForegroundColor Gray
Write-Host "        encodingAESKey: `"粘贴EncodingAESKey`"" -ForegroundColor Gray
Write-Host ""

Write-Host "【5】重启网关（在网关窗口按 Ctrl+C，然后重新启动）" -ForegroundColor Yellow
Write-Host ""

Write-Host "【6】返回企业微信后台，点击'保存'，等待验证成功" -ForegroundColor Yellow
Write-Host ""

Write-Host "【7】测试机器人" -ForegroundColor Yellow
Write-Host "    在企业微信 App 中打开应用，发送消息：你好" -ForegroundColor White
Write-Host ""

Write-ColorOutput "============================================================================" "Green"
Write-ColorOutput "配置文件位置: $configFile" "Cyan"
Write-ColorOutput "安装目录: $InstallPath" "Cyan"
Write-ColorOutput "日志目录: $configDir\logs" "Cyan"
Write-ColorOutput "============================================================================" "Green"
Write-Host ""

Write-Info "是否现在启动网关？(Y/N)"
$startNow = Read-Host

if ($startNow -eq 'Y' -or $startNow -eq 'y') {
    Write-Host ""
    Write-ColorOutput "正在启动网关..." "Green"
    Write-Info "按 Ctrl+C 可停止网关"
    Write-Host ""

    Set-Location $InstallPath
    & .\openclawcn.exe gateway run
} else {
    Write-Info "稍后可运行以下命令启动网关:"
    Write-Host "    powershell -ExecutionPolicy Bypass -File D:\start-openclawcn-gateway.ps1" -ForegroundColor Gray
    pause
}
