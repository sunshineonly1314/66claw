# OpenClawCN 优化快速开始指南
**Quick Start Guide - 立即可执行的优化步骤**

---

## 🚀 今天就可以开始的工作

### 第1步：评估现状 (30分钟)

```bash
# 1. 查看所有eval使用位置
echo "=== Eval使用情况 ===" > optimization-audit.txt
grep -rn "eval(" src --include="*.ts" >> optimization-audit.txt
echo "" >> optimization-audit.txt

# 2. 统计文件大小
echo "=== 超大文件列表 ===" >> optimization-audit.txt
find src -name "*.ts" ! -name "*.test.ts" -exec wc -l {} + | sort -rn | head -20 >> optimization-audit.txt
echo "" >> optimization-audit.txt

# 3. 检查TODO/FIXME
echo "=== 技术债务 ===" >> optimization-audit.txt
grep -rn "TODO\|FIXME\|XXX\|HACK" src --include="*.ts" >> optimization-audit.txt
echo "" >> optimization-audit.txt

# 4. 检查依赖漏洞
echo "=== 依赖安全 ===" >> optimization-audit.txt
pnpm audit >> optimization-audit.txt 2>&1
echo "" >> optimization-audit.txt

# 5. 查看测试覆盖率
pnpm test:coverage --reporter=text >> optimization-audit.txt 2>&1

# 查看报告
cat optimization-audit.txt
```

### 第2步：优先处理eval安全问题 (2-3天)

#### 2.1 安装必要依赖

```bash
# 方案1：使用isolated-vm (推荐)
pnpm add isolated-vm
pnpm add -D @types/isolated-vm

# 方案2：使用VM2 (备用)
pnpm add vm2
pnpm add -D @types/vm2

# 方案3：使用acorn (最保守)
pnpm add acorn acorn-walk
pnpm add -D @types/acorn
```

#### 2.2 创建安全执行器

```bash
# 创建目录
mkdir -p src/browser/sandbox

# 创建文件
cat > src/browser/sandbox/safe-executor.ts << 'EOF'
import ivm from 'isolated-vm';

export class SafeCodeExecutor {
  private isolate: ivm.Isolate;
  private context: ivm.Context;

  constructor(options: { memoryLimit?: number } = {}) {
    this.isolate = new ivm.Isolate({
      memoryLimit: options.memoryLimit ?? 128
    });
    this.context = this.isolate.createContextSync();
  }

  executeFunctionSync(fnBody: string, timeout = 1000): unknown {
    this.validateInput(fnBody);
    const script = this.isolate.compileScriptSync(`(${fnBody})`);
    return script.runSync(this.context, { timeout, release: true });
  }

  private validateInput(fnBody: string): void {
    if (!fnBody || typeof fnBody !== 'string') {
      throw new Error('Invalid function body');
    }
    if (fnBody.length > 10000) {
      throw new Error('Function body too large');
    }

    // 黑名单检查
    const forbidden = [
      /require\s*\(/,
      /import\s+/,
      /process\./,
      /eval\s*\(/,
      /Function\s*\(/,
    ];

    for (const pattern of forbidden) {
      if (pattern.test(fnBody)) {
        throw new Error(`Forbidden pattern: ${pattern}`);
      }
    }
  }

  dispose(): void {
    this.context.release();
    this.isolate.dispose();
  }
}
EOF

# 创建测试
cat > src/browser/sandbox/safe-executor.test.ts << 'EOF'
import { describe, it, expect } from 'vitest';
import { SafeCodeExecutor } from './safe-executor.js';

describe('SafeCodeExecutor', () => {
  it('should execute safe code', () => {
    const executor = new SafeCodeExecutor();
    const result = executor.executeFunctionSync('() => 1 + 1');
    expect(result).toBe(2);
    executor.dispose();
  });

  it('should block require()', () => {
    const executor = new SafeCodeExecutor();
    expect(() => {
      executor.executeFunctionSync('() => require("fs")');
    }).toThrow(/Forbidden/);
    executor.dispose();
  });

  it('should block eval()', () => {
    const executor = new SafeCodeExecutor();
    expect(() => {
      executor.executeFunctionSync('() => eval("1+1")');
    }).toThrow(/Forbidden/);
    executor.dispose();
  });
});
EOF
```

#### 2.3 测试安全执行器

```bash
# 运行测试
pnpm test src/browser/sandbox/safe-executor.test.ts

# 如果测试通过，继续下一步
```

#### 2.4 修改pw-tools-core.interactions.ts

```bash
# 备份原文件
cp src/browser/pw-tools-core.interactions.ts src/browser/pw-tools-core.interactions.ts.backup

# 手动修改文件，或使用以下脚本
cat > /tmp/patch-pw-tools.sh << 'EOF'
#!/bin/bash
FILE="src/browser/pw-tools-core.interactions.ts"

# 在文件顶部添加import
sed -i '1i import { SafeCodeExecutor } from "./sandbox/safe-executor.js";' "$FILE"
sed -i '2i ' "$FILE"
sed -i '3i let executorInstance: SafeCodeExecutor | null = null;' "$FILE"
sed -i '4i function getExecutor() {' "$FILE"
sed -i '5i   if (!executorInstance) {' "$FILE"
sed -i '6i     executorInstance = new SafeCodeExecutor();' "$FILE"
sed -i '7i   }' "$FILE"
sed -i '8i   return executorInstance;' "$FILE"
sed -i '9i }' "$FILE"

# 替换eval调用
sed -i 's/eval("(" + fnBody + ")")/getExecutor().executeFunctionSync(fnBody)/g' "$FILE"

echo "✅ Patched $FILE"
EOF

chmod +x /tmp/patch-pw-tools.sh
# 根据实际情况运行（建议手动修改）
```

#### 2.5 验证修改

```bash
# 运行所有测试
pnpm test

# 如果有失败，检查并修复
# 然后重新运行测试

# 构建检查
pnpm build

# 如果一切正常，提交代码
git add src/browser/sandbox/
git add src/browser/pw-tools-core.interactions.ts
git commit -m "security: replace eval with isolated-vm sandbox

- Add SafeCodeExecutor using isolated-vm
- Block dangerous APIs (require, import, process, eval)
- Add timeout and memory limits
- Add comprehensive tests

Fixes: eval security vulnerability (136 instances -> 0)
"
```

---

### 第3步：拆分超大文件 (3-5天)

#### 3.1 准备工作

```bash
# 创建setup-page模块目录
mkdir -p src/gateway/setup-page/{styles,sections,providers,scripts}

# 创建基础文件
touch src/gateway/setup-page/index.ts
touch src/gateway/setup-page/types.ts
touch src/gateway/setup-page/platform-detector.ts
touch src/gateway/setup-page/logo-handler.ts
touch src/gateway/setup-page/html-generator.ts

# 创建样式文件
touch src/gateway/setup-page/styles/{index,base,components,responsive}.ts

# 创建区块文件
touch src/gateway/setup-page/sections/{header,step1-models,step2-workspace,step3-channels,step4-wechat,footer}.ts

# 创建脚本文件
touch src/gateway/setup-page/scripts/{form-handler,api-client}.ts
```

#### 3.2 逐步迁移（每天一个模块）

**Day 1: 类型定义和工具函数**
```bash
# 1. 提取类型定义到 types.ts
# 2. 提取平台检测到 platform-detector.ts
# 3. 提取Logo处理到 logo-handler.ts
# 4. 运行测试确保无破坏
pnpm test
```

**Day 2: 样式模块**
```bash
# 1. 提取CSS到 styles/base.ts
# 2. 提取组件样式到 styles/components.ts
# 3. 提取响应式样式到 styles/responsive.ts
# 4. 测试
pnpm test
```

**Day 3-4: HTML区块**
```bash
# 每天迁移2-3个区块
# Day 3: header, step1, step2
# Day 4: step3, step4, footer
# 每次迁移后运行测试
```

**Day 5: 整合和清理**
```bash
# 1. 创建主入口 index.ts
# 2. 更新所有导入
# 3. 删除旧文件（备份后）
# 4. 全面测试
pnpm test
pnpm build
```

#### 3.3 验证重构

```bash
# 1. 运行所有测试
pnpm test

# 2. 启动开发服务器
pnpm gateway:dev

# 3. 访问 http://localhost:3000/setup
# 4. 确认页面正常显示

# 5. 如果一切正常，提交
git add src/gateway/setup-page/
git commit -m "refactor: split setup-page.ts into modular structure

- Split 8260-line file into 15+ focused modules
- Improve maintainability and testability
- No functional changes

Before: 1 file, 8260 lines
After: 15 files, ~500 lines each
"
```

---

### 第4步：提升测试覆盖率 (1-2周)

#### 4.1 找出未覆盖的分支

```bash
# 生成覆盖率报告
pnpm test:coverage

# 打开HTML报告
# Windows:
start coverage/index.html
# macOS:
open coverage/index.html
# Linux:
xdg-open coverage/index.html
```

#### 4.2 每天补充5-10个测试

```bash
# 创建测试任务列表
cat > test-coverage-tasks.md << 'EOF'
# 测试覆盖率提升任务

## Week 1
- [ ] Day 1: agents/bash-tools.exec.ts - 添加错误分支测试
- [ ] Day 2: config/validation.ts - 添加边界条件测试
- [ ] Day 3: security/audit.ts - 添加文件系统测试
- [ ] Day 4: plugins/loader.ts - 添加插件加载失败测试
- [ ] Day 5: gateway/auth.ts - 添加认证失败测试

## Week 2
- [ ] Day 1: memory/manager.ts - 添加内存限制测试
- [ ] Day 2: whatsapp/client.ts - 添加连接失败测试
- [ ] Day 3: telegram/bot.ts - 添加API错误测试
- [ ] Day 4: slack/handler.ts - 添加消息格式测试
- [ ] Day 5: discord/client.ts - 添加重连测试
EOF

# 每天完成一项，更新清单
```

#### 4.3 测试模板

```typescript
// 复制这个模板用于新测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ModuleName', () => {
  // 正常路径
  it('should work with valid input', () => {
    // 测试代码
  });

  // 错误分支
  it('should handle invalid input', () => {
    expect(() => {
      // 触发错误的代码
    }).toThrow(/expected error/);
  });

  // 边界条件
  it('should handle empty input', () => {
    // 测试空值
  });

  it('should handle null/undefined', () => {
    // 测试null和undefined
  });

  // 异步错误
  it('should handle async errors', async () => {
    await expect(
      asyncFunction()
    ).rejects.toThrow();
  });

  // Mock外部依赖
  it('should handle external failures', () => {
    const mockFn = vi.fn().mockRejectedValue(new Error('External error'));
    // 测试代码
  });
});
```

---

### 第5步：技术债务清理 (1周)

```bash
# 1. 导出所有TODO
grep -rn "TODO\|FIXME\|XXX\|HACK" src --include="*.ts" > todos.txt

# 2. 分类
cat > todo-categories.md << 'EOF'
# TODO分类和处理计划

## 立即修复 (P0)
- [ ] TODO in security/audit.ts:123 - 修复权限检查逻辑
- [ ] FIXME in agents/auth.ts:456 - 处理token过期

## 计划修复 (P1)
- [ ] TODO in memory/index.ts:78 - 优化查询性能
- [ ] HACK in config/io.ts:234 - 重构配置解析

## 可选优化 (P2)
- [ ] TODO in ui/components.ts:90 - 改进UI响应速度

## 已过时 (删除)
- [ ] TODO in old-module.ts - 模块已废弃
EOF

# 3. 每天处理2-3个TODO
# 4. 更新进度
```

---

## 📊 进度跟踪

### 每日检查清单

```bash
#!/bin/bash
# scripts/daily-check.sh

echo "📊 OpenClawCN 优化进度 - $(date +%Y-%m-%d)"
echo ""

echo "🔍 1. Eval使用情况:"
EVAL_COUNT=$(grep -r "eval(" src --include="*.ts" | wc -l)
echo "   当前: $EVAL_COUNT 处 (目标: 0)"
echo ""

echo "📏 2. 超大文件:"
BIG_FILES=$(find src -name "*.ts" ! -name "*.test.ts" -exec wc -l {} + | awk '$1 > 500' | wc -l)
echo "   当前: $BIG_FILES 个 (目标: <50)"
echo ""

echo "✅ 3. 测试覆盖率:"
pnpm test:coverage --reporter=text 2>&1 | grep "Branches" | awk '{print "   " $0}'
echo ""

echo "📝 4. 技术债务:"
TODO_COUNT=$(grep -r "TODO\|FIXME" src --include="*.ts" | wc -l)
echo "   当前: $TODO_COUNT 个 (目标: <5)"
echo ""

echo "🔒 5. 依赖漏洞:"
pnpm audit --audit-level=moderate 2>&1 | grep -E "moderate|high|critical" | head -5
echo ""
```

```bash
# 每天运行一次
chmod +x scripts/daily-check.sh
./scripts/daily-check.sh
```

---

## 🎯 每周里程碑

### Week 1 目标
- [ ] eval安全修复完成
- [ ] 前3个最大文件开始拆分
- [ ] 覆盖率提升5%

### Week 2 目标
- [ ] setup-page.ts拆分完成
- [ ] 10个P0 TODO已处理
- [ ] 覆盖率提升至65%

### Week 3 目标
- [ ] 前10个大文件拆分完成
- [ ] 所有TODO<10个
- [ ] 覆盖率达到70%

### Week 4 目标
- [ ] 所有P0/P1优化完成
- [ ] 代码质量工具配置完成
- [ ] 编写优化总结文档

---

## 🔧 实用脚本

### 自动化重构助手

```bash
#!/bin/bash
# scripts/refactor-helper.sh

function split_file() {
  local file=$1
  local lines=$(wc -l < "$file")

  if [ $lines -gt 500 ]; then
    echo "⚠️  $file has $lines lines"
    echo "   建议拆分为 $(($lines / 300 + 1)) 个模块"
  fi
}

# 检查所有文件
find src -name "*.ts" ! -name "*.test.ts" | while read file; do
  split_file "$file"
done
```

### Git Hooks

```bash
# .git/hooks/pre-commit
#!/bin/bash

echo "🔍 Running pre-commit checks..."

# 1. 检查eval
if git diff --cached --name-only | grep -q "\.ts$"; then
  EVAL_ADDED=$(git diff --cached -G"eval\(" | grep "^+" | grep "eval(" | wc -l)
  if [ $EVAL_ADDED -gt 0 ]; then
    echo "❌ New eval() usage detected!"
    echo "   请使用 SafeCodeExecutor 替代"
    exit 1
  fi
fi

# 2. 检查文件大小
git diff --cached --name-only | grep "\.ts$" | while read file; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file")
    if [ $lines -gt 1000 ]; then
      echo "⚠️  $file has $lines lines (should be <500)"
    fi
  fi
done

# 3. 运行快速测试
pnpm test --run --silent

echo "✅ Pre-commit checks passed"
```

---

## 💡 最佳实践提醒

### 代码提交

```bash
# 1. 小步提交
git add src/browser/sandbox/safe-executor.ts
git commit -m "feat(security): add SafeCodeExecutor for sandboxed code execution"

git add src/browser/pw-tools-core.interactions.ts
git commit -m "refactor(security): replace eval with SafeCodeExecutor"

# 2. 运行测试
pnpm test

# 3. 推送
git push
```

### 重构检查清单

每次重构后：
- [ ] 所有测试通过
- [ ] 构建成功
- [ ] 功能手动验证
- [ ] 代码审查（自己或团队）
- [ ] 文档更新

---

## 🆘 遇到问题？

### 常见问题解决

**Q: isolated-vm安装失败**
```bash
# Windows需要安装构建工具
npm install --global windows-build-tools

# 或使用VM2
pnpm remove isolated-vm
pnpm add vm2
```

**Q: 测试失败**
```bash
# 清除缓存重试
pnpm test --clearCache
pnpm test
```

**Q: 构建错误**
```bash
# 清理重建
rm -rf dist node_modules
pnpm install
pnpm build
```

---

## 📞 需要帮助？

1. 查看详细文档: [OPTIMIZATION_PLAN.md](OPTIMIZATION_PLAN.md)
2. 查看代码审查报告: [CODE_REVIEW_REPORT.md](CODE_REVIEW_REPORT.md)
3. 提Issue讨论具体问题

---

**开始时间建议**: 明天早上 ☕
**预计完成**: 4-8周
**预期收益**:
- 🔒 安全性提升 (消除RCE风险)
- 📈 代码质量提升 (可维护性+50%)
- ✅ 测试覆盖率提升 (55%→70%)
- 🚀 团队效率提升 (减少bug调试时间)

Good luck! 🎉
