# TODO: Windows `open_app` 内置工具

## 问题背景

macOS 一行命令 `open -a "App Name"` 即可打开任意应用，但 Windows 没有等价命令。
当前方案是教 AI 模型写 PowerShell 搜索脚本，存在以下问题：

1. **模型写错 PowerShell 语法**（`-Filter` 不支持多值、`start ""` 别名冲突等）
2. **多步调用太慢**（注册表搜索 → 文件搜索 → 快捷方式搜索 → 启动，4 次 exec 调用）
3. **不同模型能力差异大**（qwen-plus 把 cmdlet 当工具名调用）
4. **用户体验差**（每步出错都要纠错重试，聊天看起来"断了"）

## 目标

创建一个 **`open_app`** 内置工具，AI 只需一次调用：

```
open_app({ name: "网易云音乐" })
```

工具内部用 Node.js 原生完成：查找 → 匹配 → 启动，不依赖模型写 PowerShell。

---

## 需求详细

### 1. 工具参数 Schema

```typescript
// 用 TypeBox 定义
const OpenAppSchema = Type.Object({
  name: Type.String({
    description: "应用名称关键词（支持中英文），如 'Chrome', '网易云音乐', 'WeChat'"
  }),
  action: Type.Optional(Type.Union([
    Type.Literal("launch"),  // 默认：找到后启动
    Type.Literal("find"),    // 只查找不启动，返回路径
  ], { description: "操作类型：launch（启动）或 find（仅查找）" })),
});
```

### 2. 搜索策略（按优先级）

工具内部按以下顺序搜索，找到即停：

#### 2.1 注册表搜索（最快最准）
- 查询路径：
  - `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\*`
  - `HKLM\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*`
  - `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\*`
- 匹配逻辑：`DisplayName` 包含关键词（大小写不敏感）
- 提取 exe 路径：
  - 优先用 `DisplayIcon` 字段（去掉 `,0` 等图标索引后缀）
  - 其次用 `InstallLocation` + 常见 exe 名
- **Node.js 实现**：用 `child_process.execSync` 调用 `reg query` 或用 PowerShell 的 `Get-ItemProperty`

#### 2.2 开始菜单快捷方式搜索
- 搜索路径：
  - `%APPDATA%\Microsoft\Windows\Start Menu\Programs\`
  - `%ProgramData%\Microsoft\Windows\Start Menu\Programs\`
- 匹配逻辑：`.lnk` 文件名包含关键词
- 解析 `.lnk`：
  - 推荐用 `windows-shortcuts` npm 包 或直接用 PowerShell COM 对象 `WScript.Shell.CreateShortcut()`
  - 提取 `TargetPath` 得到实际 exe 路径
- 备选：如果不想加依赖，可以用一次 PowerShell exec 调用解析

#### 2.3 文件系统搜索（兜底）
- 搜索路径：
  - `C:\Program Files\`
  - `C:\Program Files (x86)\`
  - `%LOCALAPPDATA%\`（很多现代应用装这里）
- 搜索深度：3 层
- 匹配逻辑：目录名或 exe 文件名包含关键词
- 注意：这步最慢，只在前两步都没找到时执行

#### 2.4 UWP/Store 应用
- 通过 `powershell -Command "Get-AppxPackage | Where-Object Name -like '*keyword*'"` 查询
- 如果匹配到，使用 `explorer.exe "shell:appsFolder\PackageFamilyName!App"` 启动

### 3. 启动逻辑

- 普通 exe：`child_process.spawn(exePath, [], { detached: true, stdio: 'ignore' })` + `unref()`
- UWP 应用：`child_process.spawn('explorer.exe', ['shell:appsFolder\\...!App'], ...)`
- 启动后不等待进程退出（detached + unref）

### 4. 返回值

```typescript
// 成功找到并启动
{
  content: [{ type: "text", text: "已启动: 网易云音乐\n路径: C:\\Program Files\\Netease\\CloudMusic\\cloudmusic.exe" }],
  details: {
    status: "launched",
    appName: "网易云音乐",
    exePath: "C:\\Program Files\\Netease\\CloudMusic\\cloudmusic.exe",
    source: "registry" | "shortcut" | "filesystem" | "uwp"
  }
}

// 成功找到但只查找（action=find）
{
  content: [{ type: "text", text: "找到应用: 网易云音乐\n路径: C:\\Program Files\\..." }],
  details: { status: "found", appName: "...", exePath: "...", source: "..." }
}

// 没找到
{
  content: [{ type: "text", text: "未找到匹配 '网易云音乐' 的应用。建议检查应用是否已安装。" }],
  details: { status: "not_found", keyword: "网易云音乐" }
}
```

### 5. 平台限制

- **仅 Windows**：`process.platform !== "win32"` 时工厂函数返回 `null`（不注册此工具）
- macOS/Linux 用户不会看到这个工具

---

## 代码位置

### 新建文件

| 文件 | 说明 |
|------|------|
| `src/agents/tools/open-app.ts` | 工具主体实现 |
| `src/agents/tools/open-app.test.ts` | 单元测试 |

### 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| **`src/agents/openclawcn-tools.ts`** | 在 `createOpenClawCNTools()` 函数的 tools 数组中添加 `createOpenAppTool()` 调用。参考现有工具（如 `createWebSearchTool`）的条件注册模式，Windows 时才注册 |
| **`ui/src/ui/tool-display.json`** | 在 `tools` 对象中添加 `open_app` 的 UI 显示配置 |
| **`src/agents/system-prompt.ts`** | 删除 `windowsShellSection` 中的 "Opening / Finding Applications" 整段（约 352-363 行），改为一句简短提示：`"To open desktop applications, use the open_app tool with the app name."` |

### tool-display.json 添加项

```json
"open_app": {
  "icon": "rocket",
  "title": "打开应用",
  "label": "打开应用",
  "detailKeys": ["name"]
}
```

---

## 实现模板

```typescript
// src/agents/tools/open-app.ts

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "./common";
import { readStringParam } from "./common";

const OpenAppSchema = Type.Object({
  name: Type.String({ description: "App name keyword (Chinese or English), e.g. 'Chrome', '网易云音乐'" }),
  action: Type.Optional(Type.Union([
    Type.Literal("launch"),
    Type.Literal("find"),
  ], { description: "launch (default) = find and open; find = find only, return path" })),
});

export function createOpenAppTool(): AnyAgentTool | null {
  // Windows only
  if (process.platform !== "win32") return null;

  return {
    name: "open_app",
    label: "Open App",
    description: [
      "Find and launch a desktop application on Windows by name.",
      "Searches registry, Start Menu shortcuts, and common install paths.",
      "Supports both Chinese and English app names.",
      "Examples: open_app({name:'Chrome'}), open_app({name:'网易云音乐'}), open_app({name:'WeChat',action:'find'})",
    ].join("\n"),
    parameters: OpenAppSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const name = readStringParam(params, "name", { required: true })!;
      const action = readStringParam(params, "action") ?? "launch";

      // TODO: 实现搜索逻辑
      // 1. searchRegistry(name)
      // 2. searchStartMenuShortcuts(name)
      // 3. searchFilesystem(name)
      // 4. searchUwpApps(name)

      // TODO: 实现启动逻辑
      // if (action === "launch") launchApp(exePath)

      // TODO: 返回结果
    },
  };
}
```

---

## openclawcn-tools.ts 注册位置

在 `createOpenClawCNTools()` 中，参照现有工具的模式添加：

```typescript
// 在 createOpenClawCNTools() 函数体内，tools 数组附近
import { createOpenAppTool } from "./tools/open-app.js";

// ... 在 tools 数组中
const openAppTool = createOpenAppTool();  // Windows 以外返回 null

const tools: AnyAgentTool[] = [
  createBrowserTool({...}),
  // ... 其他现有工具
  ...(openAppTool ? [openAppTool] : []),
];
```

---

## 注意事项

1. **编码问题**：注册表查询结果在中文 Windows 可能是 GBK 编码。用 PowerShell 查询时确保 `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`（shell-utils.ts 已有此设置）
2. **权限**：不需要管理员权限，所有搜索路径都是用户可读的
3. **性能**：注册表查询 < 100ms，快捷方式搜索 < 500ms，文件系统扫描可能 1-3s。按优先级短路，找到即停
4. **缓存**（可选优化）：首次搜索后可缓存结果到内存 Map，后续调用直接匹配。缓存 TTL 建议 10 分钟
5. **模糊匹配**：关键词分词后做 AND 匹配。如 "网易云音乐" → ["网易", "云", "音乐"]，目标包含所有词才算匹配。或直接用 `.includes()` 做子串匹配（更简单可靠）
6. **不要引入重型依赖**：尽量用 Node.js 内置模块 + PowerShell 子进程。避免引入需要 native addon 的 npm 包

---

## 预期效果

修改前（当前）：
```
用户: 帮我打开网易云音乐
AI: 让我搜索...（调用 exec → PowerShell 语法错误 → 纠错 → 再调 exec → 搜到了 → 再调 exec 启动 → 可能还出错）
// 3-5 次 API 调用，30-60 秒，经常失败
```

修改后：
```
用户: 帮我打开网易云音乐
AI: 好的（调用 open_app({name:"网易云音乐"})）
工具: 已启动: 网易云音乐 (C:\Program Files\Netease\CloudMusic\cloudmusic.exe)
// 1 次 API 调用，2-3 秒，稳定可靠
```
