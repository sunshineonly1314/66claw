# GitHub Actions Workflows

本目录包含所有 CI/CD 自动化流程配置。

---

## 🚀 快速开始

### 方式 1: Commit 触发自动构建

在 commit message 中添加 `[build]` 标记：

```bash
git commit -m "feat: 新功能 [build]"
git push
```

### 方式 2: Tag 触发正式发布

推送版本标签自动创建 Release：

```bash
git tag v2026.2.18
git push origin v2026.2.18
```

### 方式 3: 手动触发

进入 GitHub Actions 页面，选择 workflow 并点击 "Run workflow"。

---

## 📋 Workflows 列表

### 核心构建流程

| Workflow | 触发方式 | 用途 |
|----------|----------|------|
| **release-build.yml** | Tag / 手动 | 正式发布，全平台构建 + GitHub Release |
| **quick-build.yml** | `[build]` / 手动 | 快速测试构建（单平台） |

### 平台专用

| Workflow | 触发方式 | 用途 |
|----------|----------|------|
| **build-macos.yml** | 手动 | macOS ZIP 包构建 |
| **build-macos-cn.yml** | 手动 | macOS DMG 包构建 |

### 测试和检查

| Workflow | 触发方式 | 用途 |
|----------|----------|------|
| **ci.yml** | Push / PR | 代码检查、单元测试、lint |
| **docker-e2e-test.yml** | 手动 | Docker E2E 测试 |
| **docker-build-test.yml** | Push / 手动 | Docker 镜像构建测试 |

---

## 🎯 常见场景

### 场景 1: 日常开发测试

```bash
# Commit 时添加 [build] 标记
git commit -m "fix: 修复问题 [build]"
git push
```

### 场景 2: 发布新版本

```bash
# 使用 npm version
npm version 2026.2.18
git push --follow-tags
```

### 场景 3: 单平台快速构建

```bash
# 指定平台
git commit -m "fix(windows): 修复启动 [build] windows"
git push
```

---

## 📚 详细文档

完整指南请查看: [docs/cicd-guide.md](../../docs/cicd-guide.md)

---

**最后更新:** 2026-02-18
