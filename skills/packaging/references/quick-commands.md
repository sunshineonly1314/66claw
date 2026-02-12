# 打包命令快速参考

## 完整构建流程（生产交付）

```bash
# 1. 后端编译
pnpm build

# 2. 完整性哈希（必须在 pnpm build 之后）
pnpm integrity:gen

# 3. 前端构建
pnpm ui:build

# 4. 打包（自动安装生产依赖 + 合并扩展依赖 + Inno Setup 编译）
powershell -ExecutionPolicy Bypass -File build\scripts\windows\build-windows.ps1 -SkipBuild -MaxThreads 12
```

## 快捷命令

```powershell
# 全自动（编译+打包一步到位）
.\build\scripts\windows\build-windows.ps1

# 跳过编译（已手动 pnpm build 时）
.\build\scripts\windows\build-windows.ps1 -SkipBuild

# 开发快速构建（zip 压缩，5-10x 更快）
.\build\scripts\windows\build-windows.ps1 -FastCompress

# 强制重装 node_modules（依赖变更时）
# 删除 E:\clawdbuild\test-prod-deps\node_modules 后重新运行打包脚本

# 构建后自动测试安装
.\build\scripts\windows\build-windows.ps1 -TestInstall
```

## 单步操作

```bash
# 只编译后端
pnpm build

# 只生成完整性哈希
pnpm integrity:gen

# 只编译前端
pnpm ui:build
```

## 输出位置

| 模式 | 输出文件 |
|------|----------|
| full | `E:\clawdbuild\ClawdbotCN-Full-Setup-{version}-x64.exe` |
| standard | `E:\clawdbuild\ClawdbotCN-Setup-{version}-x64.exe` |
| dev | `E:\clawdbuild\ClawdbotCN-*-{version}-x64-dev.exe` |

## 关键注意事项 (Windows)

1. **修改 security/license 文件后**：必须 `pnpm integrity:gen`，否则生产崩溃
2. **修改扩展依赖后**：构建脚本自动检测并重新安装，无需手动操作
3. **Inno Setup OOM**：扩展 node_modules 已自动排除，依赖通过合并机制打入主 node_modules
4. **node_modules 不更新**：删除 `E:\clawdbuild\test-prod-deps\node_modules` 强制重装

---

## macOS 构建

### CN 版 (DMG)

```bash
# 全自动 (自动检测镜像 + ad-hoc 签名)
./build/scripts/build-macos-cn.sh

# 国内镜像 + arm64 only
./build/scripts/build-macos-cn.sh --cn --arch arm64

# 跳过编译 (已手动 pnpm build)
./build/scripts/build-macos-cn.sh --skip-build

# Developer ID 签名 + 公证
SIGN_IDENTITY="Developer ID Application: YourCo" \
NOTARYTOOL_PROFILE="clawdbotcn" \
./build/scripts/build-macos-cn.sh
```

### 国际版 (DMG + tar.gz)

```bash
# 全自动 Universal
./build/scripts/build-macos-parallel.sh

# 一键构建 (小白用)
./build/scripts/build-macos-oneclick.sh

# 指定版本 + 国内镜像 + 构建后测试
./build/scripts/build-macos-parallel.sh -v 2026.2.0 --cn --test
```

### macOS 输出位置

| 脚本 | 输出文件 |
|------|----------|
| CN 版 | `build/output/ClawdbotCN-macOS-v{version}-{arch}.dmg` |
| 国际版 | `build/output/macos/Clawdbot-{version}-macos-{arch}.dmg` |
| 国际版 | `build/output/macos/Clawdbot-{version}-macos-{arch}.tar.gz` |

### 关键注意事项 (macOS)

1. **缺包问题**：构建脚本使用 `node-linker=hoisted` 强制平铺 node_modules，避免 pnpm 符号链接断链
2. **扩展依赖**：Job E 自动扫描所有 extensions/*/package.json 安装依赖，Step 5 验证并修复断链
3. **native 模块**：sharp、@lydell/node-pty 需要 darwin 平台预编译二进制，构建脚本自动检测并 rebuild
4. **签名**：无 Developer ID 时使用 ad-hoc 签名，用户需右键→打开绕过 Gatekeeper
5. **Universal Binary**：arm64 + x64 Node.js 通过 lipo 合并，确保两种架构都能运行
