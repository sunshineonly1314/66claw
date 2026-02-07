# Clawdbot macOS 22线程并行打包方案 (完整文档)

> 状态: 已完成设计 + 专家审核
> 日期: 2026-02-07
> 目标: 无签名、并行构建、小白友好的 macOS 打包方案

---

## 一、方案概述

### 1.1 核心目标

| 目标 | 说明 |
|------|------|
| 并行构建 | 22线程并行，最大化利用多核CPU |
| 无签名 | 不需要 Apple Developer 证书 ($99/年)，使用 ad-hoc 签名 |
| 小白友好 | 用户只需3步：解压→安装→启动 |
| Universal | 一个包同时支持 Intel 和 Apple Silicon Mac |

### 1.2 产物清单

```
build/output/macos/
├── Clawdbot-2026.2.7-macos-universal.tar.gz         # 主发行包
├── Clawdbot-2026.2.7-macos-universal.tar.gz.sha256   # 校验和
├── Clawdbot-2026.2.7-macos-universal.dmg              # DMG (如有 .app)
└── Clawdbot-2026.2.7-macos-universal.dmg.sha256       # DMG 校验和
```

### 1.3 包内容结构

**tar.gz 包结构:**
```
Clawdbot-2026.2.7-macos-universal/
├── 第1步-安装.command      ← 双击即可运行! (不是 .sh)
├── 第2步-启动.command      ← 双击启动 Gateway
├── install.sh              ← 兼容旧文档 (内容同上)
├── 启动Clawdbot.command    ← 兼容旧名 (链接到第2步)
├── clawdbot                ← CLI 命令行入口
├── README.txt              ← 超详细使用说明 (含 Gatekeeper 绕过指南)
├── Clawdbot.app/           ← macOS App (如果包含 Swift 构建)
├── node/                   ← 内置 Node.js 22 运行时
│   └── bin/node            ← Universal Binary (arm64+x64)
└── app/                    ← 应用程序文件
    ├── dist/               ← TypeScript 编译产物
    ├── extensions/          ← 扩展插件 (飞书/钉钉/企微等)
    ├── skills/             ← 技能包
    ├── node_modules/       ← 生产依赖
    └── package.json
```

**DMG 包结构 (更简单):**
```
Clawdbot.dmg
└── (挂载后)
    ├── Clawdbot.app/           ← 拖拽到 Applications
    │   └── Contents/
    │       ├── MacOS/Clawdbot  ← Swift 二进制
    │       └── Resources/
    │           ├── node/       ← 内嵌 Node.js
    │           ├── app/        ← 内嵌 CLI
    │           └── clawdbot    ← 内嵌 CLI 入口
    ├── Applications → /Applications  ← 快捷方式
    └── README.txt
```

---

## 二、并行构建架构

### 2.1 8阶段流水线 (含测试)

```
时间轴 ──────────────────────────────────────────────────────────────→

Phase 0 │ 环境检查                                    │ ~2s
        └─────────────────────────────────────────────┘

Phase 1 │ ┌─ TypeScript 编译 + UI 构建 ────────────┐  │
        │ │  (串行: UI 依赖 TSC 输出)              │  │
        │ └────────────────────────────────────────┘  │
        │ ┌─ Node.js arm64 下载 ─────────┐           │ ~120s
        │ └──────────────────────────────┘            │ (并行)
        │ ┌─ Node.js x64 下载 ──────────┐            │
        │ └──────────────────────────────┘            │

Phase 2 │ ┌─ Swift arm64 构建 (-j22) ────────┐       │
        │ └──────────────────────────────────┘        │ ~90s
        │ ┌─ Swift x86_64 构建 (-j22) ──────┐        │ (并行)
        │ └──────────────────────────────────┘        │
        │ ── lipo 合并 Universal Binary ──            │

Phase 3 │ ┌─ Node.js Universal 合并 ─┐               │
        │ └──────────────────────────┘                │
        │ ┌─ CLI + npm install (--maxsockets=22) ──┐  │ ~60s
        │ └───────────────────────────────────────┘   │ (并行)
        │ ┌─ App Bundle 组装 + ad-hoc 签名 ──┐       │
        │ └──────────────────────────────────┘        │

Phase 4 │ 创建启动脚本 + README                      │ ~1s

Phase 5 │ ┌─ tar.gz 打包 ──┐                         │
        │ └────────────────┘                          │ ~20s
        │ ┌─ DMG 创建 ─────┐                         │ (并行)
        │ └────────────────┘                          │
        │ ── SHA256 校验 ──                            │

Phase 6 │ 清理 + 总结                                │ ~2s

Phase 7 │ ┌─ Layer1: 编译验证 (dist/产物检查) ─┐    │
(--test) │ └───────────────────────────────────┘     │
        │ ┌─ Layer2: 打包验证 (解压+完整性) ───┐     │ ~10s
        │ └───────────────────────────────────┘     │ (--test)
        │ ┌─ Layer2.7: DMG 验证 (挂载+检查) ──┐     │
        │ └───────────────────────────────────┘     │

Phase 7+ │ Layer3: 功能运行 (Gateway 启动+HTTP) │     │ ~20s
(--full  │ ┌─ 并行 HTTP: GET / ──────────────┐ │     │ (--full-test)
 -test)  │ ├─ 并行 HTTP: GET /setup ─────────┤ │     │
         │ ├─ 并行 HTTP: GET /api/status ────┤ │     │
         │ └─ 并行 HTTP: 延迟测量 ───────────┘ │     │
         │ 优雅停止测试                          │     │

总计: 约 5-6 分钟 (构建) + 10-30秒 (测试)
```

### 2.2 并行度分析

| 阶段 | 并行任务数 | 并行方式 | 瓶颈 |
|------|-----------|---------|------|
| Phase 1 | 3 | bash 后台进程 | 网络下载 |
| Phase 2 | 2 | bash 后台进程 + swift -j22 | CPU |
| Phase 3 | 3 | bash 后台进程 + npm --maxsockets | CPU + I/O |
| Phase 5 | 2 | bash 后台进程 | I/O |

**实际并行线程使用:**
- TSC 编译: 自动多线程 (Node.js worker)
- Swift 构建: `-j 22` (编译器并行)
- npm install: `--maxsockets=22` (网络并行)
- curl 下载: 2路并行
- find 清理: 8路并行
- 总峰值线程约 22+

---

## 三、无签名方案详解

### 3.1 为什么不需要 Apple Developer 签名？

| 对比项 | 正式签名 | Ad-hoc 签名 (我们的方案) |
|--------|---------|------------------------|
| 费用 | $99/年 | 免费 |
| Gatekeeper | 自动通过 | 需用户手动确认 |
| Notarization | 支持 | 不支持 |
| TCC权限持久化 | 支持 | 每次构建需重新授权 |
| App Store分发 | 可以 | 不可以 |
| 适用场景 | 正式发布 | 内部分发/测试 |

### 3.2 Ad-hoc 签名处理

```bash
# 我们的签名方式 (从内向外，不使用已废弃的 --deep)
/usr/bin/codesign --force --sign - "$app/Contents/Frameworks/*.dylib"
/usr/bin/codesign --force --sign - "$app/Contents/MacOS/Clawdbot"
/usr/bin/codesign --force --sign - "$app"
```

### 3.3 Gatekeeper 绕过方案

用户首次使用时，需要解除 macOS Gatekeeper 限制。我们提供了 `install.sh` 一键处理:

```bash
# install.sh 核心逻辑
xattr -cr "$SCRIPT_DIR"  # 移除隔离属性 (com.apple.quarantine)
chmod +x ...              # 设置执行权限
```

**用户操作 (3步):**
1. 解压 .tar.gz
2. 在终端运行 `bash install.sh`
3. 双击「启动Clawdbot.command」

如果用户不想用终端，也可以:
1. 右键点击 Clawdbot.app → "打开"
2. 在弹出对话框中点击 "打开"

---

## 四、脚本文件清单

### 4.1 构建端 (开发者使用)

| 文件 | 用途 | 说明 |
|------|------|------|
| `build/scripts/build-macos-parallel.sh` | 主构建脚本 | 22线程并行，支持所有参数 |
| `build/scripts/build-macos-oneclick.sh` | 一键构建 | 自动检测最优配置 |

### 4.2 用户端 (打包到产物中)

| 文件 | 用途 | 说明 |
|------|------|------|
| `install.sh` | 首次安装 | 解除 Gatekeeper + 设权限 |
| `启动Clawdbot.command` | 启动服务 | 双击即可运行 Gateway |
| `clawdbot` | CLI 入口 | 命令行工具 |
| `README.txt` | 使用说明 | 中文，简洁明了 |

---

## 五、使用方法

### 5.1 开发者: 一键构建

```bash
# 方式1: 最简单 (自动检测一切)
bash build/scripts/build-macos-oneclick.sh

# 方式2: 指定参数
bash build/scripts/build-macos-parallel.sh --version 2026.2.7 --cn

# 方式3: 只构建 arm64 (Apple Silicon)
bash build/scripts/build-macos-parallel.sh --arch arm64

# 方式4: 跳过 Swift (只构建 CLI 版)
bash build/scripts/build-macos-parallel.sh --skip-swift
```

### 5.2 完整参数列表

```
选项:
  --version, -v VERSION   版本号 (默认: package.json)
  --arch, -a ARCH         架构: universal | arm64 | x64
  --jobs, -j N            并行线程数 (默认: 22)
  --cn, --mirror-cn       国内镜像加速
  --skip-node             跳过 Node.js 下载
  --skip-build            跳过 TypeScript/UI 构建
  --skip-swift            跳过 Swift App 构建
  --keep-intermediate     保留中间产物 (调试用)
  --verbose               详细日志
```

### 5.3 用户: 安装使用 (tar.gz 方式)

```
用户收到: Clawdbot-2026.2.7-macos-universal.tar.gz

步骤1: 双击 .tar.gz 文件 → 自动解压为文件夹
步骤2: 右键「第1步-安装.command」→ 打开 → 确认 (仅首次！)
步骤3: 双击「第2步-启动.command」
步骤4: 浏览器自动打开 http://localhost:18789/setup

注意: 步骤2 的 "右键→打开" 是为了绕过 macOS Gatekeeper。
      如果弹窗只有"好"按钮 → 去系统设置→隐私与安全性→仍要打开
```

### 5.4 用户: 安装使用 (DMG 方式 - 更简单)

```
用户收到: Clawdbot-2026.2.7-macos-universal.dmg

步骤1: 双击 .dmg → 拖拽 Clawdbot.app 到 Applications 文件夹
步骤2: 右键 Clawdbot.app → 打开 → 确认 (仅首次！)
步骤3: 完成！App 自动启动

DMG 方式更简单因为:
  - node + CLI 已嵌入 .app 内部
  - 只需一次 Gatekeeper 确认 (整个 .app 算一个)
  - 不需要额外的 install 步骤
```

### 5.5 关于 Gatekeeper 的重要说明

**没有 Apple Developer 证书 ($99/年) 的情况下，用户首次运行必定会遇到安全弹窗。这是 macOS 的系统行为，无法绕过。**

我们能做的优化:
1. 用 `xattr -cr` 移除 quarantine 标记 → 避免每个文件分别弹窗
2. 文件名引导操作顺序 → 第1步、第2步
3. 启动脚本自愈 → 跳过安装也能自动修复
4. README 详细说明绕过方法 → 包括截图级的文字引导

---

## 六、前置要求

### 6.1 构建环境

| 要求 | 说明 |
|------|------|
| macOS | 12.0 (Monterey) 或更高 |
| Node.js | 22+ (构建用) |
| pnpm | 推荐 (也支持 npm fallback) |
| Xcode CLT | 如需 Swift 构建 (`xcode-select --install`) |
| 磁盘空间 | >= 2GB |
| 网络 | 需要下载 Node.js (~40MB x2) |

### 6.2 用户环境

| 要求 | 说明 |
|------|------|
| macOS | 12.0 或更高 |
| 磁盘空间 | >= 500MB |
| 其他 | **无** (Node.js 已内置) |

---

## 七、专家审核记录

### 7.1 第一轮审核: 代码层面问题 (已修复)

| # | 问题 | 严重度 | 修复方案 |
|---|------|--------|---------|
| 1 | Phase 1: UI 构建与 TSC 编译并行，但 UI 依赖 TSC 输出 | 高 | 改为串行 (TSC → UI)，与 Node.js 下载并行 |
| 2 | Phase 5: tar.gz 用 `mv` 重命名目录，与 DMG 任务竞态 | 严重 | 改为 `cp -R` 到独立暂存目录 |
| 3 | Ad-hoc 签名使用 `--deep` (Apple 已废弃) | 中 | 改为从内向外逐层签名 |
| 4 | 缺少 model catalog / ClawdbotKit / Textual 资源复制 | 中 | 补充资源复制逻辑 |
| 5 | 一键脚本依赖 `bc` (部分 macOS 可能缺少) | 低 | 改用 `awk` 做浮点比较 |
| 6 | npm install 无 lockfile 不可复现 | 低 | 复制 package-lock.json + pnpm-lock.yaml |

### 7.2 第二轮审核: 小白用户 UX 致命问题 (已修复)

以 macOS UX 专家视角，模拟真实小白用户操作，发现以下致命问题:

| # | 问题 | 严重度 | 小白用户影响 | 修复方案 |
|---|------|--------|-------------|---------|
| 7 | `.sh` 文件在 macOS 双击用 TextEdit 打开 | **致命** | 看到代码一脸懵 | 改为 `.command` 后缀 (双击自动用 Terminal 执行) |
| 8 | macOS 14/15 Gatekeeper 弹窗只有"好"按钮 | **致命** | 点完"好"就没了，不知道下一步 | README 写明: 右键→打开 或 系统设置→隐私与安全性→仍要打开 |
| 9 | `node` 二进制单独触发 Gatekeeper | **致命** | 安装完启动又卡住 | `install.command` 在执行任何二进制前先 `xattr -cr` 全目录 |
| 10 | DMG 中的 .app 不含 node/CLI | **严重** | 拖到 Applications 后无法运行 | DMG 构建时将 node+CLI 嵌入 .app/Contents/Resources/ |
| 11 | 文件名不引导操作顺序 | 中 | 不知道先运行哪个 | 改名为「第1步-安装.command」「第2步-启动.command」 |
| 12 | 启动脚本不自愈 | 中 | 跳过安装直接启动会失败 | 启动脚本检测 node 是否可用，不可用时自动执行 `xattr -cr` |

**核心认知: macOS 无签名分发的最大障碍不是技术问题，而是 Gatekeeper 的 UX 问题。每个二进制文件都会单独触发安全弹窗，必须在任何执行之前一次性移除所有文件的 quarantine 隔离标记。**

### 7.3 设计决策

| 决策 | 原因 |
|------|------|
| 使用 Ad-hoc 签名而非不签名 | macOS 拒绝运行完全无签名的 .app |
| 包含 install.sh 而非自动处理 | `xattr -cr` 需要在用户终端执行，DMG 内无法自动运行 |
| 提供 .tar.gz + .dmg 两种格式 | tar.gz 包含完整 CLI；DMG 适合只要 .app 的用户 |
| TypeScript+UI 串行，与下载并行 | UI 构建读取 dist/ 目录，必须在 TSC 之后 |
| Swift 双架构并行 -j22 | 两个 swift build 进程分别使用各自的 build-path，无冲突 |

### 7.3 已知限制

| 限制 | 影响 | 缓解方案 |
|------|------|---------|
| 无 Notarization | 用户首次打开需手动确认 | install.sh + README 说明 |
| 无 Sparkle 自更新 | 需手动下载新版 | 未来可加签名后启用 |
| TCC 权限不持久 | 重新构建后需重新授权辅助功能 | 使用 CLI 模式不受影响 |
| DMG 无背景图 | 不如商业软件美观 | 未来可用 create-dmg 工具美化 |

---

## 八、三层交付测试体系

### 8.1 测试架构

```
┌──────────────────────────────────────────────────────────────┐
│                    交付测试三层验证                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Layer 1: 编译验证 (Build Verification)                       │
│  ├── dist/entry.js 存在                                       │
│  ├── dist/ 关键子目录 (agents, gateway, cli, ...)             │
│  ├── Control UI 构建产物                                      │
│  ├── Node.js 二进制架构验证 (lipo -info)                      │
│  └── Swift Universal Binary 验证                              │
│                                                               │
│  Layer 2: 打包验证 (Package Integrity)                        │
│  ├── tar.gz 解压验证                                          │
│  ├── SHA256 校验和验证                                        │
│  ├── 关键文件存在性 (8项)                                     │
│  ├── 文件权限验证 (.command 可执行)                            │
│  ├── 内嵌 Node.js 运行验证                                   │
│  ├── node_modules 关键依赖                                    │
│  ├── .app Bundle 验证 (Info.plist, 签名, 图标)                │
│  ├── DMG 验证 (挂载, .app内嵌运行时, Applications快捷方式)     │
│  └── 包大小合理性 (20-500MB)                                  │
│                                                               │
│  Layer 3: 功能运行 (Functional Runtime) [--full-test]         │
│  ├── CLI --version 可执行                                     │
│  ├── CLI --help 有输出                                        │
│  ├── Gateway 启动 (独立端口 18799)                            │
│  ├── 并行 HTTP 验证:                                          │
│  │   ├── GET /           → 200/301/302                       │
│  │   ├── GET /setup      → 200/301/302                       │
│  │   ├── GET /api/status → with token                        │
│  │   └── 响应延迟        → < 2s                              │
│  └── 优雅停止测试 (SIGTERM → 10s内退出)                       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 测试用法

```bash
# ===== 集成到构建中 =====

# 构建 + 快速测试 (编译+打包验证，不启动服务)
bash build/scripts/build-macos-parallel.sh --test

# 构建 + 完整测试 (含 Gateway 启动验证)
bash build/scripts/build-macos-parallel.sh --full-test

# ===== 独立运行测试 =====

# 快速测试已有产物
bash build/scripts/test-macos-package.sh

# 完整测试 (含功能运行)
bash build/scripts/test-macos-package.sh --full

# 只测某一层
bash build/scripts/test-macos-package.sh --layer build      # 仅编译验证
bash build/scripts/test-macos-package.sh --layer package     # 仅打包验证
bash build/scripts/test-macos-package.sh --layer runtime     # 仅功能运行

# 指定包路径
bash build/scripts/test-macos-package.sh --package path/to/Clawdbot-*.tar.gz
```

### 8.3 测试并行度设计

| 测试阶段 | 并行方式 | 耗时 |
|----------|---------|------|
| Layer 1 (编译验证) | 顺序检查 (每项 <1ms) | ~1s |
| Layer 2 (打包验证) | tar.gz 解压 + DMG 挂载并行 | ~5s |
| Layer 3 HTTP 测试 | 4路 HTTP 请求并行 | ~2s |
| Layer 3 Gateway 启动 | 等待启动 | ~10-20s |

**关键并行点:**
- tar.gz 解压和 DMG 挂载验证可以并行 (但受 I/O 限制)
- 4个 HTTP 端点测试完全并行 (curl 后台进程)
- 构建中的内联验证 (Phase 1/3) 不增加额外时间

### 8.4 内联验证 (零额外耗时)

构建过程中自动执行的快速检查，不可跳过:

| 位置 | 检查内容 | 失败则 |
|------|---------|--------|
| Phase 1 后 | dist/entry.js 存在 | 中止构建 |
| Phase 3 后 | app/dist/entry.js + node/bin/node + node_modules 存在 | 中止构建 |
| Phase 5 | SHA256 校验和生成 | 警告 |

### 8.5 测试报告示例

```
  ╔════════════════════════════════════════════════════════════════╗
  ║      Clawdbot macOS 打包交付测试 (三层验证)                    ║
  ╚════════════════════════════════════════════════════════════════╝

  ── Layer 1: 编译验证 ──
    ✓ PASS  dist/ 目录存在
    ✓ PASS  dist/entry.js 存在 (CLI 入口)
    ✓ PASS  dist/agents/ 存在
    ✓ PASS  dist/gateway/ 存在
    ...

  ── Layer 2: 打包验证 ──
    ✓ PASS  tar.gz 存在: Clawdbot-2026.2.7-macos-universal.tar.gz (95M)
    ✓ PASS  SHA256 校验通过
    ✓ PASS  文件存在: 第1步-安装.command
    ✓ PASS  文件存在: node/bin/node
    ✓ PASS  Node.js 可运行: v22.11.0
    ✓ PASS  DMG .app 内嵌 Node.js
    ...

  ── Layer 3: 功能运行 ──
    ✓ PASS  Gateway 启动成功 (5秒)
    ✓ PASS  GET / → HTTP 200
    ✓ PASS  GET /setup → HTTP 200
    ✓ PASS  响应延迟: 0.045s (< 2s)
    ✓ PASS  Gateway 优雅退出 (2秒)

  ╔════════════════════════════════════════════════════════════════╗
  ║                    测试报告: ALL PASSED                       ║
  ╚════════════════════════════════════════════════════════════════╝

  ✓ PASS:  28
  ✗ FAIL:  0
  ⚠ WARN:  2
  ○ SKIP:  0
  总计:    30 项  (15秒)
```

---

## 九、CI/CD 集成指南

### 9.1 GitHub Actions 示例

```yaml
name: Build macOS Package

on:
  push:
    tags: ['v*']

jobs:
  build-macos:
    runs-on: macos-14  # Apple Silicon runner
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install pnpm
        run: npm i -g pnpm

      - name: Build + Test macOS Package
        run: |
          bash build/scripts/build-macos-parallel.sh \
            --version ${{ github.ref_name }} \
            --jobs 8 \
            --skip-swift \
            --full-test

      - name: Upload Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: macos-package
          path: build/output/macos/*
```

### 9.2 本地 CI 模拟

```bash
# 完整构建 + 完整测试
bash build/scripts/build-macos-parallel.sh --verbose --full-test

# 快速构建 + 快速测试
bash build/scripts/build-macos-parallel.sh --skip-swift --test

# 只运行测试 (不构建，验证已有产物)
bash build/scripts/test-macos-package.sh --full
```

---

## 十、脚本文件总清单

| 文件 | 类型 | 用途 |
|------|------|------|
| `build/scripts/build-macos-parallel.sh` | 构建 | 22线程并行打包主脚本 |
| `build/scripts/build-macos-oneclick.sh` | 构建 | 一键构建入口 (自动检测配置) |
| `build/scripts/test-macos-package.sh` | 测试 | 三层交付测试 (独立运行/集成) |

---

## 十一、故障排除

### 9.1 构建端问题

| 问题 | 解决方案 |
|------|---------|
| `dist directory not found` | 先运行 `pnpm install && pnpm build` |
| `xcode-select: error` | 运行 `xcode-select --install` |
| `swift build failed` | 检查 Xcode 版本，需要 15.0+ |
| Node.js 下载超时 | 使用 `--cn` 国内镜像 |
| 磁盘空间不足 | 需要至少 2GB 可用空间 |

### 9.2 用户端问题

| 问题 | 解决方案 |
|------|---------|
| "来自未知开发者" | 运行 `bash install.sh` 或右键→打开 |
| "Permission denied" | 运行 `chmod +x 启动Clawdbot.command` |
| "Operation not permitted" | 运行 `xattr -cr .` 解除限制 |
| 端口 18789 被占用 | `lsof -i :18789` 查看占用进程 |
| 启动后无响应 | 等待 30-60秒，或查看终端日志 |

---

## 十、与现有脚本的关系

```
现有脚本 (保持不变):
├── scripts/package-mac-app.sh       ← 原有 Swift App 打包 (含签名)
├── scripts/package-mac-dist.sh      ← 原有发行包 (含 Notarization)
├── scripts/package-mac-offline.sh   ← 原有离线包 (单线程)
├── scripts/codesign-mac-app.sh      ← 原有签名脚本
├── scripts/install-mac.sh           ← 原有在线安装脚本
└── build/macos-packaging-guide.md   ← 原有打包指南

新增脚本 (本方案):
├── build/scripts/build-macos-parallel.sh   ← 22线程并行构建 (无签名)
└── build/scripts/build-macos-oneclick.sh   ← 一键构建入口 (小白用)
```

**关系说明:**
- 新脚本是独立的，不修改任何现有脚本
- 如果有 Swift 源码 (`apps/macos/`)，会构建 .app；否则只构建 CLI 包
- 如果未来获得签名证书，可以在 Phase 3 替换 ad-hoc 签名为正式签名
- 与 `scripts/package-mac-offline.sh` 功能类似但更快 (并行) 且更完整

---

## 十一、未来改进方向

1. **获取签名证书后**: 将 ad-hoc 改为 Developer ID 签名，启用 Notarization
2. **DMG 美化**: 使用 `create-dmg` 添加背景图和图标排列
3. **自动更新**: 签名后启用 Sparkle 自动更新
4. **增量构建**: 缓存 node_modules 和 Swift 中间产物
5. **跨平台 CI**: 在 GitHub Actions 中并行构建 macOS + Windows + Linux
6. **PKG 安装包**: 提供 .pkg 格式，支持双击自动安装到 /Applications

---

## 附录 A: 命令速查

```bash
# 一键构建 (最简单)
bash build/scripts/build-macos-oneclick.sh

# 指定版本
bash build/scripts/build-macos-parallel.sh -v 2026.2.7

# 国内镜像
bash build/scripts/build-macos-parallel.sh --cn

# 只构建 ARM (M系列)
bash build/scripts/build-macos-parallel.sh -a arm64

# 纯 CLI 版 (无 App)
bash build/scripts/build-macos-parallel.sh --skip-swift

# 调试模式
bash build/scripts/build-macos-parallel.sh --verbose --keep-intermediate
```

## 附录 B: 预估打包大小

| 组件 | 大小 (估) |
|------|----------|
| Node.js Universal | ~80MB |
| TypeScript 编译产物 (dist/) | ~15MB |
| 生产依赖 (node_modules/) | ~120MB |
| Extensions | ~5MB |
| Skills | ~2MB |
| Clawdbot.app (如有) | ~30MB |
| **tar.gz 压缩后** | **~90-120MB** |
| **DMG** | **~50MB** (仅含 .app) |
