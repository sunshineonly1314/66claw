# Windows 构建后自动化验证（Post-Build Validation）需求文档

> 版本: 1.0 | 日期: 2026-02-19 | 状态: 待实施

---

## 1. 背景与目标

### 1.1 现状

当前 `build-windows.ps1` 的 `-TestInstall` 仅做最简验证：

```powershell
# 当前实现（build-windows.ps1:1836-1852）
Start-Process $outputExe -ArgumentList "/DIR=$testDir", "/SILENT", "/SUPPRESSMSGBOXES" -Wait
if (Test-Path "$testDir\dist\entry.js") {
    Write-OK "Test install succeeded"
}
```

**问题**：只检查一个文件是否存在。安装包内的 node.exe 可能损坏、.jsc 可能不兼容、Gateway 可能启动失败、UI 页面可能无法加载——这些都无法发现。

### 1.2 目标

在 Windows 构建机器上，打包完成后自动执行完整的安装后验证：

```
构建完成 (.exe)
    ↓
Phase 1: 静默安装 → 验证文件结构
    ↓
Phase 2: 启动 Gateway → Health 检查（ready:true）
    ↓
Phase 3: HTTP 端点验证（/api/health, Control UI, Setup 页面）
    ↓
Phase 4: WebSocket 协议连通性（connect → health → chat.history）
    ↓
Phase 5: 清理（关停 Gateway、可选卸载）
    ↓
输出测试报告（PASS/FAIL 汇总）
```

### 1.3 不做的事情（Out of Scope）

- Playwright/浏览器 UI 自动化点击（后续再做）
- Tauri 桌面端窗口检测（后续再做）
- 真实 AI 模型调用测试（需要 API Key，属于 live test）
- 修改 `package.json` 中的 `build:secure` 命令

---

## 2. 已有基础设施（直接复用）

| 组件 | 文件 | 可复用内容 |
|------|------|-----------|
| 静默安装 | `build-windows.ps1:1836` | `/SILENT /SUPPRESSMSGBOXES` 参数 |
| 环境变量 | `scripts/windows/start-gateway.bat:18-29` | 6 个 `CLAWDBOT_*` 变量 |
| 端口检查 | `scripts/windows/test-install.ps1:72-106` | `Get-NetTCPConnection` 端口监听检测 |
| Health API | `src/gateway/server-http.ts:484-503` | `GET /api/health` → `{ok, ready, phase, pid, uptime}` |
| Shutdown API | `src/gateway/server-http.ts:531-573` | `POST /api/shutdown` + `X-Clawdbot-Token` |
| WS Smoke | `scripts/dev/gateway-smoke.ts:28-68` | `connect → health → chat.history` 三步握手 |
| Gateway 命令 | 多处 | `node entry.js gateway run --port 18789 --allow-unconfigured` |

---

## 3. 实施方案

### 3.1 新增文件

创建一个独立的 PowerShell 脚本：

```
scripts/windows/post-build-validation.ps1
```

**不修改** `build-windows.ps1` 的主流程。在 `-TestInstall` 分支末尾调用这个新脚本。

### 3.2 调用方式

```powershell
# 方式1：构建时自动执行（通过 -TestInstall 触发）
.\build-windows.ps1 -Mode standard -TestInstall

# 方式2：独立执行（手动或 CI 触发）
.\scripts\windows\post-build-validation.ps1 `
    -InstallerPath "E:\clawdbuild\ClawdbotCN-Setup-2026.2.15-x64.exe" `
    -InstallDir "E:\clawdbuild\test\ClawdbotCN"

# 方式3：跳过安装（已安装，只跑验证）
.\scripts\windows\post-build-validation.ps1 `
    -InstallDir "E:\clawdbuild\test\ClawdbotCN" `
    -SkipInstall
```

---

## 4. 详细需求：5 个验证阶段

### Phase 1: 静默安装 + 文件结构验证

#### 1a. 静默安装

```powershell
# Inno Setup 静默安装参数
$args = @(
    "/VERYSILENT",          # 完全无 UI
    "/SUPPRESSMSGBOXES",   # 抑制所有 MsgBox（包括端口冲突、杀毒提示）
    "/NORESTART",          # 不重启
    "/SP-",                # 跳过 "This will install..." 初始提示
    "/CLOSEAPPLICATIONS",  # 自动关闭占用文件的进程
    "/DIR=`"$InstallDir`"",
    "/LOG=`"$LogDir\install.log`""
)
Start-Process $InstallerPath -ArgumentList $args -Wait -PassThru
```

- 检查退出码：`0` = 成功
- 超时：5 分钟（安装不应超过这个时间）
- 失败时输出 install.log 末尾 30 行

#### 1b. 关键文件验证

必须存在的文件（缺一即 FAIL）：

| 文件路径 | 说明 |
|---------|------|
| `node\node.exe` | 捆绑的 Node.js 运行时 |
| `dist\entry.js` | Gateway 入口 |
| `dist\index.js` | 主入口 |
| `package.json` | 包清单 |
| `install.json` | 安装标记（Inno Setup `[Code]` 段生成） |
| `ClawdbotService.exe` | 原生服务包装器 |

#### 1c. Node.js 功能验证

```powershell
& "$InstallDir\node\node.exe" --version
# 预期：v22.13.1（与 portable Node 版本一致）
# 退出码必须为 0
```

#### 1d. .jsc 字节码加载验证

```powershell
# 用安装目录内的 node.exe 测试加载一个 .jsc 文件
& "$InstallDir\node\node.exe" -e "
  try {
    require('bytenode');
    require('./dist/dispatch/engine.jsc');
    process.stdout.write('JSC_OK');
  } catch(e) {
    process.stdout.write('JSC_FAIL:' + e.message);
    process.exit(1);
  }
"
```

- 这能验证：node.exe 版本与 .jsc 的 V8 版本匹配
- FAIL 说明 portable Node 版本和编译时的版本不一致

---

### Phase 2: Gateway 启动 + Health 检查

#### 2a. 清理环境

```powershell
# 杀掉占用端口 18789 的进程
Get-NetTCPConnection -LocalPort 18789 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-Sleep -Seconds 2
```

#### 2b. 设置环境变量

与 `start-gateway.bat` 保持一致：

```powershell
$env:CLAWDBOT_STATE_DIR       = "$env:APPDATA\ClawdbotCN-test"  # 注意用 -test 后缀隔离
$env:CLAWDBOT_BUNDLED_PLUGINS_DIR = "$InstallDir\extensions"
$env:CLAWDBOT_BUNDLED_SKILLS_DIR  = "$InstallDir\skills"
$env:CLAWDBOT_BUNDLED_TOOLS_DIR   = "$InstallDir\tools"
$env:CLAWDBOT_GATEWAY_TOKEN  = "ci-test-$(Get-Random)"  # 随机 Token 隔离
$env:CLAWDBOT_REGION          = "cn"
$env:PATH = "$InstallDir\node;$InstallDir\tools;$env:PATH"
```

#### 2c. 启动 Gateway

```powershell
$nodeExe = "$InstallDir\node\node.exe"
$entryJs = "$InstallDir\dist\entry.js"
$port = 18789

$gw = Start-Process -FilePath $nodeExe `
    -ArgumentList "`"$entryJs`"", "gateway", "run", "--port", $port, "--allow-unconfigured" `
    -WorkingDirectory $InstallDir `
    -RedirectStandardOutput "$LogDir\gateway-stdout.log" `
    -RedirectStandardError "$LogDir\gateway-stderr.log" `
    -PassThru -NoNewWindow
```

#### 2d. 两阶段 Health 检查

**阶段一：等待端口监听**（最多 60 秒）

```powershell
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    # 检查进程是否崩溃
    if ($gw.HasExited) { FAIL "Gateway crashed (exit: $($gw.ExitCode))" }
    # 检查端口
    $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($conn) { break }
}
```

**阶段二：等待 /api/health 返回 `ready:true`**（最多 90 秒）

```powershell
$healthUrl = "http://127.0.0.1:${port}/api/health"
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 1
    try {
        $h = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 3
        if ($h.ok -and $h.ready) {
            PASS "Gateway ready (${i}s, PID:$($h.pid), phase:$($h.phase))"
            break
        }
    } catch { }
}
```

- `ready:true` 表示 Gateway 完成全部初始化（包括渠道、技能扫描）
- 记录 `phase` 值便于调试

---

### Phase 3: HTTP 端点验证

在 Gateway ready 之后，依次测试以下 HTTP 端点：

| # | 测试 | 方法 | URL | 预期结果 |
|---|------|------|-----|---------|
| 3a | Health API | GET | `/api/health` | status=200, body.ok=true, body.ready=true |
| 3b | Control UI | GET | `/?token={TOKEN}` | status=200, body 包含 `<html` |
| 3c | Setup 页面 | GET | `/setup?token={TOKEN}` | status=200, body 长度 > 0 |
| 3d | Shutdown 防护 | POST | `/api/shutdown`（无 Token） | status=401 或 403（拒绝未认证请求） |

```powershell
# 3a
$h = Invoke-RestMethod -Uri "$baseUrl/api/health" -TimeoutSec 5
Assert ($h.ok -eq $true -and $h.ready -eq $true)

# 3b
$ui = Invoke-WebRequest -Uri "$baseUrl/?token=$token" -UseBasicParsing -TimeoutSec 10
Assert ($ui.StatusCode -eq 200 -and $ui.Content -match '<html')

# 3c
$setup = Invoke-WebRequest -Uri "$baseUrl/setup?token=$token" -UseBasicParsing -TimeoutSec 10
Assert ($setup.StatusCode -eq 200)

# 3d: 无 Token 的 shutdown 请求应被拒绝
try {
    Invoke-WebRequest -Uri "$baseUrl/api/shutdown" -Method POST -UseBasicParsing -TimeoutSec 5
    FAIL "Shutdown accepted without auth"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Assert ($code -eq 401 -or $code -eq 403)
}
```

---

### Phase 4: WebSocket 协议连通性

使用安装目录内的 node.exe 运行一个内联 JS 脚本，测试 WebSocket 三步握手。

**测试流程**（复用 `gateway-smoke.ts` 的协议）：

```
1. ws://127.0.0.1:18789 建立 WebSocket 连接
2. 发送 connect 请求（protocol v3, role:operator, auth:token）
3. 收到 connect 响应（ok:true）
4. 发送 health 请求
5. 收到 health 响应（ok:true）
6. 关闭连接
```

**实现**：写一个临时 `.js` 文件，用安装目录的 node.exe 执行：

```javascript
// ws-smoke.js（由 PowerShell 动态生成到临时目录）
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:PORT');
const timeout = setTimeout(() => { process.exit(1); }, 20000);

ws.on('open', () => {
    ws.send(JSON.stringify({
        type: 'req', id: 'c1', method: 'connect',
        params: {
            minProtocol: 3, maxProtocol: 3,
            client: { id: 'post-build-smoke', version: 'test',
                      platform: 'win32', mode: 'cli',
                      instanceId: 'smoke-' + Date.now() },
            locale: 'zh-CN', userAgent: 'post-build-validation',
            role: 'operator',
            scopes: ['operator.read', 'operator.write'],
            caps: [],
            auth: { token: 'TOKEN' }
        }
    }));
});

ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.type === 'res' && msg.id === 'c1' && msg.ok) {
        ws.send(JSON.stringify({ type: 'req', id: 'h1', method: 'health' }));
    }
    if (msg.type === 'res' && msg.id === 'h1' && msg.ok) {
        clearTimeout(timeout);
        ws.close();
        console.log('WS_SMOKE_OK');
        process.exit(0);
    }
});

ws.on('error', (e) => { console.log('WS_ERROR:' + e.message); process.exit(2); });
```

**注意**：`ws` 模块在安装目录的 `node_modules` 中已存在（生产依赖），所以可以直接 require。

**PowerShell 执行**：

```powershell
# 动态替换 PORT 和 TOKEN
$wsScript = $wsTemplate -replace 'PORT', $port -replace 'TOKEN', $token
$wsFile = "$env:TEMP\clawdbot-ws-smoke-$(Get-Random).js"
Set-Content -Path $wsFile -Value $wsScript -Encoding UTF8

$wsResult = & "$InstallDir\node\node.exe" $wsFile 2>&1
Remove-Item $wsFile -Force

if ($LASTEXITCODE -eq 0 -and ($wsResult -join '') -match 'WS_SMOKE_OK') {
    PASS "WebSocket connect + health"
} else {
    FAIL "WebSocket test (exit:$LASTEXITCODE): $wsResult"
}
```

---

### Phase 5: 清理

#### 5a. 优雅关停 Gateway

```powershell
# 先尝试 POST /api/shutdown（带 Token）
try {
    Invoke-WebRequest -Uri "$baseUrl/api/shutdown" -Method POST `
        -Headers @{ "X-Clawdbot-Token" = $token } `
        -TimeoutSec 3 -UseBasicParsing | Out-Null
    $gw.WaitForExit(8000)  # 等 8 秒（与 ClawdbotService.cs 一致）
} catch { }

# 如果还活着，强杀
if (-not $gw.HasExited) {
    Stop-Process -Id $gw.Id -Force
}
```

#### 5b. 清理测试数据

```powershell
# 删除测试用的 state 目录
$testStateDir = "$env:APPDATA\ClawdbotCN-test"
if (Test-Path $testStateDir) {
    Remove-Item $testStateDir -Recurse -Force -ErrorAction SilentlyContinue
}
```

#### 5c. 可选卸载

如果传入了 `-Cleanup` 参数，运行卸载：

```powershell
if ($Cleanup) {
    $uninstaller = "$InstallDir\unins000.exe"
    if (Test-Path $uninstaller) {
        Start-Process $uninstaller -ArgumentList "/VERYSILENT", "/SUPPRESSMSGBOXES" -Wait
    }
}
```

---

## 5. 输出格式

### 5.1 控制台输出

```
=== Phase 1: Installation & File Structure ===
[PASS] Silent installation (exit code: 0, 12.3s)
[PASS] Critical files present (6/6)
[PASS] Node.js functional (v22.13.1)
[PASS] .jsc bytecode loads correctly

=== Phase 2: Gateway Startup ===
[PASS] Port 18789 listening (8s)
[PASS] Gateway ready (23s, PID:12345, phase:ready)

=== Phase 3: HTTP Endpoints ===
[PASS] GET /api/health (ok:true, ready:true)
[PASS] Control UI HTML (28,432 bytes)
[PASS] Setup wizard page (200)
[PASS] Shutdown auth protection (401)

=== Phase 4: WebSocket Protocol ===
[PASS] WebSocket connect + health

=== Phase 5: Cleanup ===
[PASS] Gateway shutdown (graceful)
[PASS] Test data cleaned

========================================
  Post-Build Validation Results
========================================
  Total:  11 tests
  Passed: 11
  Failed: 0
  Time:   48.2s
========================================
```

### 5.2 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 所有测试通过 |
| 1 | 有测试失败 |
| 2 | 脚本运行错误（参数无效、文件不存在等） |

### 5.3 日志文件

所有日志保存到 `$InstallDir\logs\` 或 `$OutputDir\logs\`：

| 日志文件 | 内容 |
|---------|------|
| `install.log` | Inno Setup 安装日志 |
| `gateway-stdout.log` | Gateway 标准输出 |
| `gateway-stderr.log` | Gateway 标准错误输出 |
| `validation-report.txt` | 测试报告（与控制台输出相同） |

---

## 6. 集成到 build-windows.ps1

### 6.1 修改 TestInstall 分支

在 `build-windows.ps1` 的 TestInstall 部分（约 1836-1852 行），在现有的安装验证**之后**，追加调用：

```powershell
if ($TestInstall) {
    # ... 现有的静默安装代码保持不变 ...

    # 追加：完整的安装后验证
    $validationScript = "$ScriptsDir\post-build-validation.ps1"
    if (Test-Path $validationScript) {
        Write-Host "  Running post-build validation..." -ForegroundColor DarkCyan
        & $validationScript -InstallDir $testDir -SkipInstall -LogDir "$OutputDir\logs"
        if ($LASTEXITCODE -ne 0) {
            Write-Err "Post-build validation FAILED ($LASTEXITCODE tests failed)"
            # 注意：不 exit，只报错，让构建产物仍然输出
        } else {
            Write-OK "Post-build validation passed"
        }
    }
}
```

### 6.2 不阻塞构建

验证失败时只报警告，不阻断构建流程。因为安装包已经生成，用户可能想手动调查。

---

## 7. 脚本参数签名

```powershell
param(
    [string]$InstallerPath = "",             # .exe 安装包路径（SkipInstall 时可不填）
    [string]$InstallDir = "",                # 安装目标目录
    [string]$LogDir = "",                    # 日志输出目录（默认 $InstallDir\logs）
    [int]$Port = 18789,                      # Gateway 端口
    [int]$StartupTimeoutSec = 60,            # 端口监听超时（秒）
    [int]$ReadyTimeoutSec = 90,              # Health ready 超时（秒）
    [switch]$SkipInstall,                    # 跳过安装，直接验证
    [switch]$SkipWebSocket,                  # 跳过 WebSocket 测试
    [switch]$Cleanup                         # 验证后卸载
)
```

---

## 8. 注意事项

### 8.1 Windows 杀毒软件

Windows Defender / 360 可能拦截 `node.exe` 首次启动。CI 构建机器应提前将安装目录加入白名单：

```powershell
Add-MpPreference -ExclusionPath $InstallDir -ErrorAction SilentlyContinue
```

### 8.2 端口冲突

- 验证前先杀掉占用 18789 端口的进程
- 使用 `Get-NetTCPConnection` 而非 `netstat`（更快、更可靠）
- 用 `127.0.0.1` 而非 `localhost`（避免 IPv6/DNS 解析延迟）

### 8.3 测试隔离

- 使用 `$env:APPDATA\ClawdbotCN-test` 而非 `ClawdbotCN` 作为 state 目录
- 使用随机 Gateway Token 避免与运行中的实例冲突
- 测试完成后清理 state 目录

### 8.4 性能预期

| 阶段 | 预计耗时 |
|------|---------|
| Phase 1: 安装 + 文件检查 | 10-20 秒 |
| Phase 2: Gateway 启动 | 20-60 秒 |
| Phase 3: HTTP 测试 | 3-5 秒 |
| Phase 4: WebSocket 测试 | 2-5 秒 |
| Phase 5: 清理 | 3-5 秒 |
| **总计** | **40-90 秒** |

---

## 9. 后续扩展（Phase 2 需求，本次不实施）

| 扩展项 | 说明 | 优先级 |
|--------|------|--------|
| Playwright UI 测试 | 用 Playwright 自动打开 Control UI，验证页面渲染、按钮可点击 | P2 |
| Tauri 桌面端测试 | 启动 Tauri .exe，检测窗口、sidecar 进程、WebView 加载 | P3 |
| 实际对话测试 | 使用免费模型发一条消息，验证端到端对话链路 | P2 |
| CI Webhook 集成 | 将测试结果推送到 `ci/webhook-server.js` 的构建状态 | P2 |
| 性能基线 | 记录 Gateway 启动时间、首次响应延迟，建立基线并监测退化 | P3 |

---

*文档结束*
