---
name: ios-simulator
name_zh: iOS 模拟器
description: 自动化 iOS 模拟器工作流（simctl + idb）：创建/启动/擦除设备、安装/启动应用、推送通知、授予隐私权限、截屏，以及基于可访问性（accessibility）的 UI 导航。适用于 iOS 应用开发、Xcode、模拟器、simctl、idb、UI 自动化或 iOS 测试场景。
description_zh: 自动化 iOS 模拟器工作流（simctl + idb）：创建/启动/擦除设备、安装/启动应用、推送通知、授予隐私权限、截屏，以及基于可访问性（accessibility）的 UI 导航。适用于 iOS 应用开发、Xcode、模拟器、simctl、idb、UI 自动化或 iOS 测试场景。
metadata: {"clawdbot":{"emoji":"📱","os":["darwin"],"requires":{"bins":["xcrun"]},"install":[{"id":"brew","kind":"brew","formula":"idb-companion","bins":["idb_companion"],"tap":"facebook/fb","label":"Install idb-companion (brew)"}]}}
---
# iOS 模拟器自动化

本 skill 提供一个**仅依赖 Node.js** 的命令行封装工具，用于：
- `xcrun simctl`：管理模拟器、设备与应用  
- `idb`：**可访问性树（accessibility-tree）** 检查 + 合成 UI 输入（点击/输入文本/按钮操作）

专为 **AI agents** 设计：默认输出精简、结构化；支持按需启用详细信息。

## 重要约束条件

- **必须在 macOS 上运行**，且已安装 Xcode 命令行工具（或完整版 Xcode）。
- 若 ClawdBot 网关非 macOS 系统，请在连接的 **macOS 节点** 上执行这些命令（参见下方“远程 macOS 节点”说明）。  
- `idb` 为可选组件，但若需访问 UI 树或语义化点击（semantic tapping），则为必需。（安装步骤见下文。）

## 快速开始

```bash
# 1) Sanity check
node {baseDir}/scripts/ios-sim.mjs health

# 2) List simulators (compact)
node {baseDir}/scripts/ios-sim.mjs list

# 3) Select a default simulator (writes .ios-sim-state.json in the current dir)
node {baseDir}/scripts/ios-sim.mjs select --name "iPhone" --runtime "iOS" --boot

# 4) Install + launch an .app
node {baseDir}/scripts/ios-sim.mjs app install --app path/to/MyApp.app
node {baseDir}/scripts/ios-sim.mjs app launch --bundle-id com.example.MyApp

# 5) Inspect current UI (requires idb)
node {baseDir}/scripts/ios-sim.mjs ui summary
node {baseDir}/scripts/ios-sim.mjs ui tap --query "Log in"
node {baseDir}/scripts/ios-sim.mjs ui type --text "hello world"

# 6) Screenshot
node {baseDir}/scripts/ios-sim.mjs screenshot --out artifacts/screen.png
```

## 远程 macOS 节点

若您当前不在 macOS 环境中，请使用 ClawdBot 的节点执行功能（例如 `exec` 配合 `host: node` / 节点工具），在 macOS 节点上运行相同命令。请确保该节点上已存在本 skill 文件夹，或将其复制过去。

## 输出约定（兼顾 token 效率）

- 默认输出：**单行 JSON**（含简明摘要对象）。
- 添加 `--pretty` 参数可美化打印 JSON。
- 添加 `--text` 参数可获取简短的人类可读摘要（若对应命令支持提供）。
- 可能产生超大输出的命令（如 `ui tree`、`list --full`）需**显式启用**。

## 状态 / 默认 UDID

`select` 会写入一个状态文件（默认路径：`./.ios-sim-state.json`），用于保存所选设备的 UDID。  
所有命令均接受 `--udid <UUID>` 参数；若未指定，则自动回退至状态文件中的 UDID。

可通过以下方式覆盖状态文件位置：
- `IOS_SIM_STATE_FILE=/path/to/state.json`

## 依赖项说明

### Xcode / simctl 可用性
若 `xcrun` 找不到 `simctl`，请确认已正确选择 Xcode CLI 工具（通过 Xcode 设置界面或执行 `xcode-select`），并运行首次启动配置：
- `xcodebuild -runFirstLaunch`

### idb（用于可访问性自动化）
请安装 `idb_companion` 及其配套的 `idb` CLI：
```bash
brew tap facebook/fb
brew install idb-companion
python3 -m pip install --upgrade fb-idb
```

## 安全等级分级

| 等级 | 命令 | 说明 |
|------|------|------|
| SAFE（安全） | `list`, `health`, `boot`, `shutdown`, `screenshot`, `ui *` | 不会造成数据丢失 |
| CAUTION（谨慎） | `privacy *`, `push`, `clipboard *`, `openurl` | 会修改模拟器或应用状态 |
| DANGEROUS（危险） | `erase`, `delete` | 需要 `--yes` 权限 |

## 命令索引

所有命令均位于以下路径下：
```bash
node {baseDir}/scripts/ios-sim.mjs <command> [subcommand] [flags]
```

### 核心模拟器生命周期管理
- `list [--full]`
- `select --name <substr> [--runtime <substr>] [--boot]`
- `boot [--udid <uuid>] [--wait]`
- `shutdown [--udid <uuid>|--all]`
- `erase --yes [--udid <uuid>|--all]`
- `delete --yes [--udid <uuid>]`
- `create --name <name> --device-type <substr> --runtime <substr>`

### 应用管理
- `app install --app <path/to/App.app> [--udid ...]`
- `app uninstall --bundle-id <id> [--udid ...]`
- `app launch --bundle-id <id> [--udid ...] [-- <args...>]`
- `app terminate --bundle-id <id> [--udid ...]`
- `app container --bundle-id <id> [--type data|app] [--udid ...]`

### 截图与录屏
- `screenshot --out <file.png> [--udid ...]`
- `record-video --out <file.mp4> [--udid ...]`（持续运行，直至按下 Ctrl+C）

### 剪贴板与 URL
- `clipboard get [--udid ...]`
- `clipboard set --text <text> [--udid ...]`
- `openurl --url <url> [--udid ...]`

### 模拟器权限与推送通知
- `privacy grant --bundle-id <id> --service <svc[,svc...]> [--udid ...]`
- `privacy revoke --bundle-id <id> --service <svc[,svc...]> [--udid ...]`
- `privacy reset --bundle-id <id> --service <svc[,svc...]> [--udid ...]`
- `push --bundle-id <id> --payload <json-string> [--udid ...]`

### 日志
- `logs show [--last 5m] [--predicate <expr>] [--udid ...]`

### 基于可访问性的 UI 自动化（需 idb）
- `ui summary [--limit 12]`
- `ui tree`（完整 UI JSON 数组）
- `ui find --query <text> [--limit 20]`
- `ui tap --query <text>`（查找并点击最佳匹配项）
- `ui tap --x <num> --y <num>`（原始坐标点击）
- `ui type --text <text>`
- `ui button --name HOME|LOCK|SIRI|SIDE_BUTTON|APPLE_PAY`

## 故障排查

详见：[references/TROUBLESHOOTING.md](references/TROUBLESHOOTING.md)