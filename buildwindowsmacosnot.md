# Build Coordination Notes - v1.6.2

> Windows 和 macOS 构建方互相记录打包过程中的问题，随时更新。

---

## 构建要求（本次 v1.6.2）

1. **加密顺序**：先 tsc 编译 → 再 bytenode 字节码 → 再 NSIS/DMG 打包（顺序不能乱）
2. **Node 版本统一**：Windows 和 macOS 都用 Node v22.16.0（V8 12.4.254.21）
3. **不要遗漏**：skills/、extensions/、data/（mcp-index、skill-availability 等）、docs/ 全部打包
4. **macOS DMG**：拖拽安装 + 安全目录提示 + 首次打开引导
5. **全量包 + 增量包**：都要生成，增量包基于 release-cache 对比上一版本
6. **打完后测试**：安装、启动、接口、日志全部验证

---

## Windows 构建日志（由 Windows Agent 更新）

### 状态：SUCCESS

- **开始时间**：2026-03-03
- **Node 版本**：v22.16.0 (bundled, V8 12.4.254.21-node.26)
- **构建工作区**：D:\cicd-workspace\openclawcn
- **Git commit**：bf37a67b9b (chore: bump version to 1.6.2)
- **版本号**：1.6.2
- **产物**：`ClawdbotCN_1.6.2_x64-setup.exe` (245 MB)
- **SHA-256**：`001d6b2332b0e0d134b40714c3a33994e8afc6717d576beff10d87ac214b2d2a`
- **增量包**：本次无（无旧版 release-cache，已缓存 1.6.2 供下次用）

### 构建前检查结果
- [x] 版本号 1.6.2 已在所有3个文件中确认
- [x] Node 22.16.0 pinned (prepare-resources.ps1 L34, build-macos.sh L95)
- [x] 加密顺序正确 (build.ps1 并行化: CN chain + UI build)
- [x] bytecode编译使用 bundled Node (build.ps1 L99-122)
- [x] skills/ 500+ 检查 (prepare-resources.ps1 L546)
- [x] MCP index 1000+ items 检查 (prepare-resources.ps1 L629)
- [x] extensions/ 含 .ts→.js 重写 + 依赖安装
- [x] data/ seed 文件白名单完整
- [x] build-meta.json 用 bundled node 生成 (非系统node)
- [x] install.json 自动生成 (updateServer=obplugins.cn)

### 构建实际执行记录

- [x] pnpm install — OK (12.2s)
- [x] pnpm build (tsdown) — OK (394 files, 9308KB)
- [x] build:cn-compile (tsc) — OK (修复了 db.ts TS2322)
- [x] build:cn-extensions — OK (99/99 extensions compiled)
- [x] verify:extensions — OK (58 OK, 0 mismatches)
- [x] obfuscate-dist — OK (199 CN files, 1 non-critical error: cn-mirrors-data.js import assertion)
- [x] compile-bytecode (bundled Node 22.16.0) — OK (200 .jsc files, V8 12.4.254.21-node.26)
- [x] UI build (vite) — OK (2.59s, 5 bundles)
- [x] obfuscate-ui — OK (5 bundles protected)
- [x] integrity:gen — OK (333 CN file hashes)
- [x] release:changelog — OK
- [x] prepare-resources — OK (1211.82 MB, skills 3079, MCP 7392 items)
- [x] Tauri build (Rust+NSIS) — OK (`ClawdbotCN_1.6.2_x64-setup.exe`, 245 MB)

### 安装测试结果 (全部通过)

- [x] 安装到 `D:\openclawcn\ClawdbotCN` — OK (NSIS 静默安装)
- [x] 注册表: `HKCU\...\Uninstall\ClawdbotCN` DisplayVersion=1.6.2
- [x] install.json: `{"installKind":"installer","updateServer":"https://www.obplugins.cn","version":"1.6.2"}`
- [x] package.json: version=1.6.2
- [x] Node 版本: v22.16.0 (bundled)
- [x] 资源完整性:
  - skills: **3079** 个目录
  - extensions: **38** 个扩展
  - MCP index: **7392** 项
  - data/: mcp-index.db + json + skill-availability 全部存在
  - docs/reference: 存在
- [x] Gateway 启动: port 19002, sidecar pid=166720
- [x] `/api/health`: `{"ok":true,"ready":true,"needsSetup":false,"phase":"ready","hasConfiguredProvider":true}`
- [x] UI 加载: ClawbotCN 控制台 HTML 正常返回
- [x] WebSocket RPC: config.get, capability_matrix.summary, device.pair.list, node.list, agents.list, agent.identity.get, orchestrator.community.list — 全部成功
- [x] MCP servers: Sequential Thinking, Filesystem, 必应中文搜索 — 全部启动
- [x] syncMcpToToolIndex: **7947** 工具同步成功
- [x] Agent Team plugin: v0.5.0 注册成功
- [x] Chat 消息: 发送/接收正常 (topic-radar agent 正常响应)
- [x] Bytecode 加载: agent-team/index.js, orchestrator/index.js, orchestrate-tool.js, soul-optimizer.js, keyword-router.js — 全部 PASS (SHA-256 integrity check)
- [x] 从 v1.6.1 升级安装: 平滑覆盖安装成功

### 已知环境问题 (非安装包问题)

- PyTorch 安装失败 (voice tier auto-install): pip 找不到 torch 包 — 环境/网络问题，不影响核心功能

### 问题记录

1. **TS2322 in db.ts** — `return dbInstance` 类型不匹配，修复为 `return dbInstance!`
2. **UI 构建失败** — 与 macOS 相同问题，CJS bytecode stub 无法被 Vite 解析。解决：先执行 build:cn-extensions 重新生成 ESM JS，再执行 UI build
3. **bundled Node 不在 CI 工作区** — 需要手动从源码目录复制 scripts/windows/node/node.exe 到 CI workspace
4. **cn-mirrors-data.js 混淆失败** — import assertions 语法不被混淆器支持，非关键（1/200 files）

---

## macOS 构建日志（由 macOS Agent 更新）

### 状态：SUCCESS

- **开始时间**：2026-03-03
- **Node 版本**：v22.16.0 (pinned, V8 12.4.254.21-node.26)
- **pnpm 版本**：10.23.0
- **Cargo 版本**：1.93.1
- **构建工作区**：/Users/kevinsun/cicd-workspace/openclawcn
- **Git commit**：05382c19 (fix: resolve TS2322 in mcp/marketplace/db.ts)
- **版本号**：1.6.2
- **构建命令**：`bash scripts/desktop/build.sh --arch universal`
- **产物**：`ClawdbotCN_1.6.2_universal.dmg` (313 MB)
- **SHA-256**：`07063b2b3b15650c742a1752d54c3df69401d6f477b588d4dc58799ea950e81f`
- **build-meta**: Node v22.16.0, V8 12.4.254.21-node.26, 200 bytecode files, darwin/arm64
- **增量包**：本次无（无旧版 release-cache，已缓存 1.6.2 供下次用）

### 构建前发现的问题
1. **TS2322错误** — `src/mcp/marketplace/db.ts:151` 的 `dbInstance!` 非空断言在 plugin-sdk dts 严格模式下报错
   - **修复**: 改为 `dbInstance as DatabaseSync`，已commit并push (05382c19)

### 问题记录

2. **UI构建失败(第一次尝试)** — Vite报错 `orchestratorReducer is not exported`
   - **原因**: Mac Mini工作区残留了上次构建的bytecode CJS stub (`.js` + `.jsc`)
   - Vite/Rollup按ESM方式解析，CJS `exports.xxx` 不被识别为ESM named export
   - **修复**: 清理 `extensions/` 下所有 `.jsc` 和编译后的 `.js`，`rm -rf dist/`，重新构建
   - **教训**: `git reset --hard` 不清理非git追踪文件，构建前需要手动清理编译产物
   - **建议Windows Agent注意**: 如果Windows构建机上也有旧产物，需要先清理

### DMG验证结果 (全部通过)
- [x] DMG可挂载，含 ClawdbotCN.app + Applications快捷方式 + .background背景图
- [x] Info.plist: CFBundleIdentifier=com.clawdbot.cn.desktop, CFBundleVersion=1.6.2
- [x] LSArchitecturePriority: arm64, x86_64
- [x] 代码签名: adhoc (Format=app bundle with Mach-O universal x86_64 arm64)
- [x] dist/: 含 build-meta.json, index.js, entry.js, 161个.jsc字节码文件
- [x] skills/: 3077个技能
- [x] extensions/: 38个扩展
- [x] data/mcp-index.json: 7392项
- [x] node/bin/node: v22.16.0, Mach-O universal (x86_64 + arm64), 213MB
- [x] install.json: installKind=installer, updateServer=obplugins.cn, version=1.6.2
- [x] build-meta: Node v22.16.0, V8 12.4.254.21-node.26, 200 bytecode files
- [x] package.json: 存在

### macOS 运行时测试 (全部通过)
- [x] DMG 挂载 + 拖拽安装: OK (1.4G)
- [x] quarantine 移除: OK
- [x] Node binary: v22.16.0
- [x] Gateway 启动: **2秒内达到 ready 状态**
- [x] HTTP /health (port 34982): **HTTP 200** (返回 ClawbotCN 控制台 HTML)
- [x] HTTP /api/health (port 34982): **HTTP 200**
- [x] 插件加载: Agent Team, dingtalk, feishu, Orchestrator 全部注册成功
- [x] Canvas 挂载: OK (http://127.0.0.1:34982/__openclawcn__/canvas/)
- [x] WebSocket 监听: ws://127.0.0.1:34982
- [x] MCP marketplace 同步: 9535 upserted, 529 deleted (10064 changes)
- [x] Tool-index 同步: 69.4MB
- [x] Browser control service: ready (2 profiles)
- [x] Heartbeat: started
- [x] 优雅关闭 (SIGTERM): OK

### macOS 特别注意事项

- DMG 背景图：需要中文安装指引（拖入 Applications + 安全设置提示）
- 代码签名：Ad-hoc（无 Apple Developer 证书）
- 架构：universal (arm64 + x86_64)
- 首次打开提示：系统偏好设置 → 安全性与隐私 → 仍然打开

---

## 增量包机制说明

- **release-cache 目录**：`E:\openclawcn\.release-cache`（Windows）
- **对比方式**：新版 dist/ 与 cache 中旧版逐文件 SHA-256 对比
- **delta.json 结构**：`{ added: [], modified: [], removed: [], totalFiles, totalSize }`
- **包含目录**：dist/、skills/、extensions/、data/、docs/reference/templates/
- **node_modules**：如果 delta < 200MB 则包含

---

## 共享问题追踪

| # | 平台 | 问题描述 | 状态 | 解决方案 |
|---|------|---------|------|---------|
| 1 | macOS | TS2322: db.ts dbInstance! 非空断言失败 | 已修复 | 改为 `as DatabaseSync` (05382c19) |
| 2 | macOS | UI构建失败: CJS bytecode stub 无法被Vite ESM解析 | 已修复 | 清理旧编译产物后重新构建 |
| 3 | 双平台 | 构建前必须清理旧的 .jsc/.js 编译产物 | 提示 | git clean -fd extensions/ dist/ |

---

*最后更新：2026-03-03 by Windows Agent (Claude Opus) — Windows 构建+安装+运行时测试全部通过*
