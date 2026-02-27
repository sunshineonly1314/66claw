# ClawdBot CN 平滑热更新 -- 需求与实施文档

> 版本: 1.0
> 日期: 2026-02-26
> 状态: 待评审

---

## 目录

- [1. 背景与目标](#1-背景与目标)
- [2. 约束条件](#2-约束条件)
- [3. 系统现状评估](#3-系统现状评估)
- [4. 架构设计](#4-架构设计)
- [5. 服务端实施](#5-服务端实施)
- [6. 客户端实施](#6-客户端实施)
- [7. CI/CD 发布流程](#7-cicd-发布流程)
- [8. 加密与安全兼容性](#8-加密与安全兼容性)
- [9. 必须修复的缺陷](#9-必须修复的缺陷)
- [10. 用户体验流程](#10-用户体验流程)
- [11. 多版本兼容策略](#11-多版本兼容策略)
- [12. 验收标准](#12-验收标准)
- [13. 风险登记表](#13-风险登记表)
- [14. 改动清单](#14-改动清单)

---

## 1. 背景与目标

### 1.1 背景

ClawdBot CN 以 Tauri 2.x + Node.js gateway sidecar 架构交付桌面客户端 (Windows NSIS / macOS DMG)。现有用户已分散在多个历史版本上。当前版本发布依赖用户手动下载安装包，升级摩擦大、覆盖率低。

代码库中已存在一套较完整的热更新基础设施 (delta 引擎、full 引擎、UI 组件、RPC handler)，但存在多处未接通的断点，从未在生产环境运行过。

### 1.2 目标

在不依赖 CDN 加速、不需要灰度发布、不需要强制更新的前提下，实现:

1. 用户打开应用后自动检测新版本，聊天区顶部出现更新 banner
2. 用户主动点击后，弹窗展示 changelog，点击"立即更新"执行热更新
3. 更新过程中实时显示下载/应用进度
4. 更新完成后由用户手动触发重启，不打断正在进行的对话
5. 支持三级级联: Delta 热更新 → Full 热更新 → Installer 跳转

### 1.3 不做

- 灰度发布 (不需要)
- 强制更新 (不需要)
- CDN 加速 (不使用，直接用 90 服务器)
- Tauri shell (Rust 层) 自身的热更新 (继续走 installer 跳转)
- `skills/` 和 `extensions/` 目录的增量更新 (仅 `dist/` 走 delta，其余走 full)

---

## 2. 约束条件

| 项目 | 值 |
|------|-----|
| 更新服务器 | 阿里云 ECS (90 服务器)，域名 `dl.obplugins.cn`，前置 Nginx |
| 分发方式 | Nginx 静态文件托管，无动态 API |
| 客户端架构 | Tauri 2.x shell + Node.js gateway sidecar (port 19002) |
| 构建产物 | `pnpm build:secure` → 7-Knife 保护 (RC4 混淆 + V8 字节码 + integrity-hashes) |
| 用户版本分布 | 多版本共存，最老版本不确定 |
| 对话保护 | 更新完成后由用户手动决定何时重启 |
| 安装路径 | `E:\openclawcn` (本地开发/部署) |

---

## 3. 系统现状评估

### 3.1 已完成组件 (可直接使用)

| 组件 | 文件 | 行数 | 说明 |
|------|------|------|------|
| Delta 热更新引擎 | `src/infra/installer-updater.ts` | ~1341 | SHA256 校验 + Ed25519 签名 + 三阶段原子回滚 |
| Full 热更新引擎 | `src/infra/installer-updater-full.ts` | ~331 | 全量替换 dist/skills/extensions |
| RPC handler (4 个方法) | `src/gateway/server-methods/update-execute.ts` | ~375 | update.check / status / execute / dismiss |
| 更新状态持久化 | `src/infra/update-state.ts` | ~100 | available-update.json 原子写入 |
| 启动时自动检查 | `src/infra/update-startup.ts` | ~200 | 24h 间隔，服务端可控 |
| 更新 Banner UI | `ui/src/ui/views/update-banner.ts` | ~55 | 聊天区顶部通知横幅 |
| 更新 Dialog UI | `ui/src/ui/views/update-dialog.ts` | ~272 | 三态弹窗 (确认/进度/结果) |
| UI 状态属性 | `ui/src/ui/app.ts:223-227` | 5 | updateAvailable / updateProgress / updateResult 等 |
| 重启机制 | `src/infra/restart.ts` | ~344 | SIGUSR1 + deferral 等待活跃任务排空 |
| 版本管理 | `scripts/version-bump.ts` | - | 同步 4 文件版本号 |
| 发布脚本 | `scripts/release-deploy.ts` | ~1108 | delta 生成 + full 打包 + latest.json + 上传 |
| Delta 生成器 | `scripts/generate-delta-package.ts` | ~250 | 逐文件 SHA256 比较 + whole-file copy |
| Ed25519 签名框架 | `src/infra/update-signature.ts` | ~202 | 文件签名 + 内容签名 + .sig 下载验证 |
| i18n 翻译 | `ui/src/ui/i18n/locales/zh-CN.ts`, `en.ts` | ~25 key | update.banner.* / update.dialog.* / update.progress.* |
| WebSocket 自动重连 | `ui/src/ui/gateway.ts:123-128` | - | backoff reconnect，gateway 重启后自动恢复 |

### 3.2 必须修复的缺陷 (阻塞上线)

经代码审计，发现以下 7 个缺陷，按严重程度排序:

| ID | 严重性 | 描述 | 文件 |
|----|--------|------|------|
| **BUG-1** | P0 阻塞 | `updateExecuteHandlers` 未注册到 gateway，4 个 RPC 方法不可达 | `cn-handlers.ts` |
| **BUG-2** | P0 阻塞 | UI 事件分发 (`handleGatewayEventUnsafe`) 不处理 `update.available` 和 `update.progress` 广播事件，服务端推送到达 UI 后被静默丢弃 | `app-gateway.ts` |
| **BUG-3** | P0 阻塞 | `handleRunUpdate()` 调用旧版 `update.run` RPC，未切换到新版 `update.execute` | `app.ts` → `controllers/config.ts` |
| **BUG-4** | P0 阻塞 | Ed25519 公钥为占位符 (`placeholder_replace_with_real_key`)，签名验证被静默跳过 | `update-signature.ts:38-40` |
| **BUG-5** | P1 功能缺失 | 启动检查 (`runGatewayUpdateCheck`) 发现更新后只打日志，不调用 `setAvailableUpdate()`，UI 无法感知 | `update-startup.ts` |
| **BUG-6** | P1 功能缺失 | "Full" updateType 为死代码路径 -- `checkInstallerUpdate` 只返回 `"delta"` 或 `"installer"`，`update.execute` 的 full 分支永远不会执行 | `update-execute.ts:265` |
| **BUG-7** | P2 域名不一致 | NSIS hooks 写入 `dl.openclawcn.com`，代码默认 `dl.obplugins.cn` | `nsis/hooks.nsh` vs `installer-updater.ts` |

### 3.3 CI 签名缺口

`scripts/release-deploy.ts` 不生成 `.sig` 签名文件。当前发布流程仅依赖 SHA256 校验和，无非对称签名保护。能控制更新服务器文件的攻击者可同时篡改包和校验和。

---

## 4. 架构设计

### 4.1 整体架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Tauri Shell (Rust)                            │
│                                                                      │
│  main.rs          sidecar.rs                 node.exe                │
│  ┌──────┐         ┌───────────────┐          ┌──────────────────┐   │
│  │WebView│◄────────│ 启动/停止/监控 │─────────►│ gateway :19002   │   │
│  │      │ navigate │ Node.js 进程   │ spawn    │                  │   │
│  └──┬───┘         └───────────────┘          └────────┬─────────┘   │
│     │                                                  │             │
│     │  WebSocket (ws://127.0.0.1:19002)               │             │
│     │◄─────────────────────────────────────────────────┘             │
│     │                                                                │
│     │  RPC: update.check / update.execute / update.status            │
│     │  Broadcast: update.available / update.progress                 │
└─────┼────────────────────────────────────────────────────────────────┘
      │
      │  HTTPS GET
      ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 90 服务器 (dl.obplugins.cn)                          │
│                                                                      │
│  Nginx                                                               │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ location /releases/ → /var/www/updates/releases/             │   │
│  │                                                              │   │
│  │   latest.json              (版本检查入口，no-cache)            │   │
│  │   {ver}/full.tar.gz        (全量包，immutable cache)          │   │
│  │   {ver}/full.tar.gz.sig    (Ed25519 签名)                    │   │
│  │   {ver}/delta-from-*.tar.gz(增量包)                           │   │
│  │   {ver}/checksums.json     (逐文件校验和)                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 三级级联策略

```
客户端当前版本 ──► GET /releases/latest.json
                        │
                  ┌─────▼─────────────────────────────────┐
                  │ latest.json.deltas 中包含当前版本?       │
                  └─────┬───────────────────┬──────────────┘
                       Yes                  No
                        │                    │
                   Delta 热更新         ┌────▼────────────────────┐
                   (~1-10MB)           │ 当前版本 >= minVersion?   │
                   只替换变更文件        └────┬──────────┬─────────┘
                                           Yes         No
                                            │           │
                                       Full 热更新    Installer 跳转
                                       (~20-50MB)    弹窗显示下载链接
                                       整体替换 dist/  用户手动下载安装
                                       skills/ext
```

**判定逻辑** (在 `checkInstallerUpdate()` 的 `checkViaStaticFile` 路径中):

1. 解析 `latest.json`，取 `platforms[当前平台]` 或顶层字段
2. 遍历 `deltas[]`，若存在 `delta.from === 当前版本` → `updateType = "delta"`
3. 否则，若当前版本 >= `minVersion` (当 latest.json 含此字段时) → `updateType = "full"` (需修复 BUG-6 后生效)
4. 否则 → `updateType = "installer"`

### 4.3 职责边界

| 层 | 职责 | 不负责 |
|----|------|--------|
| **Tauri Shell** | 启动/停止 sidecar, WebView 导航, 进程生命周期 | 版本检查、下载、校验、应用 |
| **Node.js Gateway** | 版本检查、下载、SHA256+Ed25519 校验、原子化应用、回滚、进度广播、自重启 | 更新 Tauri shell 自身 / node.exe |
| **UI (WebView)** | 展示 banner/dialog, 接收进度广播, 用户交互 (更新/稍后/重启) | 直接访问文件系统 |
| **90 服务器 Nginx** | 静态文件托管, HTTPS, 缓存控制 | 灰度逻辑、版本决策 |
| **CI 构建机** | build:secure, 生成 delta/full 包, 签名, 上传 | 运行时逻辑 |

### 4.4 重启机制

更新完成后，gateway 不立即重启。流程如下:

1. `update.execute` RPC 返回 `{ ok: true, status: "ok" }`
2. 广播 `update.progress { stage: "complete", percent: 100 }`
3. UI dialog 切换到完成态，显示 [稍后重启] 和 [立即重启] 按钮
4. 用户继续使用，对话不受影响
5. 用户在方便时点击 [立即重启]:
   - UI 调用 `scheduleGatewaySigusr1Restart({ delayMs: 2000 })`
   - Gateway run loop 收到 SIGUSR1，重新加载代码模块
   - WebSocket 连接断开 → UI 自动 backoff reconnect
   - 重连成功后恢复正常使用

**Windows 兼容性**: `restart.ts:53` 已有判断 -- 当存在 SIGUSR1 listener 时走 `process.emit()` (JS EventEmitter)，不走 OS signal，Windows 上可正常工作。

---

## 5. 服务端实施

### 5.1 Nginx 配置

在 90 服务器现有 Nginx 配置中新增 (或确认已有):

```nginx
location /releases/ {
    alias /var/www/updates/releases/;
    autoindex off;

    # Tauri WebView 从 127.0.0.1 请求，需要 CORS
    add_header Access-Control-Allow-Origin "*" always;
    add_header Access-Control-Allow-Methods "GET, HEAD" always;

    # latest.json: 禁止缓存，每次请求都到源站
    location = /releases/latest.json {
        alias /var/www/updates/releases/latest.json;
        add_header Cache-Control "no-cache, must-revalidate" always;
        add_header Access-Control-Allow-Origin "*" always;
    }

    # 包文件和签名: 按版本号归档，内容不可变，长期缓存
    location ~* \.(tar\.gz|sig|sha256|exe|dmg)$ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header Access-Control-Allow-Origin "*" always;
    }
}
```

### 5.2 目录结构

```
/var/www/updates/releases/
├── latest.json                              # 版本检查入口 (每次发布覆盖)
├── 1.2.0/                                   # 按版本号归档
│   ├── full.tar.gz                          # 全量包
│   ├── full.tar.gz.sig                      # Ed25519 签名
│   ├── full.tar.gz.sha256                   # SHA256 校验和 (纯文本)
│   ├── checksums.json                       # dist/ 下逐文件 SHA256
│   ├── checksums.json.sig                   # checksums 签名
│   ├── changelog.json                       # 变更日志 (zh-CN + en-US)
│   ├── delta-from-1.1.23.tar.gz            # 从 1.1.23 升级的增量包
│   ├── delta-from-1.1.23.tar.gz.sig        # 增量包签名
│   ├── delta-from-1.1.22.tar.gz            # 从 1.1.22 升级的增量包
│   ├── delta-from-1.1.22.tar.gz.sig
│   └── installers/                          # NSIS/DMG 安装包 (installer 跳转用)
│       └── ClawdbotCN_1.2.0_x64-setup.exe
├── 1.1.23/                                  # 旧版本
│   └── ...
└── 1.1.22/
    └── ...
```

### 5.3 latest.json 规范

```json
{
  "version": "1.2.0",
  "buildTime": "2026-02-26T12:00:00.000Z",
  "gitCommit": "abc1234def",
  "nodeVersion": "v22.13.1",
  "url": {
    "full": "https://dl.obplugins.cn/releases/1.2.0/full.tar.gz",
    "manifest": "https://dl.obplugins.cn/releases/1.2.0/manifest.json",
    "checksums": "https://dl.obplugins.cn/releases/1.2.0/checksums.json",
    "changelog": "https://dl.obplugins.cn/releases/1.2.0/changelog.json"
  },
  "deltas": [
    {
      "from": "1.1.23",
      "url": "https://dl.obplugins.cn/releases/1.2.0/delta-from-1.1.23.tar.gz",
      "size": 3456789,
      "sha256": "a1b2c3d4..."
    },
    {
      "from": "1.1.22",
      "url": "https://dl.obplugins.cn/releases/1.2.0/delta-from-1.1.22.tar.gz",
      "size": 5678901,
      "sha256": "e5f6a7b8..."
    }
  ],
  "fullSize": 45678901,
  "fullSha256": "1234abcd...",
  "changelog": {
    "zh-CN": "### 1.2.0\n- 新增平滑热更新\n- 修复 xxx",
    "en-US": "### 1.2.0\n- Smooth hot update\n- Fixed xxx"
  },
  "installers": {
    "windows-nsis": {
      "url": "https://dl.obplugins.cn/releases/1.2.0/installers/ClawdbotCN_1.2.0_x64-setup.exe",
      "size": 123456789,
      "sha256": "..."
    }
  },
  "minVersion": "1.1.0"
}
```

**字段说明**:

| 字段 | 必填 | 说明 |
|------|------|------|
| `version` | 是 | 目标版本号 |
| `url.full` | 是 | 全量包下载地址 |
| `url.checksums` | 是 | 逐文件校验和 |
| `deltas[]` | 否 | 可用的增量包列表，`from` 为源版本号 |
| `fullSize` / `fullSha256` | 是 | 全量包大小和校验和 |
| `changelog` | 否 | 变更日志，支持 zh-CN/en-US |
| `installers` | 否 | NSIS/DMG 安装包信息 (installer 跳转用) |
| `minVersion` | 否 | Full 热更新的最低支持版本；低于此版本走 installer 跳转 |

---

## 6. 客户端实施

### 6.1 修复 BUG-1: 注册 RPC handlers

**文件**: `src/gateway/cn-handlers.ts`

```diff
+ import { updateExecuteHandlers } from "./server-methods/update-execute.js";

  export const cnGatewayHandlers: GatewayRequestHandlers = {
    // ... existing handlers ...

+   // Smooth Update: check, status, execute, dismiss
+   ...updateExecuteHandlers,
  };
```

效果: `update.check` / `update.status` / `update.execute` / `update.dismiss` 四个 RPC 可达。

### 6.2 修复 BUG-2: UI 事件监听

**文件**: `ui/src/ui/app-gateway.ts` 的 `handleGatewayEventUnsafe()` 函数

在现有事件处理 switch 中 (约第 460 行 `skill.install.progress` 处理之后) 新增:

```typescript
// ---- Smooth Update: 服务端推送事件 ----

if (evt.event === "update.available") {
  const payload = evt.payload as {
    version?: string;
    updateType?: "delta" | "full" | "installer";
    changelog?: { "zh-CN"?: string; "en-US"?: string };
    summary?: string;
    installerUrl?: string;
  } | undefined;
  if (payload?.version) {
    host.updateAvailable = {
      version: payload.version,
      updateType: payload.updateType ?? "installer",
      changelog: payload.changelog,
      summary: payload.summary,
      installerUrl: payload.installerUrl,
    };
  }
  return;
}

if (evt.event === "update.progress") {
  const payload = evt.payload as {
    stage?: string;
    percent?: number;
    message?: string;
  } | undefined;
  if (payload) {
    host.updateProgress = {
      stage: (payload.stage ?? "checking") as
        "checking" | "downloading" | "applying" | "verifying" | "complete" | "error",
      percent: payload.percent ?? 0,
      message: payload.message ?? "",
    };
    if (payload.stage === "complete") {
      host.updateResult = { ok: true, status: "ok", version: host.updateAvailable?.version };
      host.updateExecuting = false;
    }
    if (payload.stage === "error") {
      host.updateResult = { ok: false, error: payload.message };
      host.updateExecuting = false;
    }
  }
  return;
}
```

### 6.3 修复 BUG-3: 切换到新版 RPC

**文件**: `ui/src/ui/app.ts` 的 `handleRunUpdate()` 方法

替换当前实现:

```typescript
async handleRunUpdate() {
  if (!this.client || !this.connected) return;
  this.updateExecuting = true;
  this.updateProgress = null;
  this.updateResult = null;
  try {
    const res = await this.client.request("update.execute", {}) as {
      ok?: boolean;
      status?: string;
      error?: string;
      installerUrl?: string;
      version?: string;
    } | undefined;
    if (!res) return;
    // installer-redirect: 直接设置 result，dialog 显示下载链接
    if (res.status === "installer-redirect") {
      this.updateResult = {
        ok: true,
        status: "installer-redirect",
        installerUrl: res.installerUrl,
        version: res.version,
      };
      this.updateExecuting = false;
      return;
    }
    // delta/full 失败 (成功由 update.progress broadcast 驱动)
    if (!res.ok) {
      this.updateResult = { ok: false, error: res.error };
      this.updateExecuting = false;
    }
  } catch (err) {
    this.updateResult = { ok: false, error: String(err) };
    this.updateExecuting = false;
  }
}
```

同时删除 `controllers/config.ts` 中旧的 `runUpdate()` 函数的调用链 (仅 UI 侧，保留旧函数本身供 CLI 使用)。

### 6.4 修复 BUG-5: 启动检查持久化

**文件**: `src/infra/update-startup.ts`

在文件顶部新增 import:
```typescript
import { setAvailableUpdate, getAvailableUpdate } from "./update-state.js";
```

在 installer 模式的增量包可用分支 (约第 142-156 行) 中，追加状态持久化:

```typescript
if (shouldNotify) {
  // ... 现有 log.info 逻辑 ...

  // 持久化到 available-update.json，供 UI 通过 update.status 读取
  await setAvailableUpdate({
    version: ver,
    updateType: check.updateType ?? "delta",
    changelog: check.latest?.changelog ?? { "zh-CN": "", "en-US": "" },
    checkedAt: new Date().toISOString(),
    dismissed: false,
    checkResult: check,
  });
}
```

在 installer-redirect 分支 (约第 121-141 行) 中同样追加:

```typescript
if (shouldNotify) {
  // ... 现有 log.info 逻辑 ...

  await setAvailableUpdate({
    version: ver,
    updateType: "installer",
    changelog: { "zh-CN": "", "en-US": "" },
    checkedAt: new Date().toISOString(),
    dismissed: false,
    installerUrl: check.installerUrl,
    checkResult: check,
  });
}
```

### 6.5 修复 BUG-6: 激活 Full 热更新路径

**文件**: `src/infra/installer-updater.ts` 的 `checkViaStaticFile()` 函数

当前逻辑: 若 `deltas[]` 中没有匹配当前版本的 delta → 直接返回 `updateType: "installer"`。

需修改为: 若无匹配 delta 但有 `url.full` → 返回 `updateType: "full"`:

```typescript
// 在 resolvePlatformData 之后的判定逻辑中:
const hasDelta = platformData.deltas?.some(d => d.from === currentVersion);
if (hasDelta) {
  // ... 现有 delta 逻辑 ...
} else if (platformData.url?.full) {
  // 无匹配增量包，但有全量包 → Full 热更新
  return {
    hasUpdate: true,
    version: latest.version,
    updateType: "full",
    latest: latest,
  };
} else {
  // 无全量包 → Installer 跳转
  return {
    hasUpdate: true,
    version: latest.version,
    updateType: "installer",
    installerUrl: resolveInstallerUrl(platformData),
  };
}
```

同时需要在 `InstallerUpdateCheckResult` 类型 (同文件) 中将 `updateType` 从 `"delta" | "installer"` 扩展为 `"delta" | "full" | "installer"`。

### 6.6 修复 BUG-7: 统一更新服务器域名

**文件**: `apps/desktop/src-tauri/nsis/hooks.nsh`

将 `updateServer` 值从 `https://dl.openclawcn.com` 改为 `https://dl.obplugins.cn`。

### 6.7 UI 补充: dismiss 持久化 + 重连恢复

**文件**: `ui/src/ui/app-render.ts` (约第 1680 行)

dismiss 按钮同时调用服务端持久化:

```typescript
onDismiss: () => {
  const ver = state.updateAvailable?.version;
  state.updateAvailable = null;
  if (ver && state.client) {
    void state.client.request("update.dismiss", { version: ver });
  }
},
```

**文件**: `ui/src/ui/app-gateway.ts` 的 `connectGateway` 函数 onConnect 回调中

追加重连后的状态恢复:

```typescript
// WebSocket 重连后恢复更新状态
void client.request("update.status", {}).then((res: any) => {
  if (res?.hasUpdate && !res.dismissed) {
    host.updateAvailable = {
      version: res.version,
      updateType: res.updateType ?? "installer",
      changelog: res.changelog,
      summary: res.summary,
      installerUrl: res.installerUrl,
    };
  }
}).catch(() => {});
```

---

## 7. CI/CD 发布流程

### 7.1 Ed25519 密钥生成 (一次性)

```bash
# 在安全环境执行，私钥绝不入库
openssl genpkey -algorithm Ed25519 -out update-signing.pem
openssl pkey -in update-signing.pem -pubout -out update-signing.pub
cat update-signing.pub
# 输出:
# -----BEGIN PUBLIC KEY-----
# MCowBQYDK2VwAyEA<44字符base64>
# -----END PUBLIC KEY-----
```

- 公钥: 写入 `src/infra/update-signature.ts:38-40`，替换占位符 (修复 BUG-4)
- 私钥: 存入 CI 环境变量 `UPDATE_SIGNING_PRIVATE_KEY`

### 7.2 release-deploy.ts 补充签名步骤

在 Step 6 (Prepare Deploy Files) 之后，新增签名步骤:

```typescript
import { sign } from "node:crypto";

function signArtifact(filePath: string, privateKeyPem: string): void {
  const content = fs.readFileSync(filePath);
  const signature = sign(null, content, privateKeyPem);
  fs.writeFileSync(`${filePath}.sig`, signature.toString("base64"));
}

const PRIVATE_KEY = process.env.UPDATE_SIGNING_PRIVATE_KEY;
if (PRIVATE_KEY) {
  // 签名所有需要验证的产物
  signArtifact(path.join(versionDir, "full.tar.gz"), PRIVATE_KEY);
  signArtifact(path.join(versionDir, "checksums.json"), PRIVATE_KEY);
  for (const delta of deltaFiles) {
    signArtifact(delta.path, PRIVATE_KEY);
  }
  console.log(`[Step 6.5] Signed ${2 + deltaFiles.length} artifacts with Ed25519`);
} else {
  console.warn("[Step 6.5] WARNING: UPDATE_SIGNING_PRIVATE_KEY not set, skipping signing");
}
```

### 7.3 完整发布命令

```bash
# 1. 版本号
node --import tsx scripts/version-bump.ts set 1.2.0

# 2. 构建 (7-Knife 保护)
pnpm build:secure
pnpm ui:build

# 3. 生成包 + 签名 + 上传
UPDATE_SIGNING_PRIVATE_KEY="$(cat /path/to/update-signing.pem)" \
  node --import tsx scripts/release-deploy.ts \
    --version 1.2.0 \
    --server root@<90服务器IP> \
    --port 22

# 4. 验证
curl -s https://dl.obplugins.cn/releases/latest.json | jq .version
# → "1.2.0"
curl -sI https://dl.obplugins.cn/releases/1.2.0/full.tar.gz
# → 200 OK
curl -sI https://dl.obplugins.cn/releases/1.2.0/full.tar.gz.sig
# → 200 OK
```

### 7.4 Delta 包覆盖范围

| 内容 | Delta 包 | Full 包 |
|------|----------|---------|
| `dist/` (含 .js, .jsc, .json, integrity-hashes) | 是 (逐文件增量) | 是 (整体替换) |
| `skills/` | 否 | 是 |
| `extensions/` | 否 | 是 |
| `package.json` | 否 | 是 |
| `node.exe` | 否 (走 installer) | 否 (走 installer) |
| Tauri shell | 否 (走 installer) | 否 (走 installer) |

CI 缓存最近 5 个版本的 `dist/`，为每个缓存版本分别生成独立的 `delta-from-{版本}.tar.gz`。

---

## 8. 加密与安全兼容性

### 8.1 结论

**Delta 热更新与 7-Knife 加密体系完全兼容**，不会因加密导致功能异常。原因如下:

**Delta 机制是内容无关的**: 生成和应用都是 SHA256 hash 比较 + `fs.copyFile()` 全文件拷贝，不解析文件内容。`.jsc` 字节码、RC4 混淆后的 `.js`、`integrity-hashes.json` 全部作为不透明二进制 blob 处理。

### 8.2 需满足的前提条件

| # | 条件 | 原因 | 违反后果 |
|---|------|------|----------|
| **C1** | 始终在同一台构建机、同一 Node.js 版本上执行 `build:secure` | V8 字节码 `.jsc` 是平台+Node版本绑定的。不同环境编译出的 `.jsc` hash 不同，会导致 delta 包中出现本不需要更新的文件 | delta 包体积膨胀；极端情况下 `.jsc` 与目标 `node.exe` 不兼容导致崩溃 |
| **C2** | 换构建环境或升级 Node.js 后，必须清空 `.release-cache/` | 旧缓存中的 `.jsc` 与新环境编译的不可比 | 同上 |
| **C3** | 发布必须基于 `build:secure` 的完整输出，禁止手动修改 `dist/` 后生成 delta | `.jsc` 文件和对应的 `.js` loader stub 内嵌了配对的 SHA256 hash (Knife-6: loader-hash)。build:secure 保证两者原子一致；手动修改会打破配对 | 更新后 loader hash 校验失败 → `process.exit(1)` |
| **C4** | `integrity-hashes.json` 必须包含在 delta 包中 | 运行时 integrity-patrol (Knife-5) 启动时全量校验 + 每 5 分钟抽查 3 个文件。若此文件未跟随 delta 更新，记录的 hash 与新文件不匹配 | 启动时 integrity 校验失败 → 进程退出；或运行中触发 delayed-enforcement 降级 |

### 8.3 自动保证机制

条件 C4 不需要额外代码:

- `pnpm integrity:gen` 是 `build:secure` 的最后一步
- 它基于最终 `dist/` 重新生成 `integrity-hashes.json` 和 `integrity-hashes-root.json`
- 任何 CN 文件变化 → 两个 integrity 文件的 SHA256 也会变化
- Delta 生成器按 SHA256 比较，自然会将它们包含进 delta 包

验证方式: 每次发布后检查:

```bash
tar tzf delta-from-*.tar.gz | grep integrity
# 期望输出:
# .../modified/security/integrity-hashes.json
# .../modified/security/integrity-hashes-root.json
```

### 8.4 License/激活码 不受影响

| 数据 | 存储位置 | 是否在 dist/ 中 | 升级影响 |
|------|----------|-----------------|----------|
| license key | `openclawcn.json` (用户配置) | 否 | 不受影响 |
| AES-256-GCM 加密缓存 | `~/.openclawcn/secure-cache/` | 否 | 不受影响 |
| master key | `~/.openclawcn/.master-key` | 否 | 不受影响 |
| 设备指纹 | Windows MachineGuid / macOS IOPlatformUUID | 否 | 不受影响 |
| short-term token | 内存 + 本地缓存 | 否 | 升级后自动重新获取 |
| content vault 密钥 | 派生自 MachineGuid | 否 | 不受影响 |

升级后用户无需重新激活。

---

## 9. 必须修复的缺陷

### BUG-1: RPC handlers 未注册

- **文件**: `src/gateway/cn-handlers.ts`
- **改动**: +2 行 (import + 展开)
- **效果**: `update.check` / `update.status` / `update.execute` / `update.dismiss` 可达

### BUG-2: UI 不处理更新广播事件

- **文件**: `ui/src/ui/app-gateway.ts`
- **改动**: +35 行 (处理 `update.available` + `update.progress`)
- **效果**: 服务端推送的更新通知和进度能驱动 UI 状态

### BUG-3: UI 调用旧版 RPC

- **文件**: `ui/src/ui/app.ts`
- **改动**: 重写 `handleRunUpdate()` ~20 行
- **效果**: 从 `update.run` (同步阻塞，无进度) 切换到 `update.execute` (异步，有进度广播)

### BUG-4: Ed25519 签名密钥为占位符

- **文件**: `src/infra/update-signature.ts:38-40`
- **改动**: 替换 1 行 (占位符 → 真实公钥)
- **前置**: 需先生成密钥对 (7.1 节)
- **效果**: 签名验证从"静默跳过"变为"真正校验"

### BUG-5: 启动检查不持久化状态

- **文件**: `src/infra/update-startup.ts`
- **改动**: +15 行 (两处追加 `setAvailableUpdate()`)
- **效果**: gateway 启动 24h 后发现的更新，UI 通过 `update.status` 可读取

### BUG-6: Full 热更新为死代码

- **文件**: `src/infra/installer-updater.ts`
- **改动**: ~15 行 (修改 `checkViaStaticFile` 判定逻辑 + 扩展 updateType 类型)
- **效果**: 无匹配 delta 但有 `url.full` 时走 Full 热更新，而非直接跳转 installer

### BUG-7: 更新域名不一致

- **文件**: `apps/desktop/src-tauri/nsis/hooks.nsh`
- **改动**: 1 行 (`dl.openclawcn.com` → `dl.obplugins.cn`)
- **效果**: NSIS 写入的 `install.json` 与代码默认值一致

### 新增: CI 签名流程

- **文件**: `scripts/release-deploy.ts`
- **改动**: +25 行 (签名函数 + 调用)
- **效果**: 发布产物带 `.sig` 签名文件，客户端可进行非对称校验

### 新增: UI 重连恢复 + dismiss 持久化

- **文件**: `ui/src/ui/app-gateway.ts` (+10 行), `ui/src/ui/app-render.ts` (+5 行)
- **效果**: WebSocket 断线重连后恢复 banner；dismiss 操作持久化到服务端

---

## 10. 用户体验流程

### 10.1 正常 Delta 更新流程

```
用户正在使用 (聊天/设置等)
    │
    │  [后台] Gateway 启动时自动检查 latest.json (24h 间隔)
    │         发现 1.2.0 可用，当前版本 1.1.23 有匹配 delta
    │         写入 available-update.json
    │
    │  [前台] WebSocket 连接/重连时调用 update.status
    │         读取到可用更新
    ▼
┌─────────────────────────────────────────────────────┐
│ 聊天区顶部蓝色 banner:                               │
│ "v1.2.0 可用 — 新增平滑热更新, 修复xxx"              │
│                              [查看详情]  [稍后]      │
└────────────────────────────────────┬────────────────┘
                                     │ 点击 [查看详情]
                                     ▼
┌─────────────────────────────────────────────────────┐
│ 弹窗 — 确认态                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │ 发现新版本 v1.2.0                                │ │
│ │ [增量更新]                                       │ │
│ │                                                  │ │
│ │ 更新日志:                                        │ │
│ │ - 新增平滑热更新                                  │ │
│ │ - 修复内存占用过高问题                             │ │
│ │ - 优化首次启动速度                                 │ │
│ │                                                  │ │
│ │                          [稍后]  [立即更新]       │ │
│ └─────────────────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────┘
                                     │ 点击 [立即更新]
                                     │
                                     │ UI: state.updateExecuting = true
                                     │ RPC: update.execute → gateway
                                     ▼
┌─────────────────────────────────────────────────────┐
│ 弹窗 — 进度态                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │                                                  │ │
│ │  ██████████████████░░░░░░░░  65%                 │ │
│ │  正在下载... 8.2MB / 12.5MB                      │ │
│ │                                                  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ 进度阶段: checking (0-5%)                            │
│          → downloading (5-75%)                       │
│          → applying (75-90%)                         │
│          → verifying (90-95%)                        │
│          → complete (100%)                           │
└────────────────────────────────────┬────────────────┘
                                     │ 广播: update.progress { stage: "complete" }
                                     ▼
┌─────────────────────────────────────────────────────┐
│ 弹窗 — 完成态                                        │
│ ┌─────────────────────────────────────────────────┐ │
│ │              ✓ 更新完成!                          │ │
│ │                                                  │ │
│ │     新版本将在重启后生效。                          │ │
│ │     您可以继续当前工作，稍后重启。                  │ │
│ │                                                  │ │
│ │                    [稍后重启]  [立即重启]          │ │
│ └─────────────────────────────────────────────────┘ │
└────────────────────────────────────┬────────────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      │ [稍后重启]                    │ [立即重启]
                      ▼                              ▼
              弹窗关闭                        SIGUSR1 → gateway 重启
              用户继续聊天                    WebSocket 断开
              下次打开应用自动生效             自动 reconnect
                                             新版本运行
```

### 10.2 失败场景

| 场景 | 用户看到 | 系统行为 |
|------|----------|----------|
| Delta 下载失败 (网络错误) | 弹窗显示错误信息 + [重试] 按钮 | 30s 无数据超时，广播 `update.progress { stage: "error" }` |
| Delta 校验失败 (SHA256 不匹配) | 弹窗显示 "校验失败" + [重试] | 自动三阶段回滚，恢复旧版本 |
| Delta 签名验证失败 | 弹窗显示 "签名验证失败" + [重试] | 拒绝应用，不修改任何文件 |
| 版本太旧无 delta | 弹窗显示 Full 更新确认 (较大下载量) | 自动降级为 Full 热更新 |
| 版本极旧 (< minVersion) | 弹窗显示下载链接 + [下载安装包] 按钮 | 返回 installer-redirect |
| Full 应用后校验失败 | 弹窗显示 "更新失败已回滚" | 三阶段回滚恢复旧版本 |
| 回滚也失败 (极端) | 弹窗显示 "请重新安装" | 系统可能处于不一致状态 |

---

## 11. 多版本兼容策略

### 11.1 首次发布带热更新能力的版本

这是一个**鸡蛋问题**: 旧版本客户端没有 `update.check` / `update.execute` RPC，无法感知和执行热更新。

**解决方案**:

1. 本次发布版本 (假设 1.2.0) 是第一个包含完整热更新能力的版本
2. 所有 < 1.2.0 的用户**必须通过手动安装**升级到 1.2.0
3. 通知渠道: 用户群/公告/设置页提示
4. 从 1.2.0 开始，后续所有版本升级均可走平滑热更新
5. `latest.json` 的 `minVersion` 设为 `"1.2.0"`，确保 < 1.2.0 的用户走 installer 跳转

### 11.2 版本升级矩阵

| 用户当前版本 | 目标版本 | 路径 | 包类型 |
|---|---|---|---|
| **1.2.0** (上一版本) | 1.3.0 | Delta 热更新 | delta-from-1.2.0.tar.gz (~1-10MB) |
| **1.2.x** (最近 5 个版本之一) | 1.3.0 | Delta 热更新 | delta-from-1.2.x.tar.gz |
| **1.2.0** (有热更新但无 delta) | 1.5.0 | Full 热更新 | full.tar.gz (~20-50MB) |
| **< 1.2.0** (无热更新能力) | any | Installer 跳转 | 弹窗下载链接 (旧版走不到这里，需手动) |

### 11.3 release-cache 保留策略

CI 构建机 `.release-cache/` 最多保留 5 个版本。发布 1.3.0 时:

```
.release-cache/
  1.2.4/dist/    ← 生成 delta-from-1.2.4.tar.gz
  1.2.3/dist/    ← 生成 delta-from-1.2.3.tar.gz
  1.2.2/dist/    ← 生成 delta-from-1.2.2.tar.gz
  1.2.1/dist/    ← 生成 delta-from-1.2.1.tar.gz
  1.2.0/dist/    ← 生成 delta-from-1.2.0.tar.gz
```

超出 5 个版本的用户自动走 Full 热更新。

---

## 12. 验收标准

### 12.1 功能验收

| # | 测试场景 | 预期结果 | 验证方式 |
|---|----------|----------|----------|
| T1 | Gateway 启动后 24h 检查 | `available-update.json` 被写入 | 查看 state 目录文件 |
| T2 | UI 连接后显示 banner | 聊天区顶部出现蓝色通知 | 截图确认 |
| T3 | 点击 [查看详情] | 弹窗显示版本号 + changelog + [立即更新] | 截图确认 |
| T4 | Delta 热更新成功 | 进度条走完 + 完成态弹窗 | 检查 dist/ 下文件被替换 |
| T5 | Full 热更新成功 | 进度条走完 + 完成态弹窗 | 检查 dist/ + skills/ + extensions/ 被替换 |
| T6 | Installer 跳转 | 弹窗显示下载链接 | 点击链接可下载 .exe |
| T7 | [立即重启] | Gateway 重启，WebSocket 自动重连 | UI 恢复正常，版本号更新 |
| T8 | [稍后重启] | 弹窗关闭，对话继续 | 对话功能不受影响 |
| T9 | [稍后] dismiss | Banner 消失，重连后不再显示同版本 | 关闭重开确认 |
| T10 | Delta 校验失败回滚 | 弹窗显示错误，dist/ 恢复旧版本 | diff 确认文件一致 |
| T11 | 网络中断后重试 | 30s 超时 → 错误弹窗 → [重试] 可用 | 断网测试 |
| T12 | Ed25519 签名校验 | 篡改 .sig 文件后更新被拒绝 | 手动修改 .sig 测试 |
| T13 | integrity-hashes 联动 | Delta 包中包含 integrity-hashes*.json | `tar tzf` 检查 |
| T14 | 升级后 license 保持 | 无需重新激活 | 升级后检查 license 状态 |
| T15 | 升级后 integrity-patrol 正常 | 启动无 integrity 校验错误 | 查看启动日志 |

### 12.2 安全验收

| # | 测试场景 | 预期结果 |
|---|----------|----------|
| S1 | Ed25519 公钥已替换为真实密钥 | `isUpdateSigningKeyConfigured()` 返回 `true` |
| S2 | CI 产物均带 `.sig` 文件 | `full.tar.gz.sig`, `checksums.json.sig`, `delta-from-*.sig` 存在 |
| S3 | 篡改 delta.tar.gz 后 SHA256 不匹配 | 更新被拒绝 |
| S4 | 篡改 .sig 文件后签名不匹配 | 更新被拒绝 |
| S5 | delta.json 中路径包含 `../` | `assertWithinRoot()` 拒绝，更新失败 |

---

## 13. 风险登记表

| ID | 风险 | 概率 | 影响 | 缓解措施 |
|----|------|------|------|----------|
| R1 | 换构建机后 .jsc hash 全变，delta 包暴增 | 中 | 中 | CI 文档明确要求同一构建环境；换环境后清空 .release-cache/ |
| R2 | Windows 文件锁导致替换失败 (杀毒软件/Node worker) | 高 | 中 | 更新前 gateway 关闭所有 worker；对锁定文件重试 3 次 |
| R3 | 90 服务器磁盘满导致上传失败 | 低 | 高 | 只保留最近 10 个版本，旧版本归档或删除 |
| R4 | Node.js 小版本升级导致 .jsc 不兼容 | 低 | 极高 | V8 atomicity check (已有): node.exe 变更但无 .jsc 时拒绝 delta |
| R5 | 回滚失败 (broken 状态) | 极低 | 极高 | 三阶段回滚 (snapshot → restore → recover)；极端情况引导重装 |
| R6 | 第一批用户无法自动升级 | 确定 | 高 | 群通知 + 手动安装 1.2.0；此后所有版本可热更新 |
| R7 | skills/extensions 变更未通过 delta 投递 | 中 | 低 | 短期可接受：skills/extensions 变更频率低；需要时走 full |
| R8 | 更新过程中用户关闭应用 | 中 | 中 | 已有备份机制；下次启动 gateway 检查 .update-backup/ 做恢复 |

---

## 14. 改动清单

### 14.1 客户端代码改动

| 文件 | 改动类型 | 估计行数 | 关联 BUG |
|------|----------|----------|----------|
| `src/gateway/cn-handlers.ts` | 新增 import + 展开 | +2 | BUG-1 |
| `ui/src/ui/app-gateway.ts` | 新增事件处理 + 重连恢复 | +45 | BUG-2, 6.7 |
| `ui/src/ui/app.ts` | 重写 handleRunUpdate() | ~20 (重写) | BUG-3 |
| `src/infra/update-signature.ts` | 替换占位符公钥 | 1 (替换) | BUG-4 |
| `src/infra/update-startup.ts` | 追加 setAvailableUpdate() | +15 | BUG-5 |
| `src/infra/installer-updater.ts` | 修改 checkViaStaticFile 判定 + 扩展类型 | ~15 | BUG-6 |
| `apps/desktop/src-tauri/nsis/hooks.nsh` | 统一域名 | 1 (替换) | BUG-7 |
| `ui/src/ui/app-render.ts` | dismiss 调用 update.dismiss RPC | +5 | 6.7 |
| **客户端合计** | | **~105 行** | |

### 14.2 CI/发布流程改动

| 文件 | 改动类型 | 估计行数 |
|------|----------|----------|
| `scripts/release-deploy.ts` | 新增签名步骤 | +25 |
| **CI 合计** | | **~25 行** |

### 14.3 服务端配置

| 配置 | 改动 |
|------|------|
| 90 服务器 Nginx | 新增 `location /releases/` block (~15 行) |
| 90 服务器目录 | 创建 `/var/www/updates/releases/` |

### 14.4 一次性操作

| 操作 | 说明 |
|------|------|
| 生成 Ed25519 密钥对 | `openssl genpkey -algorithm Ed25519` |
| 配置 CI 环境变量 | `UPDATE_SIGNING_PRIVATE_KEY` |
| 首次完整发布 | 生成 `latest.json` + `full.tar.gz` (无 delta，因为无缓存) |
| 通知现有用户 | 手动安装 1.2.0 (首个带热更新能力的版本) |

---

> **总改动量**: 客户端 ~105 行 + CI ~25 行 + Nginx ~15 行 = **~145 行代码改动**
>
> 其中大部分已有代码基础设施可直接使用，核心工作是"接通断点"而非"从零构建"。
