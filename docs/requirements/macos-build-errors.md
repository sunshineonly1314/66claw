# macOS 构建错误清单

> 日期: 2026-02-19
> 排查者: Claude Code
> 状态: 全部修复完成

---

## BUG-1: bytecode 重复编译（build:secure 已包含 compile-bytecode）[P0]

**文件:** `build/scripts/build-macos-cn.sh` 第 103 行 + 第 115 行

**现象:**
Step 2 调用 `pnpm build:secure`，其内部已经执行了 `compile-bytecode.ts`（见 package.json 第 46 行）。
Step 3 又单独调用了 `node --import tsx cn/scripts/build/compile-bytecode.ts`。

bytecode 被编译了两次：
1. 第一次（Step 2 内部）：正常编译 `.js` → `.cjs` → `.jsc`，替换 `.js` 为 loader stub
2. 第二次（Step 3）：对 **已经是 loader stub 的 `.js` 文件** 再次执行 ESM→CJS 转换 + bytecode 编译

第二次编译的输入是 loader stub（约 5-10 行的 require("bytenode") 代码），不是原始业务逻辑。这导致：
- 最终 .jsc 文件内容是 loader stub 的 bytecode，不是业务代码的 bytecode
- .jsc 文件体积异常小（loader stub 只有几百字节）
- **这就是为什么 .app 中 .jsc 文件可能"存在"但无效，或者 DMG 只有 60MB 的原因**

**修复:** 删除 Step 3 和 Step 4（重复调用），因为 `build:secure` 已包含 bytecode 编译 + integrity 生成。

---

## BUG-2: bytenode 是 devDependency，运行时缺失 [P0-CRITICAL]

**文件:** `package.json` 第 194 行

**现象:**
`bytenode` 在 `devDependencies` 中，但 bytecode loader stub 在运行时需要它：
```js
// V8 Bytecode Loader (CJS) — compiled from source, do not edit
"use strict";
require("bytenode");  // ← 运行时 require！
const _mod = require("./engine.jsc");
```

Step 8 使用 `npm install --omit=dev`，不会安装 devDependencies。因此 .app 的 node_modules 中没有 bytenode，导致运行时 `require("bytenode")` 抛出 MODULE_NOT_FOUND 错误。

**影响:** 即使 .jsc 文件正确复制到了 .app，应用也会在启动时崩溃。

**修复:** 将 `bytenode` 从 `devDependencies` 移到 `dependencies`。

---

## BUG-3: node_modules 清理可能误删 native 模块目录 [P2]

**文件:** `build/scripts/build-macos-cn.sh` 第 483-484 行

**代码:**
```bash
find node_modules -type d -name "linux*" -exec rm -rf {} + 2>/dev/null || true
find node_modules -type d -name "win32*" -exec rm -rf {} + 2>/dev/null || true
```

**问题:** glob pattern `linux*` 和 `win32*` 过于宽泛，可能匹配到非 native 模块目录。
例如 `node_modules/some-pkg/docs/linux-setup/` 会被误删。

不过实际影响较小（node_modules 中很少有这种命名），标记为 P2。

**建议修复:** 限制 pattern 更精确，如 `linux-x64`, `linux-arm64`, `win32-x64`, `win32-arm64`, `win32-ia32`。

---

## BUG-4: Step 8 的 npm install 可能找不到 npm 二进制 [P1]

**文件:** `build/scripts/build-macos-cn.sh` 第 434 行

**代码:**
```bash
"$RESOURCES/node/bin/node" "$(which npm 2>/dev/null || echo "$NODE_DL_DIR/node-arm64/lib/node_modules/npm/bin/npm-cli.js")" \
  install --omit=dev --ignore-scripts --no-audit --no-fund 2>&1 || true
```

**问题:**
1. `which npm` 可能找到系统 npm（与 bundled Node 版本不匹配）
2. fallback 路径 `$NODE_DL_DIR/node-arm64/lib/node_modules/npm/bin/npm-cli.js` 只对 arm64 有效，如果构建 x64 或 universal 架构，arm64 npm 路径可能不存在（虽然 universal 也会下载 arm64）
3. `|| true` 吞掉了 npm install 失败，导致 node_modules 可能为空

**修复:** 使用更可靠的 npm 路径查找逻辑。

---

## BUG-5: ci/build-macos.sh 的 sed patch 仍在注释 codesign [P1-FIXED]

**文件:** `ci/build-macos.sh` 第 110 行

**代码:**
```bash
sed -i.bak '/codesign-mac-app\.sh/s/^/# SKIPPED: /' build/scripts/build-macos-cn.sh
```

**现状:** `build-macos-cn.sh` 已经在 Step 9 加了 `SKIP_CODESIGN` 逻辑（默认值为 1），所以 sed patch 虽然多余但不会造成错误。可以安全移除以保持代码整洁。

---

## BUG-6: 工作目录路径 ~ 未展开 [P0-FIXED]

**文件:** `ci/config.json` 第 24 行

**状态:** 已修复 — workspace 和 output 改为绝对路径。

---

## 问题影响关系

```
BUG-1 (bytecode 重复编译) + BUG-2 (bytenode 运行时缺失) =
  → .jsc 文件可能无效 + 运行时崩溃
  → 这是 DMG 60MB（而非 100MB+）和 .app 中 .jsc 丢失的根因
```

---

## 修复状态

| 编号 | 问题 | 优先级 | 修复文件 | 状态 |
|------|------|--------|----------|------|
| BUG-2 | bytenode 运行时缺失 | P0 | package.json | **已修复** — 移到 dependencies |
| BUG-1 | bytecode 重复编译 | P0 | build/scripts/build-macos-cn.sh | **已修复** — 删除重复 Step 3/4 |
| BUG-4 | npm 路径不可靠 | P1 | build/scripts/build-macos-cn.sh | **已修复** — 从下载目录查找 npm |
| BUG-5 | sed patch 多余 | P1 | ci/build-macos.sh | **已修复** — 用 SKIP_CODESIGN=1 替代 |
| BUG-3 | 清理 glob 过宽 | P2 | build/scripts/build-macos-cn.sh | **已修复** — 精确 platform-arch 匹配 |
| BUG-6 | ~ 未展开 | P0 | ci/config.json | **已修复** — 改为绝对路径 |

## 额外加固

- 在 build:secure 后添加 .jsc 数量验证（>=5 个才通过）
- 在 cp -R dist 后添加 .app 内 .jsc 数量验证
- 在 node_modules 清理后验证 .jsc 和 bytenode 完整性
- npm install 失败不再静默吞错（移除 `|| true`）
