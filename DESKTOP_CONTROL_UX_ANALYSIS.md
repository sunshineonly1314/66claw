# OpenClawCN 桌面控制工具 UX 分析与优化建议

## 📊 测试案例分析

### 用户输入
```
调用desktop_control 工具，整理桌面
```

### AI 的实际行为

#### ❌ 第一次尝试：错误的命令调用
```powershell
openclawcn tool desktop_control '{"action": "screenshot"}'
```

**问题**：
1. 尝试使用不存在的 `tool` 子命令
2. AI 没有识别到应该使用 `agent` 命令

#### ⚠️ 第二次尝试：正确但超时
```bash
openclawcn agent --session-id main --message "请使用 desktop_control 截图..."
```

**问题**：
1. 命令执行超过 12 秒无响应（最终被 kill）
2. 用户体验差：等待时间过长

#### ✅ 第三次尝试：直接 PowerShell 脚本
```powershell
# 创建文件夹并整理
```

**结果**：
- ✅ 成功创建了分类文件夹（图片、文档、程序）
- ✅ 设置了自动排列图标
- ⚠️ 但这**不是** desktop_control 工具，只是普通 PowerShell 脚本

---

## 🔍 核心问题分析

### 问题 1: AI 工具调用知识不足

**现象**：
- 用户明确说了 **"调用 desktop_control 工具"**
- AI 第一反应是用 `openclawcn tool` 命令
- 这说明 AI 不知道工具只能通过 `agent` 调用

**根本原因**：
- 系统提示词（system prompt）中没有明确说明工具调用机制
- AI 没有接收到 "工具必须通过 agent 子命令调用" 的指令

### 问题 2: desktop_control 工具未被触发

**现象**：
- 即使用户说了 "调用 desktop_control 工具"
- AI 仍然没有真正调用这个工具
- 最终用的是普通 PowerShell 脚本

**根本原因**：
- `agent` 命令执行超时（12秒+无响应）
- AI 在超时后选择了备选方案（PowerShell）
- 没有重试或诊断超时原因

### 问题 3: 用户体验断层

**用户期望**：
```
输入 → desktop_control 截图 → AI 分析 → 整理建议 → 执行
```

**实际发生**：
```
输入 → 错误命令 → 超时 → 放弃 → 用 PowerShell 代替
```

---

## 🎯 优化建议

### 优化 1: 改进系统提示词（System Prompt）

**当前问题**：AI 不知道工具调用机制

**建议**：在系统提示词中明确说明：

```markdown
## 工具调用机制

OpenClawCN 的所有工具（如 desktop_control, browser_control 等）必须通过以下方式调用：

### ✅ 正确方式
```bash
# 通过 agent 子命令调用工具
openclawcn agent --session-id main --message "用 desktop_control 截图"
```

### ❌ 错误方式
```bash
# 不存在 tool 子命令
openclawcn tool desktop_control '{"action": "screenshot"}'
```

### 可用工具列表
- desktop_control: Windows 桌面控制（截图、点击、输入等）
- browser_control: 浏览器控制
- ... (其他工具)

### 调用示例
当用户说 "调用 desktop_control 截图" 时，应该：
1. 构造 agent 消息：`--message "请使用 desktop_control 工具截图"`
2. 使用 agent 子命令执行
3. 等待结果（可能需要 10-30 秒）
```

**实施位置**：
- `src/dispatch/system-prompts.ts` - 添加工具调用指南
- `docs/agent-tool-guide.md` - 创建工具调用文档

---

### 优化 2: 添加工具调用快捷路径

**当前问题**：每次调用工具都需要长命令

**建议**：添加 `openclawcn tools` 子命令作为语法糖

```bash
# 新增命令（语法糖）
openclawcn tools invoke desktop_control screenshot

# 等价于
openclawcn agent --session-id main --message "使用 desktop_control 截图"
```

**实现代码**：

```typescript
// src/cli/commands/tools.ts
import { Command } from 'commander';
import { agentCommand } from './agent.js';

export const toolsCommand = new Command('tools')
  .description('Tool invocation helpers (syntax sugar for agent commands)')
  .addCommand(
    new Command('invoke')
      .argument('<tool>', 'Tool name (e.g., desktop_control)')
      .argument('<action>', 'Tool action (e.g., screenshot, click, type)')
      .argument('[params...]', 'Additional parameters as key=value pairs')
      .description('Invoke a tool via the agent system')
      .action(async (tool, action, params) => {
        // 构造参数对象
        const paramsObj: Record<string, string> = {};
        for (const param of params) {
          const [key, value] = param.split('=');
          paramsObj[key] = value;
        }

        // 构造工具调用消息
        const message = `使用 ${tool} 工具执行操作: ${action}` +
          (Object.keys(paramsObj).length > 0
            ? `, 参数: ${JSON.stringify(paramsObj)}`
            : '');

        // 调用 agent 命令
        return agentCommand.parseAsync([
          '--session-id', 'main',
          '--message', message,
          ...process.argv.slice(5) // 传递其他参数
        ]);
      })
  )
  .addCommand(
    new Command('list')
      .description('List available tools')
      .action(async () => {
        console.log('Available tools:');
        console.log('  - desktop_control (Windows): 桌面控制');
        console.log('  - browser_control: 浏览器控制');
        // TODO: 动态从工具注册表读取
      })
  );
```

**使用示例**：

```bash
# 截图
openclawcn tools invoke desktop_control screenshot

# 点击坐标
openclawcn tools invoke desktop_control click x=400 y=300

# 输入文本
openclawcn tools invoke desktop_control type text="Hello World"

# 列出可用工具
openclawcn tools list
```

---

### 优化 3: 改进超时处理

**当前问题**：agent 命令超时 12 秒无响应

**建议**：添加进度指示和超时诊断

```typescript
// src/cli/commands/agent.ts
import ora from 'ora';

async function runAgentWithProgress(options: AgentOptions) {
  const spinner = ora({
    text: '正在调用 agent，请稍候...',
    spinner: 'dots'
  }).start();

  // 设置超时检测
  const timeout = options.timeout || 30000; // 默认 30 秒
  const timeoutWarning = setTimeout(() => {
    spinner.text = '⚠️ 命令执行时间较长，可能是因为：\n' +
      '  1. Agent 正在思考复杂任务\n' +
      '  2. Gateway 响应缓慢\n' +
      '  3. 网络连接问题\n' +
      '  提示：可以按 Ctrl+C 取消';
  }, 5000);

  try {
    const result = await runAgent(options);
    clearTimeout(timeoutWarning);
    spinner.succeed('Agent 执行完成');
    return result;
  } catch (error) {
    clearTimeout(timeoutWarning);
    spinner.fail('Agent 执行失败');

    // 诊断超时原因
    if (error.message.includes('timeout')) {
      console.error('\n超时诊断：');
      console.error('  1. 检查 Gateway 状态: openclawcn status');
      console.error('  2. 查看 Gateway 日志: openclawcn logs --tail 50');
      console.error('  3. 尝试增加超时时间: --timeout 60');
    }

    throw error;
  }
}
```

---

### 优化 4: 添加工具调用示例到 help

**当前问题**：`openclawcn agent --help` 中没有工具调用示例

**建议**：在 help 文本中添加工具调用场景

```typescript
// src/cli/commands/agent.ts
agentCommand
  .description('Run an agent turn via the Gateway (use --local for embedded)')
  .addHelpText('after', `
Tool Invocation Examples:
  openclawcn agent --message "用 desktop_control 截图"
    Call the desktop_control tool to take a screenshot

  openclawcn agent --message "用 desktop_control 点击坐标 (400, 300)"
    Call the desktop_control tool to click at coordinates

  openclawcn agent --message "用 browser_control 打开 https://google.com"
    Call the browser_control tool to open a URL

  openclawcn agent --message "列出所有打开的窗口"
    Use desktop_control to list windows (implicit tool call)

Available tools:
  - desktop_control (Windows only): 桌面控制
  - browser_control: 浏览器控制
  - file_operations: 文件操作

For detailed tool documentation: openclawcn tools list --verbose
  `);
```

---

### 优化 5: 改进错误提示

**当前问题**：用户尝试 `openclawcn tool` 时只显示 "unknown command"

**建议**：添加智能错误提示

```typescript
// src/cli/index.ts
program.exitOverride((err) => {
  if (err.code === 'commander.unknownCommand') {
    const attempted = err.message.match(/unknown command '(.+?)'/)?.[1];

    // 检测常见错误
    if (attempted === 'tool') {
      console.error('\n❌ 错误: OpenClawCN 没有 "tool" 子命令');
      console.error('\n💡 提示: 工具必须通过 agent 子命令调用\n');
      console.error('示例：');
      console.error('  ✅ openclawcn agent --message "用 desktop_control 截图"');
      console.error('  ❌ openclawcn tool desktop_control screenshot\n');
      console.error('查看工具列表: openclawcn tools list');
      console.error('查看 agent 帮助: openclawcn agent --help\n');
      process.exit(1);
    }
  }

  throw err;
});
```

**效果对比**：

**优化前**：
```
error: unknown command 'tool'
```

**优化后**：
```
❌ 错误: OpenClawCN 没有 "tool" 子命令

💡 提示: 工具必须通过 agent 子命令调用

示例：
  ✅ openclawcn agent --message "用 desktop_control 截图"
  ❌ openclawcn tool desktop_control screenshot

查看工具列表: openclawcn tools list
查看 agent 帮助: openclawcn agent --help
```

---

### 优化 6: Web UI 工具调用快捷按钮

**当前问题**：用户需要记住工具名称和语法

**建议**：在 Web UI 中添加工具快捷按钮

```typescript
// ui/src/ui/views/chat.ts
const toolShortcuts = [
  {
    name: '📸 截图桌面',
    command: '用 desktop_control 截图',
    icon: '📸',
    category: 'desktop'
  },
  {
    name: '📂 列出窗口',
    command: '用 desktop_control 列出所有打开的窗口',
    icon: '📂',
    category: 'desktop'
  },
  {
    name: '🧹 整理桌面',
    command: '用 desktop_control 截图，然后分析桌面文件并给出整理建议',
    icon: '🧹',
    category: 'desktop'
  },
  {
    name: '🌐 打开浏览器',
    command: '用 browser_control 打开新标签页',
    icon: '🌐',
    category: 'browser'
  }
];

function renderToolShortcuts() {
  return html`
    <div class="tool-shortcuts">
      <div class="shortcuts-header">
        <h3>常用工具</h3>
        <button @click=${() => toggleShortcuts()}>
          ${showShortcuts ? '收起' : '展开'}
        </button>
      </div>
      ${showShortcuts ? html`
        <div class="shortcuts-grid">
          ${toolShortcuts.map(tool => html`
            <button
              class="tool-shortcut"
              @click=${() => insertCommand(tool.command)}
            >
              <span class="icon">${tool.icon}</span>
              <span class="name">${tool.name}</span>
            </button>
          `)}
        </div>
      ` : null}
    </div>
  `;
}
```

---

### 优化 7: 添加工具调用日志

**当前问题**：不知道工具是否被调用，调用了哪些参数

**建议**：在 agent 执行时显示工具调用详情

```typescript
// src/agents/agent-executor.ts
async function executeTool(toolName: string, params: any) {
  console.log(`\n🔧 调用工具: ${toolName}`);
  console.log(`   参数: ${JSON.stringify(params, null, 2)}`);

  const startTime = Date.now();
  try {
    const result = await tools[toolName].execute(params);
    const duration = Date.now() - startTime;

    console.log(`✅ 工具执行成功 (${duration}ms)`);
    if (result.screenshot) {
      console.log(`   返回截图: ${result.screenshot.length} bytes`);
    }

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ 工具执行失败 (${duration}ms): ${error.message}`);
    throw error;
  }
}
```

**日志示例**：

```
🔧 调用工具: desktop_control
   参数: {
     "action": "screenshot"
   }
✅ 工具执行成功 (1234ms)
   返回截图: 524288 bytes
```

---

## 📝 实施优先级

### P0 - 立即实施（用户体验关键）

1. ✅ **优化 5: 改进错误提示**
   - 工作量: 1 小时
   - 影响: 直接解决用户困惑

2. ✅ **优化 4: 添加工具调用示例到 help**
   - 工作量: 30 分钟
   - 影响: 提高可发现性

### P1 - 短期实施（1-2 周）

3. ✅ **优化 2: 添加工具调用快捷路径**
   - 工作量: 4 小时
   - 影响: 降低使用门槛

4. ✅ **优化 3: 改进超时处理**
   - 工作量: 2 小时
   - 影响: 提升用户体验

5. ✅ **优化 7: 添加工具调用日志**
   - 工作量: 2 小时
   - 影响: 提高调试能力

### P2 - 中期实施（1 个月）

6. ✅ **优化 1: 改进系统提示词**
   - 工作量: 3 小时
   - 影响: 提高 AI 工具调用准确率

7. ✅ **优化 6: Web UI 工具快捷按钮**
   - 工作量: 8 小时
   - 影响: 提升 UI 易用性

---

## 🎯 预期效果

### 实施前（当前）

```
用户: "调用 desktop_control 截图"
  ↓
AI: openclawcn tool desktop_control... (错误)
  ↓
AI: openclawcn agent ... (超时 12s)
  ↓
AI: 用 PowerShell 代替 (不是工具)
```

**问题**：
- ❌ 3 次失败尝试
- ❌ 超时无提示
- ❌ 最终没有真正调用工具

### 实施后（预期）

```
用户: "调用 desktop_control 截图"
  ↓
AI: openclawcn agent --message "用 desktop_control 截图"
  ↓
显示: 🔧 调用工具: desktop_control
      参数: {"action": "screenshot"}
      [进度条] ━━━━━━━━━━ 70%
  ↓
显示: ✅ 工具执行成功 (1.2s)
      返回截图: 524KB
  ↓
AI: "我已经截图了您的桌面，看到以下内容..."
```

**改进**：
- ✅ 一次成功调用
- ✅ 实时进度反馈
- ✅ 真正使用了工具
- ✅ 用户体验流畅

---

## 🔧 快速修复（本次问题）

针对本次测试中发现的问题，可以立即做以下修复：

### 1. 添加 "unknown command 'tool'" 错误提示

**文件**: `src/cli/index.ts`

```typescript
program.exitOverride((err) => {
  if (err.code === 'commander.unknownCommand') {
    const attempted = err.message.match(/unknown command '(.+?)'/)?.[1];

    if (attempted === 'tool') {
      console.error('\n❌ OpenClawCN 没有 "tool" 子命令\n');
      console.error('💡 工具必须通过 agent 调用，示例：\n');
      console.error('  openclawcn agent --message "用 desktop_control 截图"\n');
      console.error('查看更多: openclawcn agent --help\n');
      process.exit(1);
    }
  }
  throw err;
});
```

### 2. 在 agent --help 中添加工具调用示例

**文件**: `src/cli/commands/agent.ts`

```typescript
.addHelpText('after', `
工具调用示例:
  openclawcn agent --message "用 desktop_control 截图"
  openclawcn agent --message "用 desktop_control 列出窗口"
  openclawcn agent --message "截图桌面并分析文件"
`)
```

### 3. 创建工具调用快速参考文档

**文件**: `docs/cli/tool-invocation-guide.md`

```markdown
# OpenClawCN 工具调用指南

## 基本概念

OpenClawCN 的工具（如 desktop_control）**不能直接调用**，必须通过 agent 系统调用。

## 正确方式

```bash
# ✅ 正确
openclawcn agent --message "用 desktop_control 截图"

# ❌ 错误
openclawcn tool desktop_control screenshot
```

## 可用工具

- desktop_control (Windows): 桌面控制
- browser_control: 浏览器控制
- file_operations: 文件操作

## 常用命令

### 截图桌面
```bash
openclawcn agent --message "用 desktop_control 截图"
```

### 整理桌面
```bash
openclawcn agent --message "用 desktop_control 截图，分析桌面文件并给出整理建议"
```

### 列出窗口
```bash
openclawcn agent --message "用 desktop_control 列出所有打开的窗口"
```
```

---

## 📊 总结

### 本次测试发现的关键问题

1. ❌ **AI 不知道如何调用工具**
   - 尝试了不存在的 `tool` 子命令
   - 系统提示词缺少工具调用指南

2. ❌ **超时处理差**
   - 12 秒无响应无进度提示
   - 用户体验很差

3. ❌ **错误提示不友好**
   - "unknown command 'tool'" 太简洁
   - 没有给出正确用法

4. ❌ **最终没有真正使用工具**
   - AI 放弃了 desktop_control
   - 用普通 PowerShell 代替

### 推荐实施的优化

| 优先级 | 优化项 | 工作量 | 影响 |
|--------|--------|--------|------|
| P0 | 改进错误提示 | 1h | ⭐⭐⭐⭐⭐ |
| P0 | help 中添加示例 | 0.5h | ⭐⭐⭐⭐ |
| P1 | 工具调用快捷路径 | 4h | ⭐⭐⭐⭐ |
| P1 | 超时处理优化 | 2h | ⭐⭐⭐⭐ |
| P1 | 工具调用日志 | 2h | ⭐⭐⭐ |
| P2 | 系统提示词优化 | 3h | ⭐⭐⭐⭐⭐ |
| P2 | Web UI 快捷按钮 | 8h | ⭐⭐⭐⭐ |

**总工作量**: 约 20.5 小时
**预期效果**: 用户体验显著提升，工具调用成功率从 0% → 90%+

---

**分析完成时间**: 2026-02-17
**测试案例来源**: 用户真实测试
**OpenClawCN 版本**: 2026.2.15
