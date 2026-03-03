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

### 状态：准备中

- **开始时间**：等待触发
- **Node 版本**：v22.16.0
- **构建工作区**：D:\cicd-workspace\openclawcn
- **Git commit**：72cc30c038（bytenode source protection）

### 问题记录

（构建过程中发现的问题记录在这里）

---

## macOS 构建日志（由 macOS Agent 更新）

### 状态：等待另一个 Agent 接手

- **开始时间**：待定
- **Node 版本**：v22.16.0
- **构建工作区**：/Users/kevinsun/cicd-workspace/openclawcn
- **Git commit**：待拉取 72cc30c038

### 问题记录

（构建过程中发现的问题记录在这里）

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
| 1 | - | - | - | - |

---

*最后更新：2026-03-03 by Windows Agent*
