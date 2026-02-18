# CI/CD 自动化打包指南

本文档介绍 ClawdbotCN 项目的完整 CI/CD 自动化打包流程。

---

## 📋 目录

- [工作流概览](#工作流概览)
- [自动触发规则](#自动触发规则)
- [手动触发方式](#手动触发方式)
- [使用场景](#使用场景)
- [最佳实践](#最佳实践)

---

## 🎯 工作流概览

项目包含以下 GitHub Actions workflows：

| Workflow | 文件 | 用途 | 触发方式 |
|----------|------|------|----------|
| **Release Build** | `release-build.yml` | 正式版本发布 | Tag push / 手动 |
| **Quick Build** | `quick-build.yml` | 快速测试构建 | Commit [build] / 手动 |
| **CI** | `ci.yml` | 代码检查和测试 | Push / PR |
| **Build macOS** | `build-macos.yml` | macOS 专用构建 | 手动 |
| **Build macOS CN** | `build-macos-cn.yml` | macOS CN DMG | 手动 |

---

## 🚀 自动触发规则

### 1️⃣ **正式发布自动构建**

当你推送一个版本标签时，会自动触发全平台构建并创建 GitHub Release：

```bash
# 方式 1: 创建版本标签
git tag v2026.2.18
git push origin v2026.2.18

# 方式 2: 创建 release 标签
git tag release-2026.2.18
git push origin release-2026.2.18
```

**触发后会自动:**
- ✅ 构建 Windows (standard + full 模式)
- ✅ 构建 macOS (universal 二进制)
- ✅ 构建 Linux (x64/arm64, DEB/RPM)
- ✅ 运行冒烟测试
- ✅ 创建 GitHub Release
- ✅ 上传所有安装包

---

### 2️⃣ **快速测试构建（Commit 触发）**

在 commit message 中包含 `[build]` 标记即可触发快速构建：

```bash
# 自动构建 Windows (默认)
git commit -m "feat: 新增功能 [build]"

# 明确指定平台
git commit -m "fix: 修复 macOS 问题 [build] macos"
git commit -m "chore: 更新依赖 [build] linux"
git commit -m "refactor: 重构代码 [ci]"  # [ci] 也会触发

git push
```

**特点:**
- ⚡ 使用快速压缩，构建时间减少 50%
- 📦 只构建指定平台（从 commit message 推断）
- 🗂️ Artifacts 保留 7 天
- ❌ 不创建 GitHub Release

---

## 🖱️ 手动触发方式

### GitHub 网页操作

1. 进入项目 GitHub 页面
2. 点击 **Actions** 标签
3. 选择对应的 Workflow
4. 点击 **Run workflow** 按钮
5. 填写参数并启动

---

### Release Build（正式发布）

**适用场景:** 发布新版本，需要全平台安装包

**路径:** Actions → Release Build & Deploy → Run workflow

**参数说明:**

| 参数 | 说明 | 默认值 | 示例 |
|------|------|--------|------|
| `version` | 版本号 | 从 package.json | `2026.2.18` |
| `platforms` | 打包平台 | `all` | `windows` / `macos` / `linux` |
| `windows_mode` | Windows 模式 | `standard` | `full` (含 3000+ skills) |
| `macos_arch` | macOS 架构 | `universal` | `arm64` / `x64` |
| `create_release` | 创建 Release | `true` | `false` (仅构建不发布) |
| `run_tests` | 运行测试 | `true` | `false` (跳过测试) |

**示例配置:**

```yaml
# 场景 1: 发布正式版本 (所有平台)
version: 2026.2.18
platforms: all
windows_mode: standard
macos_arch: universal
create_release: true
run_tests: true

# 场景 2: 只构建 Windows 完整版（测试用）
version: 2026.2.18-beta
platforms: windows
windows_mode: full
create_release: false
run_tests: false

# 场景 3: macOS 单架构快速构建
version: 2026.2.18
platforms: macos
macos_arch: arm64
create_release: false
```

---

### Quick Build（快速测试）

**适用场景:** 开发测试，快速验证构建

**路径:** Actions → Quick Build (Dev/Test) → Run workflow

**参数说明:**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `platform` | 构建平台 | `windows` |
| `fast_mode` | 快速模式 | `true` |

**特点:**
- ⚡ 构建时间减少 50%
- 📦 单平台构建
- 🗂️ Artifacts 保留 7 天
- ✅ 适合日常开发测试

---

## 📝 使用场景

### 场景 1: 日常开发测试

**需求:** 快速验证代码改动，不需要发布

**方法:**
```bash
# Commit message 触发
git commit -m "feat: 添加新功能 [build]"
git push

# 或手动触发 Quick Build
# 在 GitHub Actions 页面选择平台并运行
```

**结果:**
- ⚡ 15-30 分钟完成构建
- 📦 下载 Artifacts 测试
- 🗂️ 7 天后自动删除

---

### 场景 2: 测试版发布（不创建 Release）

**需求:** 构建完整安装包供内测，但不发布到 GitHub Releases

**方法:**
```bash
# 手动触发 Release Build
# 参数设置:
#   platforms: all
#   create_release: false
#   run_tests: true
```

**结果:**
- ✅ 全平台完整构建
- 📦 Artifacts 保留 30 天
- ❌ 不创建公开 Release

---

### 场景 3: 正式版本发布

**需求:** 发布新版本，自动创建 GitHub Release

**方法 1: 推送标签（推荐）**
```bash
# 更新版本号
npm version 2026.2.18

# 推送标签
git push origin v2026.2.18
```

**方法 2: 手动触发**
```bash
# GitHub Actions → Release Build
# 参数:
#   version: 2026.2.18
#   platforms: all
#   create_release: true
```

**结果:**
- ✅ 全平台完整构建
- ✅ 运行冒烟测试
- ✅ 创建 GitHub Release
- ✅ 自动上传所有安装包
- 📝 自动生成 Release Notes

---

### 场景 4: 单平台紧急修复

**需求:** 只需要修复某个平台的问题

**方法:**
```bash
# Quick Build 手动触发
# 选择对应平台: windows / macos / linux

# 或在 commit message 中指定
git commit -m "fix: 修复 Windows 崩溃问题 [build] windows"
git push
```

**结果:**
- ⚡ 快速构建单平台
- 📦 立即可用于测试
- ✅ 节省 CI 资源

---

## 💡 最佳实践

### 1️⃣ **Commit Message 规范**

使用清晰的 commit message 以便自动化识别：

```bash
# ✅ 推荐格式
feat: 添加新功能 [build]                    # 触发默认平台构建
fix(windows): 修复启动问题 [build] windows  # 构建 Windows
docs: 更新文档                               # 不触发构建

# ❌ 不推荐
update [build]                               # 不清晰
fix bug                                      # 未使用标记
```

---

### 2️⃣ **版本号管理**

使用语义化版本号（Semantic Versioning）：

```bash
# 主版本.次版本.修订号
v2026.2.18        # 正式版
v2026.2.18-beta.1 # 测试版
v2026.2.18-rc.1   # 候选版本
```

**自动化:**
```bash
# 使用 npm version 自动更新 package.json 并创建 tag
npm version patch  # 2026.2.18 -> 2026.2.19
npm version minor  # 2026.2.18 -> 2026.3.0
npm version major  # 2026.2.18 -> 2027.0.0

# 推送
git push --follow-tags
```

---

### 3️⃣ **构建策略选择**

| 场景 | 推荐 Workflow | 参数配置 |
|------|--------------|---------|
| 日常开发 | Quick Build | `fast_mode: true` |
| 内测版本 | Release Build | `create_release: false` |
| 正式发布 | Release Build (Tag) | 自动触发 |
| 紧急修复 | Quick Build | 单平台 |
| 完整测试 | Release Build | `run_tests: true` |

---

### 4️⃣ **CI 资源优化**

**并发控制:**
- 同一分支只运行一次构建
- 新 push 会取消旧的构建

**缓存策略:**
- Quick Build 使用依赖缓存
- Release Build 每次全新安装（确保干净环境）

**构建时间优化:**
```yaml
Quick Build (fast):      15-30 分钟
Release Build (single):  30-60 分钟
Release Build (all):     45-90 分钟
```

---

### 5️⃣ **Artifacts 管理**

**保留时间:**
- Quick Build: 7 天
- Release Build: 30 天
- GitHub Releases: 永久

**下载方式:**
```bash
# 从 Actions Artifacts 下载
Actions → 选择 Workflow Run → Artifacts → Download

# 从 GitHub Releases 下载（仅正式版）
Releases → 选择版本 → Assets → Download
```

---

## 🔧 故障排查

### 构建失败常见原因

| 问题 | 原因 | 解决方法 |
|------|------|---------|
| 依赖安装失败 | 网络问题 | 重试 workflow |
| 磁盘空间不足 | Windows runner | 使用 `FastCompress` 模式 |
| 签名失败 | 证书配置 | 检查 Secrets 配置 |
| 测试失败 | 代码问题 | 本地修复后重新提交 |

### 手动重试

```bash
# GitHub Actions 页面
1. 进入失败的 Workflow Run
2. 点击 "Re-run all jobs"
3. 或单独重试失败的 job
```

---

## 📊 监控和通知

### Workflow 状态检查

**方式 1: GitHub 页面**
```
Repository → Actions → 查看运行状态
```

**方式 2: 徽章**
```markdown
![Release Build](https://github.com/your-org/clawdbot/actions/workflows/release-build.yml/badge.svg)
```

**方式 3: Email 通知**
- GitHub 会自动发送构建失败通知
- Settings → Notifications → Actions

---

## 🎓 高级用法

### 自定义构建参数

编辑 workflow 文件可自定义更多参数：

```yaml
# .github/workflows/release-build.yml
inputs:
  custom_node_version:
    description: 'Node.js 版本'
    default: '22.14.0'
  skip_cleanup:
    description: '跳过清理'
    default: false
```

### 条件构建

基于文件变更触发特定平台构建：

```yaml
on:
  push:
    paths:
      - 'scripts/windows/**'  # 仅 Windows 相关文件变更时触发
```

### Slack/Discord 通知

集成第三方通知服务：

```yaml
- name: Notify Slack
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 📚 相关文档

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Windows 打包指南](windows-packaging-guide.md)
- [macOS 打包指南](macos-cn-packaging-final.md)
- [Linux 构建指南](linux-build-guide.md)

---

## ✅ 快速参考

### 常用命令速查

```bash
# 触发快速构建
git commit -m "feat: 新功能 [build]"
git push

# 触发正式发布
git tag v2026.2.18
git push origin v2026.2.18

# 只构建 Windows
git commit -m "fix: Windows 修复 [build] windows"
git push

# 跳过构建
git commit -m "docs: 更新文档"
git push
```

### Workflow 选择指南

```
需要完整测试？          → Release Build (run_tests: true)
只需快速验证？          → Quick Build
发布正式版本？          → Tag push (自动 Release Build)
测试特定平台？          → Quick Build (手动选择平台)
内测版本不公开？        → Release Build (create_release: false)
```

---

**最后更新:** 2026-02-18
**维护者:** ClawdbotCN Team
