# Bug 追踪记录

本文档记录用户反馈的问题及修复方案，便于回溯和避免重复问题。

---

## Bug 状态总结（2026-01-30 检查）

| Bug | 描述 | 状态 | 说明 |
|-----|------|------|------|
| #1 | 插件未找到错误 | ✅ 已修复 | extensions 已打包，环境变量已设置 |
| #2 | MiniMax API Key 验证失败 | ✅ 已修复 | 描述已更新，提示只需 API Key |
| #3 | 桌面快捷方式指向 setup.bat | ✅ 已修复 | 已改为指向启动脚本 |
| #4 | Python 未安装/工作目录问题 | 📋 TODO | 长期改进，当前告知用户手动安装 |
| #5 | Skills 数量不足 | 📋 TODO | 长期改进，引导用户访问 Skills 市场 |
| #6 | ERR_MODULE_NOT_FOUND chalk | ⚠️ 待验证 | 构建脚本缺少 node_modules 验证 |
| #7 | 智能模式白名单问题 | ✅ 已修复 | 已添加 ask: on-miss 和 safeBins |
| #17 | Memory Flush 系统提示泄露 | 📋 TODO | 会话接近 token 限制时内部提示泄露给用户 |

### 新增 Bug（今天发现）

| Bug | 描述 | 状态 |
|-----|------|------|
| #8 | 模型配置错误 | ✅ 已修复 |
| #9 | 安装程序界面未完全汉化 | ✅ 已修复 |
| #10 | 安装后桌面无快捷方式 | ✅ 已修复 |
| #11 | 安装程序未校验本地环境 | ✅ 已修复 |
| #12 | 磁盘空间需求显示不准确 | ✅ 已修复 |
| #13 | 启动脚本中文乱码导致崩溃 | ✅ 已修复 |
| #14 | 启动脚本入口点路径错误 | ✅ 已修复 |
| #15 | PowerShell 脚本中文乱码 | ✅ 已修复 |
| #16 | 缺少 node_modules 依赖 | ✅ 已修复 |

**Bug #8 详情**：
- 硅基流动免费模型写错（`Qwen2.5-7B` → `Qwen2-7B`）
- 智谱 `glm-4.5-flash` 今天下线（改为 `glm-4-flash-250414`）
- `deepseek-coder` 已合并到 `deepseek-chat`
- MiniMax `abab6.5s` 已停用（改为 `MiniMax-M2.1`）
- 已更新 `src/config/region-cn.ts` 和 `config.test-keys.json5`

**Bug #9 详情**：安装程序界面未完全汉化
- 问题：安装程序的组件选择页面、任务选择页面显示英文（如 "Core", "Shortcuts", "Desktop", "Start Menu", "Auto Start", "Options:"）
- 原因：ISS 文件中的 Description 参数使用英文，Inno Setup 对中文编码支持不好
- 修复方案：
  1. 在 `ChineseSimplified.isl` 的 `[CustomMessages]` 部分添加自定义消息
  2. 在 ISS 文件中使用 `{cm:MessageName}` 引用这些消息
  3. 使用通俗易懂的中文，避免技术术语
- 修改内容：
  | 原文 | 修改后 |
  |------|--------|
  | 选择附加任务 | 设置快捷方式 |
  | 应该执行哪些附加任务？ | 选择要创建的快捷方式 |
  | Options: | 快捷方式选项: |
  | Desktop | 桌面图标（双击可启动） |
  | Start Menu | 开始菜单 |
  | Auto Start | 开机自动启动 |
- 修改文件：
  - `build/installer/ChineseSimplified.isl` - 修改标准消息和自定义消息
  - `build/installer/clawdbot-windows-unified.iss` - 使用 `{cm:xxx}` 引用中文消息

**Bug #10 详情**：安装后桌面无快捷方式，无法启动
- 问题：安装完成后，桌面没有快捷方式，安装目录里也没有启动脚本
- 原因：快捷方式指向 `StartClawdbot.bat`，但这个文件从未被创建或打包
- 修复方案：
  1. 创建 `build/installer/scripts/StartClawdbot.bat` 启动脚本
  2. 在 ISS 文件的 `[Files]` 部分添加打包该脚本
- 修改文件：
  - `build/installer/scripts/StartClawdbot.bat` - 新增启动脚本
  - `build/installer/clawdbot-windows-unified.iss` - 添加 StartClawdbot.bat 到打包文件

**Bug #11 详情**：安装程序未校验本地环境
- 问题：用户本地已有 Node.js、WSL2 时，安装程序没有检测版本，也没有告知用户检测结果
- 修复方案：在 `setup-environment.ps1` 中添加完整的环境检测：
  1. **Windows 版本检查** - 需要 Build 19041+ (Windows 10 2004)
  2. **Node.js 版本检查** - 需要 v22+，版本不足时警告
  3. **WSL2 状态检查** - 检测是否已安装、是否启用 WSL2
  4. **环境检测摘要** - 安装前显示检测结果
- 检测流程：
  ```
  ========== 环境检测摘要 ==========
  Windows: Build 26200 ✓
  Node.js: v22.13.1 ✓
  WSL2: 已启用 ✓
  ==================================
  ```
- 修改文件：
  - `build/installer/scripts/setup-environment.ps1` - 添加完整环境检测逻辑

**Bug #12 详情**：磁盘空间需求显示不准确
- 问题：安装程序显示 "至少需要 21.9 MB 可用磁盘空间"，但实际安装会下载 WSL 镜像等大文件
- 实际需求：
  - 安装包本身：约 20 MB
  - WSL Ubuntu 镜像：约 500 MB
  - 运行时数据：约 500 MB
  - **总计需要：约 1 GB**
- 修复方案：在 ISS 文件中添加 `ExtraDiskSpaceRequired=1073741824` (1GB)
- 修改文件：
  - `build/installer/clawdbot-windows-unified.iss` - 添加额外磁盘空间需求

**Bug #13 详情**：启动脚本中文乱码导致崩溃
- 问题：StartClawdbot.bat 使用 UTF-8 编码保存，但 Windows CMD 默认使用 GBK 编码
- 症状：中文字符被解析成乱码，乱码被当成命令执行，导致大量错误
- 错误示例：`'涓嶅瓨鍦紒' 不是内部或外部命令`
- 修复方案：将启动脚本改为纯英文（ASCII），避免所有编码问题
- 教训：Windows 批处理文件不要使用中文，除非确保编码正确（GBK/GB2312）
- 修改文件：
  - `build/installer/scripts/StartClawdbot.bat` - 改为调用 PowerShell 脚本

**Bug #14 详情**：启动脚本入口点路径错误 + 改用 PowerShell 支持中文
- 问题 1：启动脚本使用 `dist\cli\index.js` 作为入口点，但实际入口点是 `dist\entry.js`
- 问题 2：.bat 文件无法正确显示中文
- 修复方案：
  1. 创建 PowerShell 启动脚本 `StartClawdbot.ps1`，使用正确的入口点 `dist\entry.js`
  2. PowerShell 原生支持 UTF-8，中文显示正常
  3. .bat 文件只负责调用 PowerShell 脚本
- 修改文件：
  - `build/installer/scripts/StartClawdbot.ps1` - 新建 PowerShell 启动脚本（支持中文）
  - `build/installer/scripts/StartClawdbot.bat` - 简化为调用 PowerShell 脚本
  - `build/installer/clawdbot-windows-unified.iss` - 添加 .ps1 文件到打包列表

**Bug #15 详情**：PowerShell 脚本中文乱码
- 问题：PowerShell 脚本中的中文显示为乱码，导致语法错误
- 错误示例：`[姝ラ 2] 妫€鏌ュ繀瑕佹枃浠?..` (应该是 `[步骤 2] 检查必要文件...`)
- 原因：PowerShell 需要 UTF-8 **with BOM** 格式才能正确识别中文
- 修复：使用 `UTF8Encoding($true)` 保存文件，添加 BOM 头
- 教训：
  - .bat 文件：需要 GBK 编码或纯 ASCII
  - .ps1 文件：需要 UTF-8 with BOM
  - 两种格式都不能直接用 VS Code 默认的 UTF-8 (无 BOM) 保存中文

**Bug #16 详情**：缺少 node_modules 依赖
- 问题：启动报错 `Cannot find package 'chalk'`
- 原因：安装包没有包含 `node_modules`，也没有在安装时下载依赖
- 修复方案：在 `setup-environment.ps1` 中添加 Step 5 安装依赖
  1. 设置 npm 镜像为淘宝镜像 (`https://registry.npmmirror.com`)
  2. 运行 `npm install --omit=dev` 安装生产依赖
  3. 验证关键依赖（如 chalk）是否安装成功
- 修改文件：
  - `build/installer/scripts/setup-environment.ps1` - 添加依赖安装步骤

---

## 2026-01-30

### Bug #1: 插件未找到错误 (plugin not found)

**问题描述：**
用户安装后启动时报错：
```
plugins.entries.feishu: plugin not found: feishu
plugins.entries.telegram: plugin not found: telegram
plugins.entries.whatsapp: plugin not found: whatsapp
...
```

**根本原因：**
1. 用户之前安装过的版本配置文件中启用了插件
2. 新安装的 Windows 版本没有包含这些插件
3. 配置文件 `~/.clawdbot/clawdbot.json` 中的 `plugins.entries` 引用了不存在的插件

**修复方案：**
1. 修改 `build/scripts/windows/build-lite-exe.ps1`，添加复制 extensions 目录的逻辑
2. 在启动脚本中设置 `CLAWDBOT_BUNDLED_PLUGINS_DIR` 环境变量
3. 包含常用插件：feishu, dingtalk, wecom, qwen-portal-auth, telegram, discord, slack, whatsapp, signal, googlechat

**临时解决方案（用户侧）：**
编辑 `C:\Users\<用户名>\.clawdbot\clawdbot.json`，将 `plugins.entries` 清空：
```json
"plugins": {
  "slots": {},
  "entries": {}
}
```

---

### Bug #2: MiniMax API Key 验证失败

**问题描述：**
用户配置 MiniMax 时提示 "API Key 无效"，用户误以为需要 Group ID。

**根本原因：**
1. MiniMax 有两种 API：Anthropic 兼容接口（只需 API Key）和原生 API（需要 Group ID + API Key）
2. 当前使用的是 Anthropic 兼容接口，只需要 API Key
3. 用户可能看了原生 API 的文档，产生混淆

**修复方案：**
1. 修改 `src/gateway/setup-page.ts`，为 MiniMax 添加更清晰的帮助信息："不需要 Group ID"
2. 修改 `src/config/region-cn.ts`，更新描述和文档链接

**相关文件：**
- `src/gateway/setup-page.ts`
- `src/config/region-cn.ts`

---

### Bug #3: 桌面快捷方式指向 setup.bat

**问题描述：**
用户反馈桌面快捷方式指向 `setup.bat`，导致每次启动都进入配置模式。

**根本原因：**
`build/installer/windows-lite.iss` 中桌面快捷方式配置错误，指向 `setup.bat` 而不是 `start.bat`。

**修复方案：**
修改 `build/installer/windows-lite.iss`：
```diff
- Name: "{autodesktop}\ClawdbotCN"; Filename: "{app}\setup.bat"; ...
+ Name: "{autodesktop}\ClawdbotCN"; Filename: "{app}\start.bat"; ...
```

**修复版本：** v2026.1.30

**用户升级说明：**
1. 卸载当前版本（通过控制面板或开始菜单的卸载选项）
2. 安装新版本 `ClawdbotCN-Setup-v2026.1.30.exe`

**临时解决方案（无需重装）：**
1. 右键桌面快捷方式 → 属性
2. 将目标从 `...\setup.bat` 改为 `...\start.bat`

**相关文件：**
- `build/installer/windows-lite.iss`
- `scripts/windows/setup.iss`
- `scripts/windows/build-portable.ps1`
- `scripts/windows/build-standalone.ps1`

---

## 修改文件汇总

| 文件 | 修改内容 |
|------|---------|
| `build/scripts/windows/build-lite-exe.ps1` | 添加 extensions 复制逻辑，添加 CLAWDBOT_BUNDLED_PLUGINS_DIR 环境变量 |
| `build/installer/windows-lite.iss` | 桌面快捷方式改为指向 start.bat |
| `src/gateway/setup-page.ts` | 为各提供商添加具体的帮助信息链接 |
| `src/config/region-cn.ts` | 更新 MiniMax 描述，说明不需要 Group ID |
| `scripts/windows/setup.iss` | 添加常用插件打包 |
| `scripts/windows/start-gateway.bat` | 添加 CLAWDBOT_BUNDLED_PLUGINS_DIR 环境变量 |
| `scripts/windows/clawdbot.bat` | 添加 CLAWDBOT_BUNDLED_PLUGINS_DIR 环境变量 |
| `scripts/windows/build-portable.ps1` | 更新说明区分首次配置和日常使用 |
| `scripts/windows/build-standalone.ps1` | 更新说明区分首次配置和日常使用 |
| `build/scripts/windows/build-lite.ps1` | [Bug #6] node_modules 复制逻辑需要加验证 |
| `build/installer/windows-lite.iss` | [Bug #6] 确保源目录包含 node_modules |
| `src/gateway/setup-wizard.ts` | [Bug #7] 添加 ask: "on-miss" 和 safeBins 白名单配置 |

---

---

### Bug #4: 小白用户环境问题 - Python 未安装 / 工作目录不存在

**问题描述：**
用户执行 skill 时报错：
```
[tools] exec failed: py : 无法将"py"识别为 cmdlet...
[tools] exec failed: dir : 找不到路径 D:\b...
```

**根本原因：**
1. 用户系统没有安装 Python
2. 工作目录配置不正确或目录不存在
3. 小白用户不了解如何配置开发环境

**用户画像：** 小白用户，不熟悉开发环境配置

**当前临时解决方案（告诉用户）：**
1. 安装 Python：https://www.python.org/downloads/（安装时勾选 "Add Python to PATH"）
2. 在配置页面设置有效的工作目录

**长期改进方案（TODO）：**
1. [ ] 在安装包中预置 Python（或提供一键安装脚本）
2. [ ] 首次启动时自动创建默认工作目录（如 `C:\Users\<用户>\ClawdbotCN\workspace`）
3. [ ] 在配置向导中添加环境检测，提示缺少的依赖
4. [ ] 对于缺少 Python 的情况，提供友好的错误提示和安装引导

---

### Bug #5: Skills 数量不足

**问题描述：**
用户反馈 skills 太少，无法满足需求。

**根本原因：**
1. 打包的 skills 数量有限
2. 用户不知道如何获取更多 skills

**当前解决方案：**
告诉用户可以从 Skills 仓库获取更多：
- Gitee: https://gitee.com/tecbinai/skills
- ClawdHub: 在线 skills 市场

**长期改进方案（TODO）：**
1. [ ] 在配置向导中添加 "Skills 市场" 入口
2. [ ] 提供一键安装热门 skills 的功能
3. [ ] 预置更多常用 skills（如：文件操作、网页爬取、代码生成等基础 skills）
4. [ ] 添加 skills 推荐功能，根据用户使用场景推荐

---

### Bug #6: 启动报错 ERR_MODULE_NOT_FOUND: Cannot find package 'chalk'

**问题描述：**
用户安装后第一步就无法启动，浏览器显示 "localhost 拒绝连接"，命令行报错：
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'chalk' imported from D:\123pan\ClawdbotCN\app\dist\logging\subsystem.js
```

**根本原因：**
安装包中缺少 `node_modules` 目录。构建安装包时可能存在以下问题之一：
1. 构建前没有运行 `pnpm install`，导致 `node_modules` 不存在
2. `robocopy` 复制 `node_modules` 时部分失败，但错误被静默忽略（`2>&1 | Out-Null`）
3. 使用了不完整的源目录打包

**修复方案：**
重新构建安装包时确保：
1. 先在项目根目录运行 `pnpm install`
2. 确认 `node_modules` 目录存在且包含 `chalk`
3. 运行构建脚本 `build-lite.ps1`
4. 验证输出目录 `app\node_modules\chalk` 存在后再打包

**临时解决方案（用户侧）：**
在命令行执行：
```batch
cd /d D:\123pan\ClawdbotCN\app
npm install --omit=dev
```
然后重新启动程序。

**相关文件：**
- `build/scripts/windows/build-lite.ps1` - 第 94-105 行复制 node_modules 的逻辑
- `build/installer/windows-lite.iss` - 安装包配置

**改进建议：**
1. [ ] 在 `build-lite.ps1` 中添加 node_modules 存在性检查，不存在则报错退出
2. [ ] robocopy 复制后验证关键模块（如 chalk）是否存在
3. [ ] 构建脚本输出时不要静默忽略错误

---

### Bug #7: 智能模式 + 白名单导致什么都做不了

**问题描述：**
用户使用 `ClawdbotCN-Setup-v2026.1.30.exe` 安装后，选择「智能模式 + 指令白名单」，然后让 Clawdbot 干什么都不行，所有命令都被拒绝。

**根本原因：**
在 `src/gateway/setup-wizard.ts` 第 773-779 行，当用户选择 `standard`（智能保护）模式时：

```typescript
tools: {
  exec: {
    security: "allowlist",  // ← 只设置了这个
    // ← 缺少 allowlist 配置和 ask 配置！
  },
},
```

问题：
1. 设置了 `security: "allowlist"`（白名单模式）
2. 但**没有配置具体的白名单内容**（`safeBins`）
3. 也**没有配置 `ask: "on-miss"`**（未知命令询问用户）

导致：
- 默认白名单只有 Linux 命令：`jq`, `grep`, `cut`, `sort`, `uniq`, `head`, `tail`, `tr`, `wc`
- 这些命令在 Windows 上根本不存在
- 用户想执行任何命令都被直接拒绝，没有询问机会

**修复方案：**
修改 `src/gateway/setup-wizard.ts`：

```typescript
tools: {
  ...nextConfig.tools,
  exec: {
    ...nextConfig.tools?.exec,
    security: "allowlist",
    ask: "on-miss",          // ✅ 新增：未知命令询问用户
    askFallback: "allowlist",
    safeBins: [              // ✅ 新增：预置常用命令白名单
      // Windows 常用
      "notepad", "explorer", "calc", "mspaint", "code", "cmd", "powershell",
      "start", "where", "dir", "type", "echo", "set", "cd", "mkdir", "copy",
      // 开发工具
      "python", "python3", "node", "npm", "pnpm", "bun", "git", "curl", "wget",
      // Linux 基础
      "ls", "cat", "grep", "find", "head", "tail", "wc", "sort", "uniq", "jq",
      "cp", "mv", "mkdir", "touch", "chmod", "pwd", "which", "env",
      // 浏览器
      "chrome", "msedge", "firefox",
    ],
  },
},
```

**关键改动说明：**
| 配置项 | 作用 |
|-------|------|
| `ask: "on-miss"` | 未在白名单中的命令询问用户是否允许 |
| `askFallback: "allowlist"` | 用户不响应时使用白名单判断 |
| `safeBins: [...]` | 预置常用命令白名单 |

**临时解决方案（用户侧）：**
编辑 `~/.clawdbot/config.yaml`（或 `C:\Users\<用户名>\.clawdbot\config.yaml`）：

```yaml
tools:
  exec:
    security: allowlist
    ask: on-miss          # 添加这行
    safeBins:             # 添加白名单
      - notepad
      - explorer
      - cmd
      - powershell
      - python
      - node
      - npm
      - git
      - code
```

或者改为完全信任模式（临时）：
```yaml
tools:
  exec:
    security: full
    ask: off
```

**修复版本：** v2026.1.30（代码已修复，需重新打包）

**相关文件：**
- `src/gateway/setup-wizard.ts` - 第 773-793 行

---

---

### Bug #17: Pre-compaction Memory Flush 系统提示泄露

**问题描述：**
用户反馈在聊天界面看到系统内部提示：
```
Pre-compaction memory flush. Store durable memories now (use memory/YYYY-MM-DD.md; create memory/ if needed). If n store, reply with NO_REPLY.
```

**截图：** 见 `assets/c__Users_72793_AppData_Roaming_Cursor_User_workspaceStorage_6a18630411da556c78b2e79dcb23aa8d_images_81854ae9647ed322b5d093dbba686b8d-cd0935ae-a063-4b30-8bc4-65a52262b8cf.png`

**根本原因：**
当会话 token 数接近上下文窗口限制时，系统会触发 "memory flush" 功能，发送内部提示给 AI 模型让其保存记忆。这个提示本应该是静默的（AI 应回复 `NO_REPLY`），但出现以下情况时会泄露给用户：
1. AI 模型没有正确以 `NO_REPLY` 开头回复
2. Streaming 抑制失败 - 在检测到 `NO_REPLY` 之前，部分输出已通过流式传输泄露
3. 用户使用的版本没有包含 `2026.1.10` 的 streaming 抑制修复

**相关代码：**
- `src/auto-reply/reply/memory-flush.ts` - Memory flush 默认提示配置
- `src/auto-reply/tokens.ts` - `SILENT_REPLY_TOKEN = "NO_REPLY"`

**修复方案选项：**

| 方案 | 描述 | 适用场景 |
|-----|------|---------|
| 禁用 Memory Flush | 在配置中设置 `memoryFlush.enabled: false` | 不需要自动保存记忆功能 |
| 调整触发阈值 | 增大 `softThresholdTokens`（默认 4000） | 让 flush 更早触发，减少泄露风险 |
| 调整 Compaction | 增大 `reserveTokensFloor` | 让系统更早进行压缩 |
| 使用更大上下文模型 | 切换到 200K tokens 的模型 | 避免触发 compaction |
| 强化 NO_REPLY 检测 | 代码层面优化 streaming 抑制逻辑 | 彻底修复泄露问题 |

**配置示例（禁用 Memory Flush）：**
```yaml
agents:
  defaults:
    compaction:
      memoryFlush:
        enabled: false
```

**配置示例（调整阈值）：**
```yaml
agents:
  defaults:
    compaction:
      memoryFlush:
        softThresholdTokens: 8000  # 默认 4000，增大后更早触发
      reserveTokensFloor: 8000      # 增加保留空间
```

**状态：** 📋 TODO - 待优化

**优先级：** 🟡 P1 - 影响用户体验

**相关文档：**
- CHANGELOG.md - 搜索 "memory flush" 查看历史修复
- docs/concepts/memory.md - Memory flush 功能说明
- docs/reference/session-management-compaction.md - Compaction 机制详解

---

## 注意事项

1. **Windows 路径长度限制**：复制 extensions 时需要排除 node_modules 目录，否则会因路径过长失败
2. **插件加载顺序**：`CLAWDBOT_BUNDLED_PLUGINS_DIR` 环境变量优先级最高
3. **配置文件兼容性**：旧配置文件可能引用不存在的插件，需要容错处理
4. **小白用户体验**：需要提供更友好的错误提示和环境配置引导
5. **构建前置检查**：构建安装包前必须先运行 `pnpm install`，确保 `node_modules` 存在且完整
6. **安全模式配置**：设置 `allowlist` 模式时必须同时配置 `safeBins` 和 `ask`，否则会导致所有命令被拒绝
