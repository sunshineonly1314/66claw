# ClawdBot 改造方案汇总

> **更新日期**：2026-01-30  
> **状态**：待实施

---

## 🎯 最终需求文档

**请优先阅读**: [todofinal.md](./todofinal.md) - 经过多专家评审后的最终改造需求

---

## 目录结构

```
docs/todo/
├── README.md                    # 本文件 - 索引与说明
├── todofinal.md                 # 🔴 最终需求文档（优先阅读）
├── clawdfronttodo.md            # 前端页面修改方案
├── windows-security-modes.md    # 安全模式详细文档
├── windows-wsl-packaging.md     # WSL 统一打包方案
├── build-readme.md              # 构建系统说明
├── china-localization.md        # 中国本地化指南
├── guidprd.md                   # 安装向导 PRD 文档
├── setup-wizard-flow.md         # 安装向导流程文档
└── bug.md                       # Bug 记录
```

---

## 文档说明

### 〇、最终需求文档

| 文档 | 内容 | 优先级 | 状态 |
|-----|------|-------|------|
| **todofinal.md** | 🔴 **经过多专家评审的最终改造需求，包含所有确认的优化项** | 🔴 最高 | 待实施 |

### 一、核心改造方案

| 文档 | 内容 | 优先级 | 状态 |
|-----|------|-------|------|
| **clawdfronttodo.md** | 前端页面修改方案（审批弹窗、安全模式选择、信任列表管理） | 🔴 高 | 参考 todofinal.md |
| **windows-security-modes.md** | 三种安全模式的详细说明、用户能力、交互设计 | 🔴 高 | 参考 todofinal.md |
| **windows-wsl-packaging.md** | Windows 统一 WSL 打包方案 | 🔴 高 | 已实施 |

### 二、技术文档

| 文档 | 内容 | 优先级 | 状态 |
|-----|------|-------|------|
| **build-readme.md** | 构建系统使用说明、目录结构、命令参考 | 🟡 中 | 已更新 |
| **china-localization.md** | 国产大模型配置、企业 IM 渠道接入 | 🟡 中 | 已完成 |
| **setup-wizard-flow.md** | 安装向导 6 步骤流程、API 说明 | 🟡 中 | 已完成 |
| **guidprd.md** | 安装向导产品需求文档（UI 设计参考） | 🟢 低 | 参考文档 |

### 三、问题跟踪

| 文档 | 内容 | 优先级 | 状态 |
|-----|------|-------|------|
| **bug.md** | Bug 记录（含 Bug #7 智能模式修复） | 🔴 高 | 持续更新 |

---

## 实施顺序

> 📌 **请参考 [todofinal.md](./todofinal.md) 中的详细实施计划**

### Phase 1（紧急）- P0 需求

1. ✅ **Bug #7 修复** - 智能模式白名单问题（已完成）
2. ✅ **WSL 打包方案** - 统一 Windows 安装程序（已完成）
3. ⏳ **审批超时配置化** - 页面可选 + Gateway 热更新
4. ⏳ **安全模式名称统一** - 统一为 安全模式/智能模式/专家模式
5. ⏳ **新手引导页面** - 展示产品价值和使用示例
6. ⏳ **飞书/钉钉插件** - 验证并加入主干

### Phase 2（重要）- P1 需求

7. ⏳ **删除保护放宽** - workspace-only 模式
8. ⏳ **构建脚本健壮性** - node_modules 前置/后置检查
9. ⏳ **内置 Python 运行时** - 安装包含 Python 便携版
10. ⏳ **错误信息人性化** - 友好错误提示
11. ⏳ **产品价值展示页** - 功能概览

### Phase 3（优化）- P2 需求

12. ⏳ **预置更多 Skills** - 持续添加
13. ⏳ **系统托盘通知** - 审批通知

---

## 关键改动文件

### 已修改

| 文件 | 修改内容 |
|-----|---------|
| `src/gateway/setup-wizard.ts` | 修复 Bug #7，完善 safeBins 配置 |
| `build/installer/scripts/setup-environment.ps1` | 配置国内镜像和默认安全设置 |
| `build/installer/clawdbot-windows-unified.iss` | 统一安装程序 |
| `build/scripts/windows/build-wsl-unified.ps1` | 打包脚本 |
| `build/scripts/windows/build-wsl-image.ps1` | WSL 镜像构建 |

### 待修改

| 文件 | 修改内容 |
|-----|---------|
| `src/gateway/setup-page.ts` | 审批弹窗、安全模式卡片 |
| `src/gateway/components/exec-approval-modal.ts` | 新增：审批弹窗组件 |
| `src/gateway/styles/exec-approval.css` | 新增：审批弹窗样式 |
| `src/gateway/pages/trusted-operations.ts` | 新增：信任列表页面 |

---

## 术语统一

| 代码术语 | 用户界面显示 |
|---------|------------|
| `allowlist` / `whitelist` | 已信任的操作 |
| `safeBins` | 信任列表 |
| `allow-once` | 允许（仅这一次） |
| `allow-always` | 信任（以后都信任） |
| `deny` | 拒绝 |
| `security: deny` | 安全模式 |
| `security: allowlist` | 智能模式 |
| `security: full` / `trust` | 完全模式 |

---

## 相关链接

- 原始 docs 目录：`../`
- 构建系统：`../../build/`
- 源代码：`../../src/`
