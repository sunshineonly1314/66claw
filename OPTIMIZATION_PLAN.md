# Clawdbot 项目优化方案
**Detailed Optimization Plan with Implementation Guide**

---

## 📋 目录

1. [P0 - 紧急优化](#p0---紧急优化)
   - [1.1 eval安全风险修复](#11-eval安全风险修复)
   - [1.2 超大文件重构](#12-超大文件重构)
2. [P1 - 重要优化](#p1---重要优化)
   - [2.1 提升测试覆盖率](#21-提升测试覆盖率)
   - [2.2 技术债务清理](#22-技术债务清理)
   - [2.3 大文件拆分](#23-大文件拆分)
3. [P2 - 性能优化](#p2---性能优化)
4. [P3 - 代码质量提升](#p3---代码质量提升)

---

## P0 - 紧急优化

### 1.1 eval安全风险修复

**问题**: `src/browser/pw-tools-core.interactions.ts` 中使用eval执行动态代码

#### 当前代码
```typescript
// src/browser/pw-tools-core.interactions.ts
var candidate = eval("(" + fnBody + ")");
```

#### 解决方案

**方案A: 使用 isolated-vm (推荐 - 生产级)**

```typescript
// src/browser/safe-code-executor.ts
import ivm from 'isolated-vm';

export class SafeCodeExecutor {
  private isolate: ivm.Isolate;
  private context: ivm.Context;

  constructor(options: {
    memoryLimit?: number;
    timeout?: number;
  } = {}) {
    this.isolate = new ivm.Isolate({
      memoryLimit: options.memoryLimit ?? 128 // MB
    });
    this.context = this.isolate.createContextSync();

    // 设置安全的全局对象
    const jail = this.context.global;
    jail.setSync('global', jail.derefInto());
  }

  /**
   * 安全执行函数体
   */
  async executeFunction(
    fnBody: string,
    timeout: number = 1000
  ): Promise<unknown> {
    // 1. 输入验证
    this.validateInput(fnBody);

    // 2. 编译脚本
    const script = await this.isolate.compileScript(
      `(${fnBody})`
    );

    // 3. 在隔离环境中执行
    const result = await script.run(this.context, {
      timeout,
      release: true
    });

    return result;
  }

  /**
   * 同步版本（性能更好，但阻塞主线程）
   */
  executeFunctionSync(
    fnBody: string,
    timeout: number = 1000
  ): unknown {
    this.validateInput(fnBody);

    const script = this.isolate.compileScriptSync(
      `(${fnBody})`
    );

    return script.runSync(this.context, {
      timeout,
      release: true
    });
  }

  /**
   * 验证输入，防止明显的恶意代码
   */
  private validateInput(fnBody: string): void {
    if (!fnBody || typeof fnBody !== 'string') {
      throw new Error('Invalid function body');
    }

    // 黑名单检查（基础防护）
    const blacklist = [
      /require\s*\(/,
      /import\s+/,
      /process\./,
      /__dirname/,
      /__filename/,
      /eval\s*\(/,
      /Function\s*\(/,
    ];

    for (const pattern of blacklist) {
      if (pattern.test(fnBody)) {
        throw new Error(`Forbidden pattern detected: ${pattern}`);
      }
    }

    // 长度限制
    if (fnBody.length > 10000) {
      throw new Error('Function body too large');
    }
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.context.release();
    this.isolate.dispose();
  }
}

// 使用示例
export function createSafeExecutor() {
  return new SafeCodeExecutor({
    memoryLimit: 128,
    timeout: 1000,
  });
}
```

**方案B: 使用 VM2 (备用方案)**

```typescript
// src/browser/vm2-executor.ts
import { VM } from 'vm2';

export class VM2CodeExecutor {
  private vm: VM;

  constructor(options: {
    timeout?: number;
    sandbox?: Record<string, unknown>;
  } = {}) {
    this.vm = new VM({
      timeout: options.timeout ?? 1000,
      sandbox: options.sandbox ?? {},
      eval: false,
      wasm: false,
    });
  }

  executeFunction(fnBody: string): unknown {
    // 验证输入
    this.validateInput(fnBody);

    // 执行
    try {
      return this.vm.run(`(${fnBody})`);
    } catch (error) {
      throw new Error(
        `VM2 execution failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private validateInput(fnBody: string): void {
    if (!fnBody || typeof fnBody !== 'string') {
      throw new Error('Invalid function body');
    }

    if (fnBody.length > 10000) {
      throw new Error('Function body too large');
    }
  }
}
```

**方案C: AST解析器 (最安全，但限制多)**

```typescript
// src/browser/ast-executor.ts
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export class ASTCodeExecutor {
  /**
   * 解析并验证函数体
   */
  parseAndValidate(fnBody: string): acorn.Node {
    let ast: acorn.Node;

    try {
      ast = acorn.parse(`(${fnBody})`, {
        ecmaVersion: 2020,
        sourceType: 'script',
      });
    } catch (error) {
      throw new Error(
        `Invalid JavaScript: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 白名单验证：只允许安全的语法
    this.validateAST(ast);

    return ast;
  }

  /**
   * 验证AST，只允许安全的节点类型
   */
  private validateAST(ast: acorn.Node): void {
    const allowedNodeTypes = new Set([
      'Program',
      'ExpressionStatement',
      'ArrowFunctionExpression',
      'FunctionExpression',
      'BlockStatement',
      'ReturnStatement',
      'BinaryExpression',
      'UnaryExpression',
      'Literal',
      'Identifier',
      'CallExpression',
      'MemberExpression',
      'ObjectExpression',
      'Property',
      'ArrayExpression',
    ]);

    walk.simple(ast, {
      // 遍历所有节点
      // @ts-ignore
      '*'(node: acorn.Node) {
        if (!allowedNodeTypes.has(node.type)) {
          throw new Error(
            `Forbidden AST node type: ${node.type}`
          );
        }
      },
    });
  }

  /**
   * 安全执行（结合Function构造函数）
   */
  executeSafe(fnBody: string, context: Record<string, unknown> = {}): unknown {
    // 1. 验证AST
    this.parseAndValidate(fnBody);

    // 2. 使用Function构造函数（比eval稍安全）
    const fn = new Function(...Object.keys(context), `return (${fnBody})`);

    // 3. 执行
    return fn(...Object.values(context));
  }
}
```

#### 修改 pw-tools-core.interactions.ts

```typescript
// src/browser/pw-tools-core.interactions.ts
import { createSafeExecutor } from './safe-code-executor.js';

// 全局单例
let executorInstance: ReturnType<typeof createSafeExecutor> | null = null;

function getExecutor() {
  if (!executorInstance) {
    executorInstance = createSafeExecutor();
  }
  return executorInstance;
}

// 替换原来的eval调用
export function executeDynamicFunction(fnBody: string): unknown {
  const executor = getExecutor();

  try {
    // ❌ 旧代码: var candidate = eval("(" + fnBody + ")");
    // ✅ 新代码:
    const candidate = executor.executeFunctionSync(fnBody, 5000);
    return candidate;
  } catch (error) {
    throw new Error(
      `Failed to execute dynamic function: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// 清理资源
process.on('exit', () => {
  executorInstance?.dispose();
});
```

#### 测试用例

```typescript
// src/browser/safe-code-executor.test.ts
import { describe, it, expect } from 'vitest';
import { SafeCodeExecutor } from './safe-code-executor.js';

describe('SafeCodeExecutor', () => {
  it('should execute safe function', () => {
    const executor = new SafeCodeExecutor();
    const result = executor.executeFunctionSync('() => 1 + 1');
    expect(result).toBe(2);
  });

  it('should block require()', () => {
    const executor = new SafeCodeExecutor();
    expect(() => {
      executor.executeFunctionSync('() => require("fs")');
    }).toThrow(/Forbidden pattern/);
  });

  it('should block eval()', () => {
    const executor = new SafeCodeExecutor();
    expect(() => {
      executor.executeFunctionSync('() => eval("1+1")');
    }).toThrow(/Forbidden pattern/);
  });

  it('should timeout long-running code', async () => {
    const executor = new SafeCodeExecutor();
    await expect(
      executor.executeFunction('() => { while(true) {} }', 100)
    ).rejects.toThrow();
  });

  it('should limit memory usage', () => {
    const executor = new SafeCodeExecutor({ memoryLimit: 8 });
    expect(() => {
      executor.executeFunctionSync(
        '() => { const arr = []; while(true) arr.push(new Array(1000000)); }'
      );
    }).toThrow();
  });
});
```

#### 实施步骤

1. **安装依赖**
```bash
pnpm add isolated-vm
pnpm add -D @types/isolated-vm
```

2. **创建新文件**
```bash
# 创建安全执行器
touch src/browser/safe-code-executor.ts
touch src/browser/safe-code-executor.test.ts
```

3. **修改现有代码**
- 在 `pw-tools-core.interactions.ts` 中替换eval调用
- 运行测试确保功能正常

4. **部署前验证**
```bash
# 运行所有测试
pnpm test

# 运行安全测试
pnpm test safe-code-executor

# 检查类型
pnpm build
```

#### 预期效果

- ✅ 消除RCE风险
- ✅ 内存隔离（无法访问主进程内存）
- ✅ 超时保护
- ✅ 禁止危险API（require、import、process等）
- ⚠️ 性能轻微下降（约10-20%，可接受）

---

### 1.2 超大文件重构

**问题**: `src/gateway/setup-page.ts` 有8260行代码

#### 重构方案

**目标结构**:
```
src/gateway/setup-page/
├── index.ts                    # 主入口
├── types.ts                    # 类型定义
├── platform-detector.ts        # 平台检测
├── logo-handler.ts             # Logo处理
├── html-generator.ts           # HTML生成器
├── styles/
│   ├── index.ts
│   ├── base.ts                # 基础样式
│   ├── components.ts          # 组件样式
│   └── responsive.ts          # 响应式样式
├── sections/
│   ├── header.ts              # 头部区域
│   ├── platform-info.ts       # 平台信息
│   ├── step1-models.ts        # 步骤1：模型配置
│   ├── step2-workspace.ts     # 步骤2：工作区
│   ├── step3-channels.ts      # 步骤3：渠道配置
│   ├── step4-wechat.ts        # 步骤4：微信二维码
│   └── footer.ts              # 底部
├── providers/
│   ├── cn-providers.ts        # 中国区提供商
│   └── affiliate-links.ts     # 推广链接
└── scripts/
    ├── form-handler.ts        # 表单处理
    └── api-client.ts          # API调用
```

#### 实施代码

**1. types.ts - 类型定义**

```typescript
// src/gateway/setup-page/types.ts
export interface PlatformInfo {
  os: string;
  variant: 'lite' | 'pro';
  sandboxType: string;
  icon: string;
  displayName: string;
}

export interface SetupPageOptions {
  gatewayToken?: string;
  platformInfo: PlatformInfo;
  defaultWorkspace: string;
  logoBase64: string;
}

export interface ProviderConfig {
  name: string;
  apiKeyVar: string;
  quickStartUrl: string;
  priceUrl: string;
}
```

**2. platform-detector.ts - 平台检测**

```typescript
// src/gateway/setup-page/platform-detector.ts
import os from 'node:os';
import type { PlatformInfo } from './types.js';

export function detectPlatformInfo(): PlatformInfo {
  const platform = os.platform();
  const hasDocker = process.env.CLAWDBOT_DOCKER === '1' || !!process.env.DOCKER_HOST;
  const variant = hasDocker ? 'pro' : 'lite';

  const platformMap: Record<string, PlatformInfo> = {
    darwin: {
      os: 'macOS',
      variant: 'lite',
      sandboxType: '软沙盒（目录隔离）',
      icon: '🍎',
      displayName: 'macOS Lite 版',
    },
    win32: {
      os: 'Windows',
      variant,
      sandboxType: variant === 'pro' ? 'Docker 容器沙盒' : '轻量沙盒',
      icon: '🪟',
      displayName: `Windows ${variant === 'pro' ? 'Pro' : 'Lite'} 版`,
    },
    linux: {
      os: 'Linux',
      variant,
      sandboxType: variant === 'pro' ? 'Docker 容器沙盒' : '轻量沙盒',
      icon: '🐧',
      displayName: `Linux ${variant === 'pro' ? 'Pro' : 'Lite'} 版`,
    },
  };

  return platformMap[platform] || platformMap.linux;
}

export function getDefaultWorkspace(): string {
  const platform = os.platform();

  const workspaceMap: Record<string, string> = {
    win32: 'D:\\Clawdbot\\workspace',
    darwin: '~/.clawbotcn/workspace',
    linux: '/opt/clawdbot/workspace',
  };

  return workspaceMap[platform] || workspaceMap.linux;
}
```

**3. styles/base.ts - 基础样式**

```typescript
// src/gateway/setup-page/styles/base.ts
export const baseStyles = `
:root {
  --primary: #2563eb;
  --primary-dark: #1e40af;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --border: #e5e7eb;
  --radius: 8px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  padding: 20px;
  color: var(--text-primary);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background: var(--bg-primary);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
  overflow: hidden;
}
`;
```

**4. sections/header.ts - 头部区域**

```typescript
// src/gateway/setup-page/sections/header.ts
import type { SetupPageOptions } from '../types.js';

export function generateHeader(options: SetupPageOptions): string {
  const { logoBase64, platformInfo } = options;

  return `
    <header class="header">
      <div class="header-content">
        ${logoBase64
          ? `<img src="${logoBase64}" alt="Clawdbot Logo" class="logo">`
          : `<div class="logo-placeholder">🤖</div>`
        }
        <h1>Clawdbot 安装向导</h1>
        <p class="platform-badge">
          <span class="platform-icon">${platformInfo.icon}</span>
          ${platformInfo.displayName}
        </p>
      </div>
    </header>
  `;
}
```

**5. html-generator.ts - HTML生成器**

```typescript
// src/gateway/setup-page/html-generator.ts
import type { SetupPageOptions } from './types.js';
import { baseStyles } from './styles/base.js';
import { componentStyles } from './styles/components.js';
import { generateHeader } from './sections/header.js';
import { generateStep1 } from './sections/step1-models.js';
import { generateStep2 } from './sections/step2-workspace.js';
import { generateStep3 } from './sections/step3-channels.js';
import { generateStep4 } from './sections/step4-wechat.js';
import { generateFooter } from './sections/footer.js';
import { generateScripts } from './scripts/form-handler.js';

export function generateSetupPageHtml(options: SetupPageOptions): string {
  // 防止XSS：转义token
  const safeToken = options.gatewayToken
    ? JSON.stringify(options.gatewayToken).replace(/<\//g, '<\\/')
    : 'null';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Clawdbot 安装向导</title>
  <style>
    ${baseStyles}
    ${componentStyles}
  </style>
  <script>window.__GATEWAY_TOKEN__ = ${safeToken};</script>
</head>
<body>
  <div class="container">
    ${generateHeader(options)}
    <main class="content">
      ${generateStep1(options)}
      ${generateStep2(options)}
      ${generateStep3(options)}
      ${generateStep4(options)}
    </main>
    ${generateFooter()}
  </div>
  ${generateScripts()}
</body>
</html>`;
}
```

**6. index.ts - 主入口**

```typescript
// src/gateway/setup-page/index.ts
import { detectPlatformInfo, getDefaultWorkspace } from './platform-detector.js';
import { getLogoBase64 } from './logo-handler.js';
import { generateSetupPageHtml } from './html-generator.js';

export function generateSetupPage(gatewayToken?: string): string {
  const options = {
    gatewayToken,
    platformInfo: detectPlatformInfo(),
    defaultWorkspace: getDefaultWorkspace(),
    logoBase64: getLogoBase64(),
  };

  return generateSetupPageHtml(options);
}

// 向后兼容的导出
export { generateSetupPageHtml } from './html-generator.js';
```

**7. 更新原文件**

```typescript
// src/gateway/setup-page.ts (重构后 - 只保留导出)
/**
 * Setup Page HTML Generator
 * 已重构为模块化结构，位于 setup-page/ 目录
 * @deprecated 使用 setup-page/index.ts
 */
export { generateSetupPage, generateSetupPageHtml } from './setup-page/index.js';
```

#### 实施步骤

```bash
# 1. 创建目录结构
mkdir -p src/gateway/setup-page/{styles,sections,providers,scripts}

# 2. 创建文件
touch src/gateway/setup-page/{index,types,platform-detector,logo-handler,html-generator}.ts
touch src/gateway/setup-page/styles/{index,base,components,responsive}.ts
touch src/gateway/setup-page/sections/{header,step1-models,step2-workspace,step3-channels,step4-wechat,footer}.ts
touch src/gateway/setup-page/scripts/{form-handler,api-client}.ts

# 3. 逐步迁移代码（每次迁移一个模块，运行测试）
# 4. 更新导入语句
# 5. 删除旧文件（确认一切正常后）
```

#### 预期效果

- ✅ 单文件不超过300行
- ✅ 模块职责清晰
- ✅ 易于测试和维护
- ✅ 代码复用性提高

---

## P1 - 重要优化

### 2.1 提升测试覆盖率

**目标**: 分支覆盖率从55%提升到70%

#### 策略

**1. 识别未覆盖的分支**

```bash
# 生成覆盖率报告
pnpm test:coverage

# 查看HTML报告
open coverage/index.html
```

**2. 优先补充高风险模块的测试**

```typescript
// src/agents/bash-tools.exec.test.ts (示例)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeBashCommand } from './bash-tools.exec.js';

describe('executeBashCommand - Edge Cases', () => {
  // ✅ 测试正常路径
  it('should execute simple command', async () => {
    const result = await executeBashCommand('echo "hello"');
    expect(result.stdout).toBe('hello\n');
    expect(result.exitCode).toBe(0);
  });

  // ✅ 测试错误分支
  it('should handle command not found', async () => {
    await expect(
      executeBashCommand('nonexistent_command_xyz')
    ).rejects.toThrow(/not found|cannot find/i);
  });

  // ✅ 测试超时分支
  it('should timeout long-running command', async () => {
    await expect(
      executeBashCommand('sleep 10', { timeout: 100 })
    ).rejects.toThrow(/timeout/i);
  });

  // ✅ 测试权限错误分支
  it('should handle permission denied', async () => {
    if (process.platform !== 'win32') {
      await expect(
        executeBashCommand('cat /root/.ssh/id_rsa')
      ).rejects.toThrow(/permission denied/i);
    }
  });

  // ✅ 测试边界条件
  it('should handle empty command', async () => {
    await expect(
      executeBashCommand('')
    ).rejects.toThrow(/empty command/i);
  });

  it('should handle very long output', async () => {
    const result = await executeBashCommand('seq 1 10000');
    expect(result.stdout.split('\n').length).toBeGreaterThan(9000);
  });

  // ✅ 测试信号处理分支
  it('should handle SIGTERM', async () => {
    const promise = executeBashCommand('sleep 100');
    setTimeout(() => {
      process.kill(process.pid, 'SIGTERM');
    }, 50);
    await expect(promise).rejects.toThrow();
  });
});
```

**3. 参数化测试提高覆盖率**

```typescript
// src/config/validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateConfig } from './validation.js';

describe('validateConfig - Parameterized Tests', () => {
  const testCases = [
    {
      name: 'valid minimal config',
      input: { agents: { defaultModel: 'claude-3' } },
      expected: { ok: true },
    },
    {
      name: 'invalid model name',
      input: { agents: { defaultModel: '' } },
      expected: { ok: false, error: /model name/i },
    },
    {
      name: 'missing required field',
      input: {},
      expected: { ok: false, error: /required/i },
    },
    {
      name: 'invalid type',
      input: { agents: { defaultModel: 123 } },
      expected: { ok: false, error: /type/i },
    },
    {
      name: 'unknown field',
      input: { unknownField: 'value' },
      expected: { ok: false, error: /unknown/i },
    },
  ];

  testCases.forEach(({ name, input, expected }) => {
    it(name, () => {
      const result = validateConfig(input);

      if (expected.ok) {
        expect(result.ok).toBe(true);
      } else {
        expect(result.ok).toBe(false);
        expect(result.error).toMatch(expected.error);
      }
    });
  });
});
```

**4. Mock外部依赖**

```typescript
// src/agents/anthropic-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AnthropicClient } from './anthropic-client.js';

describe('AnthropicClient - Error Handling', () => {
  it('should retry on network error', async () => {
    const mockFetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 'ok' }) });

    global.fetch = mockFetch;

    const client = new AnthropicClient({ retries: 3 });
    const result = await client.sendMessage('test');

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ result: 'ok' });
  });

  it('should handle rate limiting', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'retry-after': '1' })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'ok' })
      });

    global.fetch = mockFetch;

    const client = new AnthropicClient();
    const result = await client.sendMessage('test');

    expect(result).toEqual({ result: 'ok' });
  });
});
```

#### 覆盖率提升检查清单

- [ ] 每个函数至少有正常路径测试
- [ ] 每个if/else分支都有测试
- [ ] 每个try/catch都有异常测试
- [ ] 每个switch case都有测试
- [ ] 边界条件都有测试（空值、null、undefined、空数组等）
- [ ] 错误处理路径都有测试
- [ ] 异步超时场景有测试

---

### 2.2 技术债务清理

**任务**: 处理14个TODO/FIXME注释

#### 清理步骤

```bash
# 1. 列出所有TODO
grep -rn "TODO\|FIXME\|XXX\|HACK" src --include="*.ts" > todos.txt

# 2. 分类处理
# - 立即修复：影响功能或安全的
# - 计划修复：性能优化、重构
# - 删除：已过时的TODO
```

#### TODO处理模板

```typescript
// ❌ 不好的TODO
// TODO: fix this

// ✅ 好的TODO
// TODO(username, 2026-02-10): Optimize query performance when user count > 10k
// See issue #123 for context

// ✅ 更好：直接修复或创建issue
// [已修复] 或 [已创建Issue #456]
```

---

### 2.3 大文件拆分

**目标**: 将112个超过500行的文件拆分到合理范围

#### 优先级列表

| 文件 | 行数 | 优先级 | 建议 |
|------|------|--------|------|
| telegram/bot.test.ts | 2,865 | P1 | 按功能分组拆分测试 |
| gateway/setup-wizard.ts | 2,431 | P1 | 拆分为wizard步骤模块 |
| agents/skills-install.ts | 2,431 | P1 | 拆分为安装器、验证器、下载器 |
| memory/manager.ts | 2,178 | P2 | 拆分为存储、检索、索引模块 |

---

## P2 - 性能优化

### 3.1 插件缓存优化

```typescript
// src/plugins/loader-cache.ts
interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private maxAge: number;

  constructor(options: { maxSize?: number; maxAge?: number } = {}) {
    this.maxSize = options.maxSize ?? 100;
    this.maxAge = options.maxAge ?? 3600000; // 1小时
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);

    if (!entry) return undefined;

    // 检查过期
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return undefined;
    }

    // 更新访问计数
    entry.accessCount++;

    return entry.value;
  }

  set(key: K, value: V): void {
    // 如果缓存满了，删除最少使用的
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  private evictLRU(): void {
    let minAccessCount = Infinity;
    let lruKey: K | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        lruKey = key;
      }
    }

    if (lruKey !== null) {
      this.cache.delete(lruKey);
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
```

---

## P3 - 代码质量提升

### 4.1 ESLint规则增强

```json
// .eslintrc.json (新增)
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_"
    }],
    "@typescript-eslint/no-floating-promises": "error",
    "no-eval": "error",
    "max-lines": ["warn", { "max": 500 }],
    "complexity": ["warn", { "max": 10 }]
  }
}
```

### 4.2 Pre-commit Hooks

```bash
#!/bin/bash
# .husky/pre-commit

# 检查文件大小
find src -name "*.ts" -type f | while read file; do
  lines=$(wc -l < "$file")
  if [ $lines -gt 500 ]; then
    echo "⚠️  Warning: $file has $lines lines (max: 500)"
  fi
done

# 运行linter
pnpm lint

# 运行类型检查
pnpm build --noEmit

# 运行测试
pnpm test --run
```

---

## 📊 实施时间表

### Week 1
- [ ] 实施eval安全修复
- [ ] 开始setup-page.ts拆分
- [ ] 补充10个关键模块的测试

### Week 2
- [ ] 完成setup-page.ts拆分
- [ ] 处理所有P0 TODO
- [ ] 分支覆盖率提升至65%

### Week 3-4
- [ ] 拆分其他大文件
- [ ] 分支覆盖率提升至70%
- [ ] 实施性能优化

### Week 5-8
- [ ] 处理所有TODO
- [ ] 代码质量工具配置
- [ ] 文档完善

---

## ✅ 验收标准

### P0完成标准
- [ ] 零eval使用（或全部在沙箱中）
- [ ] 所有文件<1000行
- [ ] 所有测试通过

### P1完成标准
- [ ] 分支覆盖率≥70%
- [ ] TODO≤5个
- [ ] 核心文件≤500行

### 整体质量标准
- [ ] 零安全漏洞
- [ ] 构建成功率100%
- [ ] 测试成功率100%
- [ ] 文档完整度≥80%

---

**下一步**: 建议从P0的eval安全修复开始，这是最紧急的安全问题。
