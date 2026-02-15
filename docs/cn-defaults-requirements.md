# CN 区域默认配置 — 需求规格书

> 基于代码实查，非 AI 推测。所有值均与 `setup-wizard.ts`、`security.ts`、`CN_DEFAULT_SECURITY_CONFIG` 对齐。
>
> 最后更新：2025-02-08

---

## 一、功能定义

### 1.1 目标

CN 区域用户首次启动时，**不需要手动配置安全、沙箱、并发等参数**，系统自动填入与 Setup Wizard "标准模式" 一致的默认值。用户只需：

1. 填写 API Key（唯一必填项）
2. 选择工作目录（有默认值）
3. 开始使用

### 1.2 生效条件

`detectChinaRegion()` 返回 `true` 时自动生效。检测逻辑（`src/config/region-cn.ts`）：

| 优先级 | 条件 | 结果 |
|:---:|------|------|
| 1 | `OPENCLAWCN_REGION=cn` | 强制 CN |
| 2 | `OPENCLAWCN_REGION=global` | 强制非 CN |
| 3 | 系统时区 `Asia/Shanghai` | CN |
| 4 | `LANG` 包含 `zh_CN` | CN |
| 5 | 以上均不匹配 | 非 CN |

### 1.3 核心原则

- **只填空不覆盖**：仅当配置字段值为 `undefined` 时写入默认值
- **运行时生效**：默认值不持久化到 `openclawcn.json`，迁移到非 CN 区域时自动失效
- **用户通过 Setup Wizard 或 UI 手动设置的值永远优先**

---

## 二、三平台默认 Config

### 2.1 通用默认值（所有平台）

以下值在 CN 区域自动填入（与 `setup-wizard.ts` "标准模式" 一致）：

```jsonc
{
  "tools": {
    "exec": {
      // 白名单模式：只有 safeBins 中的命令可以执行
      "security": "allowlist",
      // 未知命令询问用户，而不是直接拒绝
      "ask": "on-miss",
      // 预置常用命令白名单（来源：CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist）
      "safeBins": [
        "notepad", "explorer", "calc", "mspaint", "code", "cmd", "powershell",
        "python", "python3", "pip", "pip3",
        "node", "npm", "pnpm", "yarn", "bun",
        "git",
        "java", "javac", "mvn", "gradle",
        "go", "cargo", "dotnet",
        "tar", "zip", "unzip",
        "curl", "wget",
        "wps"
      ]
    }
  },
  "agents": {
    "defaults": {
      "sandbox": {
        // 非主代理沙箱隔离（来源：CN_DEFAULT_SECURITY_CONFIG.sandbox.mode）
        "mode": "non-main",
        // 会话级隔离
        "scope": "session",
        // 工作目录可读写
        "workspaceAccess": "rw"
      },
      // 15 分钟超时
      "timeoutSeconds": 900
    }
  }
}
```

### 2.2 平台差异值

| 配置路径 | Windows | macOS | Linux |
|---------|:---:|:---:|:---:|
| `agents.defaults.maxConcurrent` | **3** | 4 | 4 |
| `agents.defaults.subagents.maxConcurrent` | **6** | 8 | 8 |

Windows 并发数更低，因为：
- Windows 进程创建开销高于 Unix 的 fork
- 多数 CN Windows 用户为桌面机，同时运行大量其他应用

### 2.3 完整三平台默认 Config 示例

#### Windows

```jsonc
{
  "tools": {
    "exec": {
      "security": "allowlist",
      "ask": "on-miss",
      "safeBins": ["notepad","explorer","calc","mspaint","code","cmd","powershell","python","python3","pip","pip3","node","npm","pnpm","yarn","bun","git","java","javac","mvn","gradle","go","cargo","dotnet","tar","zip","unzip","curl","wget","wps"]
    }
  },
  "agents": {
    "defaults": {
      "sandbox": { "mode": "non-main", "scope": "session", "workspaceAccess": "rw" },
      "maxConcurrent": 3,
      "subagents": { "maxConcurrent": 6 },
      "timeoutSeconds": 900
    }
  }
}
```

#### macOS / Linux

```jsonc
{
  "tools": {
    "exec": {
      "security": "allowlist",
      "ask": "on-miss",
      "safeBins": ["notepad","explorer","calc","mspaint","code","cmd","powershell","python","python3","pip","pip3","node","npm","pnpm","yarn","bun","git","java","javac","mvn","gradle","go","cargo","dotnet","tar","zip","unzip","curl","wget","wps"]
    }
  },
  "agents": {
    "defaults": {
      "sandbox": { "mode": "non-main", "scope": "session", "workspaceAccess": "rw" },
      "maxConcurrent": 4,
      "subagents": { "maxConcurrent": 8 },
      "timeoutSeconds": 900
    }
  }
}
```

---

## 三、在哪里展示给用户

### 3.1 Overview 页面 — 安全卡片

**文件**：`ui/src/ui/views/overview.ts` → `renderSecurityCard()`

用户打开首页即可看到当前安全模式：
- 显示当前模式名称、描述、图标
- 三种模式可选：`trust`（⚡危险）、`standard`（🏠推荐）、`full`（🔒仅聊天）
- 切换到 "trust" 模式时弹出红色警告确认框

**与 `applyCnDefaults` 的关系**：如果用户未通过 Setup Wizard 配置安全模式，`applyCnDefaults` 填入的值（`security: "allowlist"`, `sandbox.mode: "non-main"`）对应的是 **"standard" 模式**，即 Overview 页面默认显示 🏠 标准模式。

### 3.2 Config 页面 — 完整设置编辑器

**文件**：`ui/src/ui/views/config.ts`

提供两种编辑模式：
- **表单模式**：按 section 分组的可视化表单（env、agents、auth、channels、tools 等）
- **JSON5 原始编辑器**：直接编辑完整配置文件

用户可以在这里看到并修改所有 `applyCnDefaults` 填入的值：
- `Tools > Exec > security` → "allowlist"
- `Tools > Exec > ask` → "on-miss"
- `Tools > Exec > safeBins` → 命令列表
- `Agents > Defaults > Sandbox > mode` → "non-main"
- `Agents > Defaults > maxConcurrent` → 3 或 4

### 3.3 Setup Wizard — 初始配置向导

**文件**：`src/gateway/setup-wizard.ts`

Setup Wizard 的安全配置步骤（Step 4）会显式设置这些值并**持久化到 openclawcn.json**。一旦持久化，`applyCnDefaults` 发现字段已有值就跳过。

---

## 四、用户如何修改

### 4.1 六种修改途径

| # | 途径 | 适合人群 | 实时生效 |
|---|------|---------|:---:|
| 1 | **Setup Wizard UI** | 首次安装用户 | 需重启 |
| 2 | **Overview 安全卡片** | 普通用户 | 需重启 |
| 3 | **Config 页面** | 进阶用户 | 热更新/重启 |
| 4 | **RPC API** (`config.set/patch/apply`) | 开发者 | 热更新/重启 |
| 5 | **CLI** (`openclawcn config set ...`) | 运维人员 | 需重启 |
| 6 | **手动编辑文件** | 高级用户 | 文件监听自动重载 |

### 4.2 配置文件位置

| 平台 | 路径 |
|------|------|
| Windows | `%USERPROFILE%\.openclawcn\openclawcn.json` |
| macOS | `~/.openclawcn/openclawcn.json` |
| Linux | `~/.openclawcn/openclawcn.json` |

可通过环境变量 `OPENCLAWCN_CONFIG_PATH` 或 `OPENCLAWCN_STATE_DIR` 覆盖。

### 4.3 修改示例

**通过 UI Config 页面**：打开 `http://localhost:18789/` → 设置 → 找到对应字段修改 → 保存

**通过 CLI**：
```bash
# 查看当前值
openclawcn config get tools.exec.security

# 修改为完全信任模式
openclawcn config set tools.exec.security full

# 修改并发数
openclawcn config set agents.defaults.maxConcurrent 6 --json
```

**通过 API**：
```bash
openclawcn gateway call config.patch --params '{"raw":"{\"tools\":{\"exec\":{\"security\":\"full\"}}}"}'
```

**手动编辑**：
```bash
# 编辑配置文件（推荐 VSCode 或 nano）
code ~/.openclawcn/openclawcn.json
# 编辑后验证
openclawcn doctor
```

---

## 五、Gateway 热更新机制

### 5.1 核心结论

**Gateway 支持热更新，大部分配置修改不需要重启服务。**

### 5.2 工作原理

**文件**：`src/gateway/config-reload.ts`

- **监听方式**：Chokidar 文件监听器，监视 `~/.openclawcn/openclawcn.json` 的 `add/change/unlink` 事件
- **防抖**：300ms（可通过 `gateway.reload.debounceMs` 配置）
- **重载模式**（`gateway.reload.mode`）：

| 模式 | 行为 |
|------|------|
| `"hybrid"` (默认) | 兼容的变更热更新，不兼容的变更重启 |
| `"hot"` | 仅热更新，忽略需要重启的变更 |
| `"restart"` | 所有变更都触发完整重启 |
| `"off"` | 禁用自动重载，需手动重启 |

### 5.3 变更分类

| 变更类型 | 处理方式 | 示例 |
|---------|---------|------|
| **免重启** | 运行时动态读取 | `auth`, `channels`, `identity`, `tools`, `agents`, `models`, `skills`, `ui` |
| **组件热重启** | 重启特定组件 | `hooks.*` → 重载 hook 系统；`cron.*` → 重启定时任务 |
| **全量重启** | 重启整个 Gateway | `gateway.*`（端口/TLS/认证）, `plugins.*`, `discovery.*` |

### 5.4 与 `applyCnDefaults` 的关系

`applyCnDefaults` 修改的字段（`tools.exec.*`, `agents.defaults.*`）属于**免重启**类别，修改后通过文件监听自动生效。但由于 `applyCnDefaults` 是运行时填充（不写入文件），以下场景会触发：

1. 用户通过 UI/CLI 显式设置值 → 写入 `openclawcn.json` → 文件监听触发 → 热更新生效
2. `applyCnDefaults` 的默认值 → 仅在 `loadConfig()` / `readConfigFileSnapshot()` 时填入 → Gateway 启动时生效

---

## 六、实现文件清单

| 文件 | 职责 |
|------|------|
| `src/config/defaults.ts` → `applyCnDefaults()` | 核心实现：填充 CN 默认值 |
| `src/config/io.ts` | 3 处链注入（`applySession → applyCn → applyAgent`） |
| `src/config/region-cn.ts` → `detectChinaRegion()` | CN 区域检测 |
| `src/config/region-cn.ts` → `CN_DEFAULT_SECURITY_CONFIG` | 安全默认值数据源 |
| `src/gateway/setup-wizard.ts` → `handleConfigureSecurity()` | Setup Wizard 安全配置（持久化） |
| `src/gateway/server-methods/security.ts` | 安全模式切换 API |
| `src/gateway/config-reload.ts` | 文件监听 + 热更新 |
| `src/config/defaults-cn.test.ts` | 23 个单元测试 |

---

## 七、默认值来源对照表

| 配置字段 | `applyCnDefaults` | `setup-wizard` 标准模式 | `CN_DEFAULT_SECURITY_CONFIG` |
|---------|:---:|:---:|:---:|
| `tools.exec.security` | `"allowlist"` | `"allowlist"` | `"allowlist"` |
| `tools.exec.ask` | `"on-miss"` | `"on-miss"` | — |
| `tools.exec.safeBins` | `CN_DEFAULT_..allowlist` | 硬编码列表(类似) | `.tools.exec.allowlist` |
| `sandbox.mode` | `"non-main"` | `CN_DEFAULT_..sandbox` | `"non-main"` |
| `sandbox.scope` | `"session"` | `CN_DEFAULT_..sandbox` | `"session"` |
| `sandbox.workspaceAccess` | `"rw"` | `CN_DEFAULT_..sandbox` | `"rw"` |
| `maxConcurrent` | Win:3 / 其他:4 | — | — |
| `subagents.maxConcurrent` | Win:6 / 其他:8 | — | — |
| `timeoutSeconds` | 900 | — | — |

三列数值**完全一致**（安全相关字段）。性能字段（maxConcurrent, timeoutSeconds）是 `applyCnDefaults` 独有的补充。

---

## 八、全参数默认值清单（按操作系统）

### 8.1 工具安全类（`tools.exec.*`）

| # | 配置路径 | 类型 | Windows CN | macOS CN | Linux CN | 非 CN 全局默认 | 设置原因 |
|---|---------|------|:----------:|:--------:|:--------:|:-------------:|---------|
| 1 | `tools.exec.security` | `"deny" \| "allowlist" \| "full"` | `"allowlist"` | `"allowlist"` | `"allowlist"` | `"deny"` | 白名单模式：只有 `safeBins` 中的命令允许执行。与 `setup-wizard.ts` 标准模式一致。全局默认 `"deny"` 禁止一切命令，CN 用户首次启动后 AI 完全无法操作 |
| 2 | `tools.exec.ask` | `"off" \| "on-miss" \| "always"` | `"on-miss"` | `"on-miss"` | `"on-miss"` | `"on-miss"` | 白名单外的未知命令不直接拒绝，而是弹窗询问用户是否允许。与 `setup-wizard.ts` 标准模式一致。平衡安全与易用性 |
| 3 | `tools.exec.safeBins` | `string[]` | 30 个命令 | 30 个命令 | 30 个命令 | `undefined` | 预置 CN 开发者常用命令白名单，来源：`CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist`。无此列表时 `allowlist` 模式等于禁止一切命令 |

#### `safeBins` 完整命令清单（三平台相同，共 30 个）

| 分类 | 命令 | 说明 |
|------|------|------|
| Windows 常用 | `notepad`, `explorer`, `calc`, `mspaint`, `code`, `cmd`, `powershell` | Windows 系统/编辑器工具（macOS/Linux 下不影响） |
| Python | `python`, `python3`, `pip`, `pip3` | Python 开发 |
| Node.js | `node`, `npm`, `pnpm`, `yarn`, `bun` | 前端/Node 开发 |
| 版本控制 | `git` | 代码管理 |
| Java | `java`, `javac`, `mvn`, `gradle` | Java 生态 |
| 其他语言 | `go`, `cargo`, `dotnet` | Go / Rust / .NET |
| 压缩工具 | `tar`, `zip`, `unzip` | 文件压缩解压 |
| 网络工具 | `curl`, `wget` | HTTP 请求（只读安全） |
| 办公软件 | `wps` | 国产办公软件（CN 用户高频使用） |

### 8.2 沙箱隔离类（`agents.defaults.sandbox.*`）

| # | 配置路径 | 类型 | Windows CN | macOS CN | Linux CN | 非 CN 全局默认 | 设置原因 |
|---|---------|------|:----------:|:--------:|:--------:|:-------------:|---------|
| 4 | `agents.defaults.sandbox.mode` | `string` | `"non-main"` | `"non-main"` | `"non-main"` | `undefined` | 非主代理在沙箱中运行，主代理直接在宿主执行。来源：`CN_DEFAULT_SECURITY_CONFIG.sandbox.mode`。与 `setup-wizard.ts` 标准模式一致 |
| 5 | `agents.defaults.sandbox.scope` | `string` | `"session"` | `"session"` | `"session"` | `undefined` | 会话级沙箱隔离——每个会话独立沙箱，会话结束后清理。来源：`CN_DEFAULT_SECURITY_CONFIG.sandbox.scope` |
| 6 | `agents.defaults.sandbox.workspaceAccess` | `string` | `"rw"` | `"rw"` | `"rw"` | `undefined` | 沙箱对工作目录可读写。来源：`CN_DEFAULT_SECURITY_CONFIG.sandbox.workspaceAccess`。AI 需要读写项目文件才能完成编码任务 |

### 8.3 代理性能类（`agents.defaults.*`）

| # | 配置路径 | 类型 | Windows CN | macOS CN | Linux CN | 非 CN 全局默认 | 设置原因 |
|---|---------|------|:----------:|:--------:|:--------:|:-------------:|---------|
| 7 | `agents.defaults.maxConcurrent` | `number` | **3** | 4 | 4 | 4 (`DEFAULT_AGENT_MAX_CONCURRENT`) | 主代理最大并发数。Windows 更低（3），原因：Windows 进程创建开销高于 Unix fork，且多数 CN Windows 用户为桌面机，同时运行大量其他应用（微信、浏览器、WPS 等） |
| 8 | `agents.defaults.subagents.maxConcurrent` | `number` | **6** | 8 | 8 | 8 (`DEFAULT_SUBAGENT_MAX_CONCURRENT`) | 子代理最大并发数。Windows 更低（6），原因同上。子代理并发通常是主代理的 2 倍，因子代理任务更轻量 |
| 9 | `agents.defaults.timeoutSeconds` | `number` | 900 | 900 | 900 | `undefined` | 15 分钟超时。CN 用户网络环境不稳定（API 延迟更高），合理超时避免长时间挂起浪费资源，同时 15 分钟足以完成绝大多数 AI 任务 |

### 8.4 汇总对照表

| # | 配置路径 | Win CN | Mac CN | Linux CN | 非CN默认 | 三平台是否一致 | 数据来源 |
|---|---------|:------:|:------:|:--------:|:--------:|:-----------:|---------|
| 1 | `tools.exec.security` | `allowlist` | `allowlist` | `allowlist` | `deny` | 一致 | `CN_DEFAULT_SECURITY_CONFIG` + `setup-wizard` |
| 2 | `tools.exec.ask` | `on-miss` | `on-miss` | `on-miss` | `on-miss` | 一致 | `setup-wizard` 标准模式 |
| 3 | `tools.exec.safeBins` | 30 cmd | 30 cmd | 30 cmd | ∅ | 一致 | `CN_DEFAULT_SECURITY_CONFIG.tools.exec.allowlist` |
| 4 | `sandbox.mode` | `non-main` | `non-main` | `non-main` | ∅ | 一致 | `CN_DEFAULT_SECURITY_CONFIG.sandbox.mode` |
| 5 | `sandbox.scope` | `session` | `session` | `session` | ∅ | 一致 | `CN_DEFAULT_SECURITY_CONFIG.sandbox.scope` |
| 6 | `sandbox.workspaceAccess` | `rw` | `rw` | `rw` | ∅ | 一致 | `CN_DEFAULT_SECURITY_CONFIG.sandbox.workspaceAccess` |
| 7 | `maxConcurrent` | **3** | 4 | 4 | 4 | **Win 不同** | `applyCnDefaults` 独有（平台感知） |
| 8 | `subagents.maxConcurrent` | **6** | 8 | 8 | 8 | **Win 不同** | `applyCnDefaults` 独有（平台感知） |
| 9 | `timeoutSeconds` | 900 | 900 | 900 | ∅ | 一致 | `applyCnDefaults` 独有 |

### 8.5 关键机制说明

| 项目 | 说明 |
|------|------|
| **只填空不覆盖** | 仅当字段值 `=== undefined` 时写入，用户任何手动设置（包括 `"deny"`、`"off"` 等限制性值）都不会被覆盖 |
| **运行时生效，不持久化** | 默认值不写入 `openclawcn.json`，仅存在于内存。迁移到非 CN 区域后自动失效 |
| **链顺序** | `applySessionDefaults` → **`applyCnDefaults`** → `applyAgentDefaults`。CN 先写入 Win:3，`applyAgentDefaults` 发现已有值跳过，不会覆盖为全局默认 4 |
| **平台检测** | `os.platform() === "win32"` 区分 Windows；macOS (`darwin`) 和 Linux (`linux`) 使用相同值 |
| **区域检测** | `detectChinaRegion()`: 环境变量 `OPENCLAWCN_REGION` > 时区 `Asia/Shanghai` > `LANG=zh_CN` |
| **Gateway 热更新** | `tools.*` 和 `agents.*` 属于免重启类别，用户通过 UI/CLI 修改后立即生效（Chokidar 文件监听 + 300ms 防抖） |
| **代码来源对齐** | 所有安全相关值与 `setup-wizard.ts` L1042-1074 和 `CN_DEFAULT_SECURITY_CONFIG` L984-1041 完全一致 |
