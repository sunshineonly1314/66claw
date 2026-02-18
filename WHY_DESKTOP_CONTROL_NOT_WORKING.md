# 为什么桌面控制工具没有被调用？完整诊断

## 🔍 问题现象

用户在聊天界面输入 "清理桌面"，但 AI 没有调用 `desktop_control` 工具。

---

## ✅ 排查结果

### 1. 工具是否存在？ ✅

```bash
# 文件位置
src/agents/tools/desktop-control.ts  ✅ 存在

# 工具注册
src/agents/clawdbot-tools.ts:23
import { createDesktopControlTool } from "./tools/desktop-control.js";  ✅ 已导入

src/agents/clawdbot-tools.ts:158
...(desktopControlTool ? [desktopControlTool] : []),  ✅ 已注册
```

### 2. 平台限制？ ✅

```typescript
// src/agents/tools/desktop-control.ts:853
export function createDesktopControlTool(): AnyAgentTool | null {
  if (process.platform !== "win32") return null;  // Windows only
  return {
    name: "desktop_control",
    ...
  };
}
```

**结论**: 只在 Windows 上可用，你的系统是 Windows ✅

### 3. 技能是否安装？ ⚠️

```bash
# 检查技能目录
skills/desktop-control/
└── SKILL.md  ✅ 存在

# 但是...
skills/desktop-control/clawdbot.plugin.json  ❌ 不存在！
```

**问题**: 技能文档存在，但**没有插件配置文件**！

---

## 🚨 根本原因

### 原因分析

OpenClawCN 有两种工具机制：

#### 1. **内置工具** (Built-in Tools)
- 位置: `src/agents/tools/*.ts`
- 注册: `src/agents/clawdbot-tools.ts`
- 特点: **直接编译到代码中**，无需配置
- 示例: `desktop_control`, `browser`, `canvas`

#### 2. **技能工具** (Skill Tools)
- 位置: `skills/*/`
- 配置: `skills/*/clawdbot.plugin.json` + `SKILL.md`
- 特点: 通过 MCP 或插件系统加载
- 示例: 插件提供的自定义工具

### `desktop_control` 的现状

```
desktop_control 是内置工具 ✅
  ↓
已注册到 tools 数组 ✅
  ↓
技能文档仅用于 AI 阅读 ✅
  ↓
AI 应该能看到并调用 ✅
```

---

## 🔍 为什么 AI 没调用？

### 可能原因 1: 技能文档未加载 ⚠️

让我检查技能加载机制：

```typescript
// skills/desktop-control/SKILL.md 的作用
// - 提供工具使用说明给 AI
// - 包含在 Agent 系统提示词中
// - 让 AI 知道如何调用工具
```

**问题**: 如果技能文档没有正确加载到 Agent 的上下文中，AI 就不知道要用这个工具。

### 可能原因 2: 意图识别失败

AI 可能：
- ❌ 没有理解 "清理桌面" 需要用 `desktop_control`
- ❌ 认为这是一个建议性问题，而不是执行命令
- ❌ 不确定需要先截图查看桌面

### 可能原因 3: Gateway 配置问题

```bash
# 检查 Gateway 是否正常运行
netstat -an | findstr ":18789"
# 结果: ✅ LISTENING

# 检查工具是否被禁用
config/.../agent.tools.allowlist = ?
```

---

## 🛠️ 解决方案

### 方案 1: 明确告诉 AI 使用工具 🌟

**问题**: AI 需要更明确的指令

**解决**:
```
❌ 错误: "清理桌面"
✅ 正确: "用 desktop_control 截图，然后帮我整理桌面文件"
✅ 正确: "先截图看看桌面，再帮我清理"
✅ 正确: "用桌面控制工具整理桌面"
```

---

### 方案 2: 检查技能是否正确加载

```bash
cd d:\codeknowledge\clawdbot-main\clawdbot-main

# 1. 检查技能列表
node openclawcn.mjs skills list | grep desktop

# 2. 检查 Agent 工具列表
# (需要在 Agent 对话中询问)
# "你有哪些可用的工具？列出所有工具名称"

# 3. 检查技能目录结构
ls -la skills/desktop-control/
# 应该看到: SKILL.md
```

---

### 方案 3: 验证工具实际可用

**测试代码** (TypeScript):
```typescript
import { createDesktopControlTool } from "./src/agents/tools/desktop-control.js";

const tool = createDesktopControlTool();

if (!tool) {
  console.error("❌ 工具未创建 (可能不是 Windows)");
} else {
  console.log("✅ 工具已创建");
  console.log("工具名称:", tool.name);
  console.log("工具描述:", tool.description);
}
```

**运行**:
```bash
cd d:\codeknowledge\clawdbot-main\clawdbot-main
node --import tsx -e "
import { createDesktopControlTool } from './src/agents/tools/desktop-control.js';
const tool = createDesktopControlTool();
console.log('工具:', tool ? tool.name : 'null');
"
```

---

### 方案 4: 通过 Web UI 测试

```bash
# 1. 打开控制面板
cd d:\codeknowledge\clawdbot-main\clawdbot-main
node openclawcn.mjs dashboard

# 2. 在聊天界面输入 (更明确的指令)
用 desktop_control 工具截图，描述桌面内容

# 3. 如果 AI 回复 "我看不到 desktop_control 工具"
# 说明工具确实没有加载

# 4. 如果 AI 成功调用
# 说明工具可用，只是之前的指令不够明确
```

---

### 方案 5: 检查技能文档格式

```bash
# 查看技能文档是否符合格式
cat skills/desktop-control/SKILL.md | head -50
```

**标准格式**:
```markdown
---
name: desktop-control
description: "..."
nameZh: "桌面控制"
descriptionZh: "..."
metadata: {"openclawcn":{"emoji":"🖥️","os":["win32"],"always":true}}
---

# Desktop Control Skill (Windows)

Use the built-in `desktop_control` tool to...
```

**关键检查**:
- ✅ YAML front matter 是否完整
- ✅ `metadata.openclawcn.always: true` (始终加载)
- ✅ `metadata.openclawcn.os: ["win32"]` (Windows only)

---

## 📊 诊断清单

请按顺序检查：

- [ ] **1. 确认平台**: `echo $env:OS` → Windows_NT ✅
- [ ] **2. 确认工具文件**: `ls src/agents/tools/desktop-control.ts` ✅
- [ ] **3. 确认工具注册**: `grep desktop-control src/agents/clawdbot-tools.ts` ✅
- [ ] **4. 确认 Gateway 运行**: `netstat -an | findstr ":18789"` ✅
- [ ] **5. 确认技能文档**: `cat skills/desktop-control/SKILL.md`
- [ ] **6. 测试明确指令**: "用 desktop_control 截图"
- [ ] **7. 询问 AI**: "你有 desktop_control 工具吗？"
- [ ] **8. 检查工具列表**: Agent 对话中询问可用工具

---

## 🧪 快速测试脚本

### PowerShell 版本

```powershell
# 保存为: test-desktop-control.ps1

Write-Host "=== 桌面控制工具诊断 ===" -ForegroundColor Cyan

# 1. 检查平台
Write-Host "`n[1/6] 检查平台..." -ForegroundColor Yellow
if ($env:OS -match "Windows") {
    Write-Host "  ✅ Windows 平台" -ForegroundColor Green
} else {
    Write-Host "  ❌ 非 Windows 平台" -ForegroundColor Red
}

# 2. 检查工具文件
Write-Host "`n[2/6] 检查工具文件..." -ForegroundColor Yellow
$toolFile = "d:\codeknowledge\clawdbot-main\clawdbot-main\src\agents\tools\desktop-control.ts"
if (Test-Path $toolFile) {
    Write-Host "  ✅ 工具文件存在: $toolFile" -ForegroundColor Green
} else {
    Write-Host "  ❌ 工具文件缺失" -ForegroundColor Red
}

# 3. 检查技能文档
Write-Host "`n[3/6] 检查技能文档..." -ForegroundColor Yellow
$skillFile = "d:\codeknowledge\clawdbot-main\clawdbot-main\skills\desktop-control\SKILL.md"
if (Test-Path $skillFile) {
    Write-Host "  ✅ 技能文档存在: $skillFile" -ForegroundColor Green

    # 检查 metadata
    $content = Get-Content $skillFile -Raw
    if ($content -match 'metadata:.*"always":\s*true') {
        Write-Host "  ✅ always: true 配置正确" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  always: true 可能缺失" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ 技能文档缺失" -ForegroundColor Red
}

# 4. 检查 Gateway 端口
Write-Host "`n[4/6] 检查 Gateway..." -ForegroundColor Yellow
$port = netstat -an | Select-String ":18789.*LISTENING"
if ($port) {
    Write-Host "  ✅ Gateway 正在监听端口 18789" -ForegroundColor Green
} else {
    Write-Host "  ❌ Gateway 未运行" -ForegroundColor Red
}

# 5. 检查工具注册
Write-Host "`n[5/6] 检查工具注册..." -ForegroundColor Yellow
$toolsFile = "d:\codeknowledge\clawdbot-main\clawdbot-main\src\agents\clawdbot-tools.ts"
$registered = Select-String -Path $toolsFile -Pattern "createDesktopControlTool"
if ($registered) {
    Write-Host "  ✅ 工具已注册" -ForegroundColor Green
} else {
    Write-Host "  ❌ 工具未注册" -ForegroundColor Red
}

# 6. 测试建议
Write-Host "`n[6/6] 测试建议:" -ForegroundColor Yellow
Write-Host "  1. 打开控制面板: node openclawcn.mjs dashboard" -ForegroundColor Cyan
Write-Host "  2. 输入明确指令: '用 desktop_control 截图'" -ForegroundColor Cyan
Write-Host "  3. 询问 AI: '你有哪些工具可以控制桌面？'" -ForegroundColor Cyan

Write-Host "`n=== 诊断完成 ===" -ForegroundColor Cyan
```

**运行**:
```powershell
powershell -ExecutionPolicy Bypass -File test-desktop-control.ps1
```

---

## 💡 最可能的原因

根据我的分析，**最可能的原因**是：

### ⭐ AI 的指令理解问题

**用户输入**: "清理桌面"

**AI 可能的理解**:
1. ❌ "这是一个咨询问题，用户想知道如何清理"
2. ❌ "这需要建议，不需要执行"
3. ❌ "我不确定用户的桌面有什么，不应该擅自操作"

**正确的触发词**:
```
✅ "截图查看桌面"
✅ "用 desktop_control 工具..."
✅ "先看看桌面有什么文件"
✅ "自动整理桌面文件"
✅ "帮我点击桌面上的..."
```

---

## 🎯 立即测试

### 测试 1: 最明确的指令

```
输入: 用 desktop_control 工具截图，描述你看到的内容
预期: AI 应该调用 desktop_control({action: "screenshot"})
```

### 测试 2: 间接但明确

```
输入: 先截图看看我的桌面，然后帮我整理
预期: AI 应该先截图，然后分析
```

### 测试 3: 询问工具

```
输入: 你有桌面控制相关的工具吗？列出来
预期: AI 应该提到 desktop_control
```

---

## 📝 结论

**工具本身**: ✅ 正常，已注册，已编译

**问题所在**: ⚠️ 可能是以下之一:
1. AI 没有理解需要调用工具 (最可能)
2. 技能文档未正确加载到上下文
3. Agent 配置禁用了该工具

**解决方法**:
1. 使用更明确的指令 (推荐)
2. 运行诊断脚本验证
3. 如果确实不可用,使用 PowerShell 脚本直接清理

---

**创建时间**: 2026-02-17
**诊断工具**: [test-desktop-control.ps1](#快速测试脚本)
**清理脚本**: [d:\clean-desktop.ps1](d:\clean-desktop.ps1)
