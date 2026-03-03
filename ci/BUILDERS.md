# CI/CD 构建机器信息

## SSH 免密登录

本机 SSH 公钥（已部署到两台构建机器）：
```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDC+OZaZicEQDQVKGGY6XVvagneMtBFM8ZKSKFr6t7KCL6ek9jQIH9LUFarpztLDfLUgSbJPxVq0Jd9Q7JXcYuO32CYTgMMJ1rCTume0eu9N7tDAq6tW6g6rXsNaLnX7O3UU+cclmk8PkaeogS0WP8ELqWWR4icFC1+gHWzIBZgMr91xlntfi+iZXg9sekdKnwrjLtG+CGr1od4WOVnDzayKBsmSvrGltdZ1aKDY6FB/QkL9TEWiApLONqbcrOpuHtALxjPySPoPBOEbsmM86xAIgKHH4QgjSGsfmRJiBI/EtrYsgXnrAUSxFblEP//ibvGyTa8XT5hi8/q8l91LLpoFKYm2YOq21XWQwfnO5hvnqySLJbijiTMkxV2H8gl2Xfjw4quB40WMmkGNtnjcbZRva2jlhIwZ8C1oReiRdn9G4gJ2qV0Mlc8ZxnR41VSNEEDM3y0FrnckUroShaYCo/3JS4F3snDlDFrVCc6bWqg5cP8LQt+41SDlzdD2ZU3pU1nAT6AesgT7/rkIW7PVscoJRky3ZG4NAYGCyMdFPHCAGMSLwdZD9Mz64AtNZqyvU3MTV3XNdfmYf4yhVCuQNQ1jqnJYnP1qlrbi9qc3fWDhsPbzvglQMm+4PTpxQ0sao/stf3Qi7yRnTKK3gYCyFYhARO5iHENUEhUULy0Hyxriw== 72793@kevinUp
```

SSH 连接方式：
- macOS: `ssh kevinsun@192.168.0.107`
- Windows: `ssh SunBin@KEVINSUN`（或 `ssh SunBin@192.168.0.102`，默认 shell 是 cmd.exe，不是 bash）

---

## macOS 构建机器

| 项目 | 信息 |
|------|------|
| **主机名/IP** | 192.168.0.107 |
| **SSH 用户** | kevinsun |
| **SSH 端口** | 22 |
| **操作系统** | macOS 26.2 (Build 25C56) |
| **内核** | Darwin 25.2.0 (xnu-12377.61.12~1/RELEASE_ARM64_T8132) |
| **CPU** | Apple M4 |
| **架构** | arm64 |
| **磁盘** | 228GB 总计, 154GB 可用 (9% 已用) |
| **Node.js** | v22.16.0 (路径: `/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin/node`) |
| **pnpm** | v10.30.0 (路径: `/usr/local/bin/pnpm`) |
| **Rust/Cargo** | 1.93.1 |
| **Git** | v2.50.1 (Apple Git-155) |
| **工作目录** | `~/cicd-workspace/openclawcn` |
| **构建脚本 (Tauri)** | `scripts/desktop/build.sh` |
| **构建脚本 (Node.js)** | `build/scripts/build-macos-cn.sh` |
| **构建产物** | `build/output/ClawdbotCN_*.dmg` |

### macOS PATH 配置
Node.js 和 pnpm 不在默认 PATH 中，SSH 执行构建脚本需要手动设置：
```bash
export PATH="/usr/local/lib/nodejs/node-v22.16.0-darwin-arm64/bin:/usr/local/bin:/opt/homebrew/bin:$HOME/.cargo/bin:$PATH"
source "$HOME/.cargo/env" 2>/dev/null || true
```

### macOS 构建脚本

| 脚本 | 用途 |
|------|------|
| `ci/clean-rebuild-macos.sh` | **推荐**：全量清理 + 重新构建（适合版本发布） |
| `ci/resume-build-macos.sh` | 快速重试：保留 node_modules，清理 dist/ + resources/ + extensions/，重新构建 |
| `scripts/desktop/build.sh` | 核心构建链（被上面两个脚本调用） |
| `scripts/desktop/prepare-resources.sh` | 资源打包（Node + dist + extensions + skills + data → resources/） |
| `ci/build-macos.sh` | SSH 远程触发脚本（从 Windows 发起） |

### ⚠️ 重要：打包前必读 [`ci/PACKAGING-LESSONS.md`](PACKAGING-LESSONS.md)

---

## v1.6.0 macOS 打包问题汇总（2026-03-01）

> 以下是 v1.6.0 macOS 全量重新打包过程中遇到的所有问题及修复方案。

### 问题 1：Extension 依赖安装失败 — git+ssh 传递依赖（扩展坑 3）

**症状**：
```
npm error command git --no-replace-objects ls-remote ssh://git@github.com/whiskeysockets/libsignal-node.git
致命错误：无法读取当前工作目录: No such file or directory
```

**原因**：`prepare-resources.sh` 安装 extension 依赖时，以下包有 git+ssh 传递依赖：
- `@whiskeysockets/baileys`（已知）
- `@vector-im/matrix-bot-sdk`（**新发现**）
- `@matrix-org/matrix-sdk-crypto-nodejs`（**新发现**）

Mac Mini 没有 GitHub SSH key，git+ssh 协议无法访问。

**修复**：在 `scripts/desktop/prepare-resources.sh` 中：
1. 添加 `ssh://git@github.com/` 到 git insteadOf 规则（之前只有 `git+ssh://`）
2. 过滤掉上述三个包，不参与 extension 依赖安装

### 问题 2：UI 构建失败 — 字节码替换破坏 ESM 导入（关键！）

**症状**：
```
"orchestratorReducer" is not exported by "../extensions/orchestrator/src/ui/orchestrator-state.js"
```

**原因**：`compile-bytecode.ts` 将 extension 的 `.js` 文件替换为 CJS bytecode loader stub：
```javascript
// CJS stub — Vite 无法解析为 ESM
const bytenode = require("bytenode");
const _mod = require("./file.jsc");
exports.orchestratorReducer = _mod.orchestratorReducer;
```
当 UI build（Vite/Rollup）和 CN 加密链并行运行时，如果 CN 链先完成字节码编译，Vite 就会遇到 CJS stub 而失败。

**修复**：修改 `scripts/desktop/build.sh`，将 UI 构建和 CN 加密链从**并行**改为**串行**：
```
[2a] tsdown 基础构建
[2b] UI 构建（必须先完成）  ← 先
[2c] CN 加密链              ← 后
[3]  UI 混淆
```

**关键约束**：UI build 必须在 `compile-bytecode.ts` 运行之前完成。

### 问题 3：resources 目录删除失败 — npm 只读文件

**症状**：
```
rm: apps/desktop/src-tauri/resources/node_modules/nostr-tools/lib: Directory not empty
```
脚本在 `set -euo pipefail` 下立即退出。

**原因**：npm install 在 resources/ 目录下创建了只读文件，`rm -rf` 无法删除。

**修复**：先修改权限再删除：
```bash
chmod -R u+w apps/desktop/src-tauri/resources/ 2>/dev/null || true
rm -rf apps/desktop/src-tauri/resources/ 2>/dev/null || true
```

### 问题 4：Extension .js 文件未恢复（构建间残留）

**症状**：第二次构建时 extension .js 文件仍然是上次 bytecode 编译生成的 CJS stub。

**原因**：`resume-build-macos.sh` 没有恢复 extensions/ 目录到 git 干净状态。

**修复**：在清理步骤中添加：
```bash
git checkout -- extensions/ 2>/dev/null || true
```

### 问题 5：Windows heredoc 变量展开

**症状**：通过 Windows bash 创建远程脚本时，heredoc 中的 `$ARCH`、`$WORKSPACE` 等变量被 Windows 端展开。

**修复**：直接写文件而非使用 heredoc，或使用 `<<'EOF'`（加单引号）防止变量展开。

### 最终构建结果

| 项目 | 值 |
|------|------|
| DMG | ClawdbotCN_1.6.0_universal.dmg |
| 大小 | 369 MB |
| SHA256 | `8ad384374639777647c3bd1db7a741c2455ee6e78fff8e7f7d6dc2fbfcb7dd3b` |
| .jsc 字节码 | 158 个文件（dispatch:30, license:12, security:24, memory:32） |
| CN Extensions | 6 个全部编译（openclawwechat, agent-team, orchestrator, memory-core, dingtalk, feishu） |
| UI | OK |

---

## Windows 构建机器

| 项目 | 信息 |
|------|------|
| **主机名/IP** | 192.168.0.102 (KEVINSUN)，推荐用主机名 KEVINSUN 连接（DHCP IP 可能变化） |
| **SSH 用户** | SunBin |
| **SSH 端口** | 22 |
| **SSH Shell** | cmd.exe（不是 bash！） |
| **操作系统** | Microsoft Windows 11 家庭中文版 |
| **OS 版本** | 10.0.26100 Build 26100 |
| **型号** | ASUS Zenbook 14 UX3405CA |
| **CPU** | Intel Core Ultra (Family 6 Model 197) ~2900 MHz |
| **架构** | x64-based PC |
| **总内存** | 32,125 MB (~32GB) |
| **可用内存** | ~17GB |
| **Node.js** | v22.18.0 (路径: `D:\Program Files\node-v22.18.0-win-x64\node.exe`) |
| **npm** | v10.9.3 |
| **pnpm** | 未安装 |
| **Git** | v2.50.1.windows.1 (路径: `C:\Program Files\Git\cmd\git.exe`) |
| **Bash** | `C:\Users\SunBin\AppData\Local\Microsoft\WindowsApps\bash.exe` (WSL) |
| **PowerShell** | `C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe` |
| **工作目录** | `D:\cicd-workspace\openclawcn` |
| **构建脚本** | `build\scripts\windows\build-windows.ps1` |
| **构建产物** | `E:\clawdbuild\ClawdbotCN-Setup-*.exe` |

### Windows 注意事项
1. SSH 默认 shell 是 **cmd.exe**，不能用 `bash -s` 发送命令
2. 需要用 PowerShell 或 cmd 语法执行远程构建
3. **pnpm 未安装**，需要先安装或使用 npm 代替
4. Node.js 安装在 D 盘非标准路径

---

## Gitee 仓库

| 项目 | 信息 |
|------|------|
| **仓库地址** | https://gitee.com/sunshine1314/openclawcn |
| **SSH 地址** | git@gitee.com:sunshine1314/openclawcn.git |
| **HTTPS (带认证)** | `https://sunshine1314:<token>@gitee.com/sunshine1314/openclawcn.git` |
| **分支** | master |

---

## 构建命令

### macOS 构建
```bash
bash ci/build-macos.sh [version] [arch]
# 例: bash ci/build-macos.sh "" universal
```

### Windows 构建
```bash
bash ci/build-windows.sh [version] [mode]
# 例: bash ci/build-windows.sh "" standard
```

### 注意: ci/config.json 中包含 Gitee access token，不要提交到公开仓库
