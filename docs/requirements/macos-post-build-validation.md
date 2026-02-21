# macOS 构建后自动化验证（Post-Build Validation）需求文档

> 版本: 1.0 | 日期: 2026-02-19 | 状态: 待实施

---

## 1. 背景与目标

### 1.1 现状

当前 `ci/build-macos.sh` 远程构建完成后仅检查 DMG 文件是否存在：

```bash
# 当前实现（ci/build-macos.sh:123-128）
if ls build/output/ClawdbotCN-macOS-*.dmg 1> /dev/null 2>&1; then
  echo "Build completed successfully!"
else
  echo "Build failed - no DMG found"
  exit 1
fi
```

`build/scripts/build-macos-cn.sh` 在构建过程中做了 V8 字节码兼容性检查（Step 5），但仅限于 `.jsc` 文件能否加载，**不验证整个 Gateway 是否能正常启动、HTTP 是否能响应、WebSocket 是否能连通**。

**问题**：DMG 存在不代表 app 可用。Node.js 二进制可能因 quarantine/权限损坏、`node_modules` 清理过激导致运行时依赖缺失、Gateway 启动崩溃、Control UI 页面无法加载——这些都无法在构建阶段发现。

### 1.2 目标

在 Mac Mini 构建机器上，DMG 打包完成后自动执行完整的安装后验证：

```
构建完成 (.dmg)
    ↓
Phase 1: 挂载 DMG → 复制 .app → 验证文件结构
    ↓
Phase 2: 启动 Gateway → Health 检查（ready:true）
    ↓
Phase 3: HTTP 端点验证（/api/health, Control UI, Setup 页面）
    ↓
Phase 4: WebSocket 协议连通性（connect → health）
    ↓
Phase 5: 清理（关停 Gateway、卸载 .app、清理 state）
    ↓
输出测试报告（PASS/FAIL 汇总）
```

### 1.3 不做的事情（Out of Scope）

- Playwright/浏览器 UI 自动化点击（后续再做）
- Tauri 桌面端窗口检测（后续再做）
- 真实 AI 模型调用测试（需要 API Key，属于 live test）
- 修改 `package.json` 中的 `build:secure` 命令
- Apple 公证 / Gatekeeper 验证（我们没有 Apple Developer 证书）

---

## 2. 已有基础设施（直接复用）

| 组件 | 文件 | 可复用内容 |
|------|------|-----------|
| 构建脚本 | `build/scripts/build-macos-cn.sh` | App Bundle 结构、环境变量命名 |
| 启动脚本 | `.app/Contents/MacOS/ClawdbotCN` | 环境变量设置、端口 18789、进程管理 |
| V8 检查 | `build-macos-cn.sh:475-498` | `.jsc` 字节码兼容性验证模式 |
| Health API | `src/gateway/server-http.ts:484-503` | `GET /api/health` → `{ok, ready, phase, pid, uptime}` |
| Shutdown API | `src/gateway/server-http.ts:531-573` | `POST /api/shutdown` + `x-openclawcn-token` |
| WS Smoke | `scripts/dev/gateway-smoke.ts:28-68` | `connect → health` 两步握手 |
| 端口检测 | Launcher script | `lsof -i ":PORT" -sTCP:LISTEN` |
| Windows 参考 | `scripts/windows/post-build-validation.ps1` | 5 阶段验证结构（直接移植逻辑） |

---

## 3. 实施方案

### 3.1 新增文件

创建一个独立的 Bash 脚本：

```
scripts/macos/post-build-validation.sh
```

**不修改** `build/scripts/build-macos-cn.sh` 的主构建流程。在构建 Summary 之前追加调用。

### 3.2 调用方式

```bash
# 方式1：构建完成后自动执行（在 build-macos-cn.sh 末尾调用）
bash scripts/macos/post-build-validation.sh \
    --dmg "build/output/ClawdbotCN-macOS-v2026.2.15-universal.dmg"

# 方式2：直接指定 .app 目录（跳过 DMG 挂载）
bash scripts/macos/post-build-validation.sh \
    --app-dir "build/output/ClawdbotCN.app"

# 方式3：独立执行（手动或 CI 触发）
bash scripts/macos/post-build-validation.sh \
    --dmg "/path/to/ClawdbotCN-macOS-v2026.2.15-universal.dmg" \
    --install-dir "/tmp/clawdbot-test" \
    --port 18799

# 方式4：跳过 DMG 挂载，直接测试已安装的 .app
bash scripts/macos/post-build-validation.sh \
    --app-dir "/Applications/ClawdbotCN.app" \
    --skip-install
```

### 3.3 与 Windows 版本的结构对齐

本脚本与 `scripts/windows/post-build-validation.ps1` 保持相同的 5 阶段结构和输出格式，便于 CI 统一解析。

---

## 4. 详细需求：5 个验证阶段

### Phase 1: DMG 挂载 / App 复制 + 文件结构验证

#### 1a. DMG 挂载与 App 提取

```bash
# 挂载 DMG（只读模式，不弹窗）
MOUNT_POINT=$(hdiutil attach "$DMG_PATH" -nobrowse -noverify -readonly \
    | grep "/Volumes/" | awk '{print $NF}')

# 复制 .app 到测试目录（避免直接在 DMG 卷上运行）
APP_NAME="ClawdbotCN.app"
TEST_APP_DIR="$INSTALL_DIR/$APP_NAME"
cp -R "$MOUNT_POINT/$APP_NAME" "$TEST_APP_DIR"

# 卸载 DMG
hdiutil detach "$MOUNT_POINT" -quiet
```

- DMG 挂载超时：30 秒
- 复制失败时输出错误信息
- 如果传入了 `--app-dir`，跳过此步骤

#### 1b. 关键文件验证

必须存在的文件（缺一即 FAIL）：

| 文件路径（相对于 .app） | 说明 |
|------------------------|------|
| `Contents/MacOS/ClawdbotCN` | 启动器 Shell 脚本 |
| `Contents/Resources/node/bin/node` | 捆绑的 Node.js 运行时 |
| `Contents/Resources/app/dist/entry.js` | Gateway 入口 |
| `Contents/Resources/app/dist/index.js` | 主入口 |
| `Contents/Resources/app/package.json` | 包清单 |
| `Contents/Resources/app/dist/control-ui/index.html` | Web UI 入口 |
| `Contents/Resources/version.json` | 版本元数据 |
| `Contents/Resources/app/build-meta.json` | V8 版本守卫 |

#### 1c. 可选文件检查（有则加分，缺不 FAIL）

| 文件路径 | 说明 |
|---------|------|
| `Contents/Resources/AppIcon.icns` | 应用图标 |
| `Contents/Resources/app/install.json` | 安装标记 |
| `Contents/Resources/app/extensions/` | CN 扩展目录 |
| `Contents/Resources/app/skills/` | 技能目录 |

#### 1d. Node.js 功能验证

```bash
NODE_BIN="$TEST_APP_DIR/Contents/Resources/node/bin/node"

# 清除 quarantine 属性（与启动器脚本一致）
xattr -cr "$TEST_APP_DIR/Contents/Resources" 2>/dev/null || true
chmod +x "$NODE_BIN" 2>/dev/null || true

# 验证 node 可运行
NODE_VERSION=$("$NODE_BIN" --version 2>&1)
# 预期：v22.14.0（与构建脚本 NODE_VERSION 一致）
# 退出码必须为 0
```

#### 1e. .jsc 字节码加载验证

```bash
# 用 app 内的 node 测试加载 .jsc 文件
"$NODE_BIN" -e "
  try {
    process.chdir('$APP_ROOT');
    require('bytenode');
    const fs = require('fs');
    const path = require('path');
    const dispatchDir = path.join(process.cwd(), 'dist', 'dispatch');
    if (!fs.existsSync(dispatchDir)) { process.stdout.write('JSC_NONE'); process.exit(0); }
    const jscFiles = fs.readdirSync(dispatchDir).filter(f => f.endsWith('.jsc'));
    if (jscFiles.length === 0) { process.stdout.write('JSC_NONE'); process.exit(0); }
    require(path.join(dispatchDir, jscFiles[0]));
    process.stdout.write('JSC_OK');
  } catch(e) {
    process.stdout.write('JSC_FAIL:' + e.message);
    process.exit(1);
  }
"
```

- 验证 Node.js V8 版本与 `.jsc` 编译时版本匹配
- FAIL 说明 portable Node 版本和编译时版本不一致

#### 1f. .jsc 文件数量检查

```bash
JSC_COUNT=$(find "$APP_ROOT/dist" -name "*.jsc" | wc -l | tr -d ' ')
# 预期 >= 5
```

---

### Phase 2: Gateway 启动 + Health 检查

#### 2a. 清理环境

```bash
# 杀掉占用测试端口的进程
PIDS=$(lsof -ti ":$PORT" 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    echo "$PIDS" | xargs kill -TERM 2>/dev/null || true
    sleep 2
    # 强杀残留
    REMAINING=$(lsof -ti ":$PORT" 2>/dev/null || true)
    if [ -n "$REMAINING" ]; then
        echo "$REMAINING" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
fi
```

#### 2b. 设置环境变量

与启动器脚本 (`Contents/MacOS/ClawdbotCN`) 保持一致，但使用 `-test` 后缀隔离：

```bash
export OPENCLAWCN_STATE_DIR="$HOME/Library/Application Support/OpenClawCN-test"
export OPENCLAWCN_BUNDLED_PLUGINS_DIR="$APP_ROOT/extensions"
export OPENCLAWCN_BUNDLED_SKILLS_DIR="$APP_ROOT/skills"
export OPENCLAWCN_BUNDLED_TOOLS_DIR="$RESOURCES/tools"
export OPENCLAWCN_GATEWAY_TOKEN="ci-test-$$-$RANDOM"
export OPENCLAWCN_REGION="cn"
export NODE_ENV=production
export PATH="$RESOURCES/node/bin:$PATH"
```

#### 2c. 创建 State 目录

```bash
mkdir -p "$OPENCLAWCN_STATE_DIR/config" 2>/dev/null || true
mkdir -p "$OPENCLAWCN_STATE_DIR/data" 2>/dev/null || true
```

#### 2d. 启动 Gateway

```bash
NODE_BIN="$RESOURCES/node/bin/node"
ENTRY_JS="$APP_ROOT/dist/entry.js"

"$NODE_BIN" "$ENTRY_JS" gateway run --port "$PORT" --allow-unconfigured \
    > "$LOG_DIR/gateway-stdout.log" 2> "$LOG_DIR/gateway-stderr.log" &
GW_PID=$!
```

#### 2e. 两阶段 Health 检查

**阶段一：等待端口监听**（最多 60 秒）

```bash
for i in $(seq 1 $STARTUP_TIMEOUT); do
    sleep 1
    # 检查进程是否崩溃
    if ! kill -0 "$GW_PID" 2>/dev/null; then
        wait "$GW_PID" 2>/dev/null
        FAIL "Gateway crashed (exit: $?) after ${i}s"
        break
    fi
    # 检查端口
    if lsof -i ":$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
        PASS "Port $PORT listening (${i}s)"
        break
    fi
done
```

**阶段二：等待 /api/health 返回 `ready:true`**（最多 90 秒）

```bash
HEALTH_URL="http://127.0.0.1:${PORT}/api/health"
for i in $(seq 1 $READY_TIMEOUT); do
    sleep 1
    if ! kill -0 "$GW_PID" 2>/dev/null; then
        FAIL "Gateway crashed during health wait"
        break
    fi
    HEALTH=$(curl -sf --connect-timeout 3 --max-time 5 "$HEALTH_URL" 2>/dev/null || true)
    if [ -n "$HEALTH" ]; then
        OK=$(echo "$HEALTH" | "$NODE_BIN" -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).ok" 2>/dev/null || echo "")
        READY=$(echo "$HEALTH" | "$NODE_BIN" -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).ready" 2>/dev/null || echo "")
        if [ "$OK" = "true" ] && [ "$READY" = "true" ]; then
            PID_VAL=$(echo "$HEALTH" | "$NODE_BIN" -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).pid" 2>/dev/null || echo "?")
            PHASE_VAL=$(echo "$HEALTH" | "$NODE_BIN" -pe "JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')).phase" 2>/dev/null || echo "?")
            PASS "Gateway ready (${i}s, PID:${PID_VAL}, phase:${PHASE_VAL})"
            break
        fi
    fi
done
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
| 3c | Setup 页面 | GET | `/setup?token={TOKEN}` | status=200 或 301/302 重定向 |
| 3d | Shutdown 防护 | POST | `/api/shutdown`（无 Token） | status=401 或 403（拒绝未认证请求） |

```bash
# 3a
HEALTH=$(curl -sf "$BASE_URL/api/health" 2>/dev/null)
# 解析 JSON 判断 ok 和 ready

# 3b
UI_RESPONSE=$(curl -sf -w "%{http_code}" "$BASE_URL/?token=$TOKEN" 2>/dev/null)
# 检查 HTTP 200 + 包含 '<html'

# 3c
SETUP_CODE=$(curl -sf -o /dev/null -w "%{http_code}" "$BASE_URL/setup?token=$TOKEN" 2>/dev/null)
# 检查 200 或 301/302

# 3d: 无 Token 的 shutdown 请求应被拒绝
SHUTDOWN_CODE=$(curl -sf -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/shutdown" 2>/dev/null)
# 检查 401 或 403
```

---

### Phase 4: WebSocket 协议连通性

使用 app 内的 node 运行一个内联 JS 脚本，测试 WebSocket 两步握手。

**测试流程**（复用 `gateway-smoke.ts` 的协议）：

```
1. ws://127.0.0.1:PORT 建立 WebSocket 连接
2. 发送 connect 请求（protocol v3, role:operator, auth:token）
3. 收到 connect 响应（ok:true）
4. 发送 health 请求
5. 收到 health 响应（ok:true）
6. 关闭连接
```

**实现**：写一个临时 `.js` 文件，用 app 内的 node 执行：

```javascript
// ws-smoke.js（由 Bash 动态生成到临时目录）
const WebSocket = require('ws');
const ws = new WebSocket('ws://127.0.0.1:PORT');
const timeout = setTimeout(() => { console.log('WS_TIMEOUT'); process.exit(1); }, 20000);

ws.on('open', () => {
    ws.send(JSON.stringify({
        type: 'req', id: 'c1', method: 'connect',
        params: {
            minProtocol: 3, maxProtocol: 3,
            client: { id: 'post-build-smoke', version: 'test',
                      platform: 'darwin', mode: 'cli',
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

**注意**：`ws` 模块在 app 的 `node_modules` 中已存在（生产依赖），所以可以直接 require。

**Bash 执行**：

```bash
# 动态替换 PORT 和 TOKEN
WS_SCRIPT=$(echo "$WS_TEMPLATE" | sed "s/PORT/$PORT/g" | sed "s/TOKEN/$TOKEN/g")
WS_FILE="/tmp/clawdbot-ws-smoke-$$.js"
echo "$WS_SCRIPT" > "$WS_FILE"

WS_OUTPUT=$("$NODE_BIN" "$WS_FILE" 2>&1)
WS_EXIT=$?
rm -f "$WS_FILE"

if [ "$WS_EXIT" -eq 0 ] && echo "$WS_OUTPUT" | grep -q 'WS_SMOKE_OK'; then
    PASS "WebSocket connect + health"
else
    FAIL "WebSocket test (exit:$WS_EXIT): $WS_OUTPUT"
fi
```

---

### Phase 5: 清理

#### 5a. 优雅关停 Gateway

```bash
# 先尝试 POST /api/shutdown（带 Token）
curl -sf -X POST "$BASE_URL/api/shutdown" \
    -H "x-openclawcn-token: $TOKEN" \
    --connect-timeout 3 --max-time 5 2>/dev/null || true

# 等 8 秒（与 Windows ClawdbotService.cs 和启动器脚本一致）
for i in $(seq 1 8); do
    if ! kill -0 "$GW_PID" 2>/dev/null; then
        break
    fi
    sleep 1
done

# 如果还活着，强杀
if kill -0 "$GW_PID" 2>/dev/null; then
    kill -9 "$GW_PID" 2>/dev/null || true
    PASS "Gateway shutdown (forced)"
else
    PASS "Gateway shutdown (graceful)"
fi
```

#### 5b. 清理测试数据

```bash
# 删除测试用的 state 目录
TEST_STATE_DIR="$HOME/Library/Application Support/OpenClawCN-test"
if [ -d "$TEST_STATE_DIR" ]; then
    rm -rf "$TEST_STATE_DIR"
fi
```

#### 5c. 可选清理 App

如果传入了 `--cleanup` 参数：

```bash
if [ "$CLEANUP" = "true" ]; then
    rm -rf "$TEST_APP_DIR"
fi
```

---

## 5. 输出格式

### 5.1 控制台输出

```
=== Phase 1: Installation & File Structure ===
[PASS] DMG mounted and app extracted (3.2s)
[PASS] Critical files present (8/8)
[PASS] Node.js functional (v22.14.0)
[PASS] .jsc bytecode loads correctly
[PASS] .jsc file count (12 files)

=== Phase 2: Gateway Startup ===
[PASS] Port 18789 listening (6s)
[PASS] Gateway ready (28s, PID:12345, phase:ready)

=== Phase 3: HTTP Endpoints ===
[PASS] GET /api/health (ok:true, ready:true)
[PASS] Control UI HTML (31,204 bytes)
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
  Total:  13 tests
  Passed: 13
  Failed: 0
  Time:   42.7s
========================================
```

### 5.2 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 所有测试通过 |
| 1 | 有测试失败 |
| 2 | 脚本运行错误（参数无效、文件不存在等） |

### 5.3 日志文件

所有日志保存到 `$LOG_DIR`（默认 `build/output/validation-logs/`）：

| 日志文件 | 内容 |
|---------|------|
| `gateway-stdout.log` | Gateway 标准输出 |
| `gateway-stderr.log` | Gateway 标准错误输出 |
| `validation-report.txt` | 测试报告（与控制台输出相同） |

---

## 6. 集成到构建流程

### 6.1 修改 build-macos-cn.sh

在 Step 8 (Create DMG) 完成之后、Summary 之前，追加调用：

```bash
# ============================================================================
# Step 8.5: Post-build validation (optional, non-blocking)
# ============================================================================
VALIDATION_SCRIPT="$ROOT_DIR/scripts/macos/post-build-validation.sh"
if [[ -f "$VALIDATION_SCRIPT" ]]; then
  log_step "Step 8.5: Post-build validation"
  chmod +x "$VALIDATION_SCRIPT"
  if bash "$VALIDATION_SCRIPT" --app-dir "$APP_DIR" --log-dir "$OUTPUT_DIR/validation-logs"; then
    log "Post-build validation passed"
  else
    warn "Post-build validation FAILED ($? tests failed)"
    # 注意：不 exit，只报警，让构建产物仍然输出
  fi
fi
```

### 6.2 修改 ci/build-macos.sh（远程构建入口）

在远程构建脚本的构建命令之后，追加验证调用：

```bash
# 在远程 Mac Mini 上执行验证
if [ -f "scripts/macos/post-build-validation.sh" ]; then
  echo "Running post-build validation..."
  bash scripts/macos/post-build-validation.sh \
      --app-dir "build/output/ClawdbotCN.app" \
      --log-dir "build/output/validation-logs" || \
      echo "WARN: Post-build validation failed (non-blocking)"
fi
```

### 6.3 不阻塞构建

验证失败时只报警告，不阻断构建流程。因为 DMG 已经生成，用户可能想手动调查。

---

## 7. 脚本参数签名

```bash
# 参数（通过 getopts 或手动解析）
--dmg PATH              # DMG 文件路径（有此参数时执行挂载+复制）
--app-dir PATH          # .app 目录路径（跳过 DMG 挂载，直接验证）
--install-dir PATH      # 测试安装目标目录（默认 /tmp/clawdbot-validation-$$）
--log-dir PATH          # 日志输出目录（默认 build/output/validation-logs）
--port PORT             # Gateway 端口（默认 18789）
--startup-timeout SEC   # 端口监听超时（秒，默认 60）
--ready-timeout SEC     # Health ready 超时（秒，默认 90）
--skip-install          # 跳过 DMG 挂载/App 复制，直接验证
--skip-websocket        # 跳过 WebSocket 测试
--cleanup               # 验证后删除测试 App 和 state
```

---

## 8. macOS vs Windows 差异对照

| 方面 | Windows (`post-build-validation.ps1`) | macOS (`post-build-validation.sh`) |
|------|---------------------------------------|-------------------------------------|
| **安装包格式** | .exe (Inno Setup) | .dmg + .app bundle |
| **安装方式** | `Start-Process /VERYSILENT` | `hdiutil attach` + `cp -R` |
| **Node.js 路径** | `node\node.exe` | `Contents/Resources/node/bin/node` |
| **App 根目录** | 安装目录根 | `Contents/Resources/app/` |
| **关键文件数** | 6 个 | 8 个 |
| **环境变量前缀** | `CLAWDBOT_*` + `OPENCLAWCN_*` | `OPENCLAWCN_*` |
| **State 目录** | `%APPDATA%\ClawdbotCN-test` | `~/Library/Application Support/OpenClawCN-test` |
| **端口检测** | `Get-NetTCPConnection` | `lsof -i ":PORT" -sTCP:LISTEN` |
| **进程管理** | `Stop-Process -Force` | `kill -TERM` → `kill -9` |
| **JSON 解析** | `Invoke-RestMethod` (内置) | `curl` + `node -pe` |
| **quarantine** | N/A | `xattr -cr` 清除 |
| **卸载** | `unins000.exe /VERYSILENT` | `rm -rf .app` |
| **服务包装器** | `ClawdbotService.exe` | 无（Shell 启动器直接 exec node） |

---

## 9. 注意事项

### 9.1 macOS Quarantine 属性

从 DMG 复制出的 `.app` 会带有 `com.apple.quarantine` 扩展属性，导致 `node` 二进制无法执行。验证脚本需要在测试前清除：

```bash
xattr -cr "$TEST_APP_DIR/Contents/Resources" 2>/dev/null || true
chmod +x "$NODE_BIN" 2>/dev/null || true
```

### 9.2 Universal Binary

在 arm64 Mac Mini 上测试 universal binary 时，`node` 会默认使用 arm64 slice。如果 `.jsc` 是用 x64 编译的会导致 V8 版本不匹配。构建脚本已经在 Step 5 做了 V8 兼容性检查，验证脚本再次确认。

### 9.3 端口冲突

- 验证前先杀掉占用测试端口的进程
- 使用 `lsof` 而非 `netstat`（macOS 标准工具）
- 用 `127.0.0.1` 而非 `localhost`（避免 IPv6/DNS 解析延迟）

### 9.4 测试隔离

- 使用 `~/Library/Application Support/OpenClawCN-test` 而非 `OpenClawCN` 作为 state 目录
- 使用随机 Gateway Token（含 PID + RANDOM）避免与运行中的实例冲突
- 测试完成后清理 state 目录

### 9.5 Signal 处理

脚本需要注册 `trap` 确保异常退出时 Gateway 进程被清理：

```bash
trap cleanup EXIT INT TERM
```

### 9.6 性能预期

| 阶段 | 预计耗时 |
|------|---------|
| Phase 1: DMG 挂载 + 文件检查 | 5-15 秒 |
| Phase 2: Gateway 启动 | 20-60 秒 |
| Phase 3: HTTP 测试 | 3-5 秒 |
| Phase 4: WebSocket 测试 | 2-5 秒 |
| Phase 5: 清理 | 3-5 秒 |
| **总计** | **35-90 秒** |

---

## 10. 后续扩展（Phase 2 需求，本次不实施）

| 扩展项 | 说明 | 优先级 |
|--------|------|--------|
| Playwright UI 测试 | 用 Playwright 自动打开 Control UI，验证页面渲染 | P2 |
| DMG 完整性 | 验证 SHA256 校验和、DMG 内部签名 | P3 |
| 多架构测试 | 在 x64 Mac 上也运行验证（如果有 x64 构建机） | P3 |
| 实际对话测试 | 使用免费模型发一条消息，验证端到端对话链路 | P2 |
| CI Webhook 集成 | 将测试结果推送到 `ci/webhook-server.js` 的构建状态 | P2 |
| 性能基线 | 记录 Gateway 启动时间、首次响应延迟，建立基线并监测退化 | P3 |

---

*文档结束*
