# 桌面清理功能失败诊断报告

## 🐛 问题描述

用户尝试使用 OpenClawCN 清理桌面时失败。

## 🔍 诊断结果

### 1. Gateway 状态 ✅
```bash
端口 18789: LISTENING
状态: 正常运行
```

### 2. CLI 可用性 ⚠️
```bash
问题: `openclawcn` 命令不在 PATH 中
位置: d:\codeknowledge\clawdbot-main\clawdbot-main\openclawcn.mjs
版本: 2026.2.15
```

### 3. 桌面控制技能 ✅
```
✓ desktop-control 已安装
✓ 状态: ready
✓ 平台: Windows
```

---

## 🚨 根本原因

### 原因 1: 工具调用方式错误

❌ **错误方式**:
```bash
openclawcn tool desktop_control '{"action": "screenshot"}'
```

**错误信息**:
```
error: unknown command 'tool'
```

**原因**: OpenClawCN CLI 没有 `tool` 子命令，工具必须通过 Agent 调用。

---

### 原因 2: 需要通过 Agent 系统

✅ **正确方式**:
```bash
# 方式 1: 通过 Gateway (推荐)
node openclawcn.mjs agent --message "帮我清理桌面" --to +1234567890

# 方式 2: 本地模式 (需要 API keys)
node openclawcn.mjs agent --message "帮我清理桌面" --local

# 方式 3: 通过 Web UI
# 打开控制面板,在聊天界面输入: "帮我清理桌面"
```

---

## ✅ 解决方案

### 方案 1: 使用 Web UI (最简单) 🌟

1. **打开控制面板**:
   ```bash
   cd d:\codeknowledge\clawdbot-main\clawdbot-main
   node openclawcn.mjs dashboard
   ```

2. **在聊天界面输入**:
   ```
   帮我清理桌面
   ```

3. **Agent 会自动**:
   - 调用 `desktop_control` 工具截图
   - 分析桌面内容
   - 询问你要如何整理
   - 执行清理操作

---

### 方案 2: 使用 CLI Agent 命令

**前提条件**:
- 配置了 API keys (Anthropic/OpenAI)
- 或者 Gateway 正在运行

**步骤**:

```bash
# 1. 进入项目目录
cd d:\codeknowledge\clawdbot-main\clawdbot-main

# 2. 使用 Gateway 模式 (推荐)
node openclawcn.mjs agent \
  --to +8613800000000 \
  --message "请帮我清理桌面：1. 截图查看当前桌面；2. 分析哪些文件可以整理；3. 给出整理建议"

# 3. 或使用本地模式 (需要 API key)
export ANTHROPIC_API_KEY=your_key_here
node openclawcn.mjs agent \
  --local \
  --message "帮我清理桌面"
```

---

### 方案 3: PowerShell 脚本 (直接清理)

如果只是想快速清理,可以用这个脚本:

```powershell
# 桌面自动整理脚本
$desktop = [Environment]::GetFolderPath("Desktop")

# 创建分类文件夹
$folders = @(
    "文档",
    "图片",
    "压缩包",
    "程序",
    "其他"
)

foreach ($folder in $folders) {
    $path = Join-Path $desktop $folder
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Path $path | Out-Null
    }
}

# 分类规则
$rules = @{
    "文档" = @("*.doc", "*.docx", "*.pdf", "*.txt", "*.xlsx", "*.pptx")
    "图片" = @("*.png", "*.jpg", "*.jpeg", "*.gif", "*.bmp", "*.svg")
    "压缩包" = @("*.zip", "*.rar", "*.7z", "*.tar", "*.gz")
    "程序" = @("*.exe", "*.msi", "*.bat", "*.cmd")
}

# 移动文件
foreach ($category in $rules.Keys) {
    $targetFolder = Join-Path $desktop $category
    foreach ($pattern in $rules[$category]) {
        Get-ChildItem -Path $desktop -Filter $pattern -File | ForEach-Object {
            Move-Item -Path $_.FullName -Destination $targetFolder -Force
            Write-Host "移动: $($_.Name) -> $category" -ForegroundColor Green
        }
    }
}

Write-Host "`n✅ 桌面清理完成！" -ForegroundColor Cyan
```

**保存为**: `d:\clean-desktop.ps1`

**运行**:
```powershell
powershell -ExecutionPolicy Bypass -File d:\clean-desktop.ps1
```

---

## 🔧 配置 PATH (可选)

如果想直接使用 `openclawcn` 命令:

### Windows (PowerShell)

```powershell
# 1. 添加到用户 PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$newPath = "d:\codeknowledge\clawdbot-main\clawdbot-main"
if ($currentPath -notlike "*$newPath*") {
    [Environment]::SetEnvironmentVariable(
        "Path",
        "$currentPath;$newPath",
        "User"
    )
    Write-Host "✅ 已添加到 PATH,重启终端生效" -ForegroundColor Green
}

# 2. 当前会话立即生效
$env:Path += ";d:\codeknowledge\clawdbot-main\clawdbot-main"

# 3. 创建别名 (临时)
Set-Alias openclawcn "node d:\codeknowledge\clawdbot-main\clawdbot-main\openclawcn.mjs"

# 4. 永久别名 (添加到 $PROFILE)
echo 'Set-Alias openclawcn "node d:\codeknowledge\clawdbot-main\clawdbot-main\openclawcn.mjs"' >> $PROFILE
```

### Bash (Git Bash / WSL)

```bash
# 1. 添加到 ~/.bashrc
echo 'alias openclawcn="node /d/codeknowledge/clawdbot-main/clawdbot-main/openclawcn.mjs"' >> ~/.bashrc

# 2. 立即生效
source ~/.bashrc

# 3. 测试
openclawcn --version
```

---

## 📊 桌面控制工具说明

### 可用操作

```javascript
// 1. 截图
desktop_control({action: "screenshot"})

// 2. 点击
desktop_control({action: "click", x: 400, y: 300})

// 3. 输入文本
desktop_control({action: "type", text: "Hello 你好"})

// 4. 键盘快捷键
desktop_control({action: "key", keys: "ctrl+a"})
desktop_control({action: "key", keys: "delete"})

// 5. 列出窗口
desktop_control({action: "list_windows"})

// 6. 聚焦窗口
desktop_control({action: "focus", window: "资源管理器"})

// 7. 滚动
desktop_control({action: "scroll", x: 500, y: 500, amount: -3})
```

### 桌面清理典型流程

```javascript
// 1. 截图查看桌面
desktop_control({action: "screenshot"})

// 2. AI 分析桌面内容
// (Agent 自动完成)

// 3. 打开文件资源管理器
desktop_control({action: "key", keys: "win+e"})

// 4. 在桌面创建文件夹
desktop_control({action: "focus", window: "资源管理器"})
desktop_control({action: "type", text: "Desktop"})
desktop_control({action: "key", keys: "enter"})

// 5. 创建分类文件夹
desktop_control({action: "key", keys: "ctrl+shift+n"})
desktop_control({action: "type", text: "文档"})
desktop_control({action: "key", keys: "enter"})

// 6. 选择文件并移动
// ... (通过坐标点击拖拽)
```

---

## 🎯 快速测试

### 测试 1: 截图功能

```bash
cd d:\codeknowledge\clawdbot-main\clawdbot-main
node openclawcn.mjs agent \
  --local \
  --message "请用 desktop_control 截图,然后描述你看到了什么"
```

**预期结果**: Agent 返回桌面截图并描述内容

---

### 测试 2: 列出窗口

```bash
node openclawcn.mjs agent \
  --local \
  --message "使用 desktop_control 列出当前所有打开的窗口"
```

**预期结果**: 返回窗口列表 (如: Chrome, VSCode, 资源管理器等)

---

### 测试 3: 完整清理流程

```bash
node openclawcn.mjs agent \
  --local \
  --message "帮我清理桌面:
1. 先截图查看当前桌面
2. 分析有哪些文件/文件夹
3. 给出整理建议
4. 如果我同意,执行整理操作"
```

---

## 🐛 常见错误

### 错误 1: `openclawcn: command not found`

**原因**: CLI 不在 PATH
**解决**: 使用完整路径或配置 PATH (见上文)

---

### 错误 2: `error: unknown command 'tool'`

**原因**: 尝试直接调用工具
**解决**: 通过 `agent` 命令调用

---

### 错误 3: `No API keys configured`

**原因**: 本地模式需要 API key
**解决**:
```bash
# 方式 1: 设置环境变量
export ANTHROPIC_API_KEY=sk-...

# 方式 2: 使用 Gateway 模式 (不需要 API key)
node openclawcn.mjs agent --message "..." --to +123456
```

---

### 错误 4: `Can't reach the OpenClawCN browser control service`

**原因**: 浏览器控制服务未启动
**解决**: 桌面控制不需要浏览器服务,忽略此错误

---

## 📝 总结

### ✅ 问题解决

| 问题 | 状态 | 解决方案 |
|------|------|----------|
| 工具调用方式错误 | ✅ | 使用 `agent` 命令 |
| CLI 不在 PATH | ⚠️ | 使用完整路径或配置 PATH |
| 桌面控制功能 | ✅ | 技能已安装,可正常使用 |

### 🎯 推荐方案

1. **最简单**: 使用 Web UI (`openclawcn dashboard`)
2. **最灵活**: 使用 CLI Agent 命令
3. **最直接**: PowerShell 脚本直接整理

---

## 📚 相关文档

- [Agent 命令文档](https://docs.openclawcn.ai/cli/agent)
- [桌面控制技能](d:\codeknowledge\clawdbot-main\clawdbot-main\skills\desktop-control\skill.md)
- [Gateway 配置](d:\codeknowledge\clawdbot-main\clawdbot-main\docs\config-defaults-guide.md)

---

**诊断时间**: 2026-02-17
**OpenClawCN 版本**: 2026.2.15
**平台**: Windows 11
