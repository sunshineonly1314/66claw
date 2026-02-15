# 中国内网小白用户体验优化 TODO

> 来源：OpenClawInstaller 项目调研分析
> 创建日期：2026-02-04
> 状态：待执行

## 背景

针对**中国内网小白用户**场景：
- 网络无法访问国际服务（GitHub、npm registry、Google）
- 技术水平低（不懂 Node.js、不懂命令行）
- 主要需求：连接企业飞书/钉钉/企微

## 优先级定义

| 等级 | 含义 |
|------|------|
| P0 | 必须做，影响基本可用性 |
| P1 | 应该做，显著提升体验 |
| P2 | 可以做，锦上添花 |
| P3 | 暂不做，投入产出比低 |

---

## Phase 1: 快速见效（预计 1 周）

### TODO 1.1: Setup Wizard 中文优化 [P0]

**文件位置：** `src/gateway/setup-wizard.ts`, `src/gateway/setup-page.ts`

**改动点：**
- [ ] 自动检测中国区，默认显示中文界面
- [ ] 国产模型放最前面（顺序：DeepSeek → Kimi → 通义 → 智谱 → SiliconFlow）
- [ ] 企业渠道配置放最前面（顺序：飞书 → 钉钉 → 企微）
- [ ] Telegram/Discord 等国际渠道放到"更多"里

**现有代码参考：**
```typescript
// src/config/region-cn.ts - 已有中国区检测逻辑
import { CN_PROVIDERS, detectChinaRegion } from "../config/region-cn.js";
```

**验收标准：**
- 中国区用户打开 `/setup` 看到中文界面
- 默认推荐 DeepSeek 模型
- 飞书配置入口在第一位

---

### TODO 1.2: 企业渠道中文配置文档 [P0]

**文件位置：** `docs/channels/`

**需要新增/完善的文档：**
- [ ] `docs/channels/feishu.md` - 飞书机器人配置（带截图）
- [ ] `docs/channels/dingtalk.md` - 钉钉机器人配置（带截图）
- [ ] `docs/channels/wecom.md` - 企业微信配置（带截图）

**文档要求：**
- 全中文
- 每一步都有截图
- 标注常见错误及解决方法
- 标注权限申请流程（企业审批等）

**验收标准：**
- 小白用户按文档操作能成功配置

---

## Phase 2: 离线安装包（预计 2 周）

### TODO 2.1: Windows 离线安装包 [P1]

**产出物：**
```
openclawcn-offline-win-x64-2026.x.x.zip
├── node-v22.x.x-win-x64/     # 内置 Node.js
├── node_modules/             # 离线依赖
├── openclawcn/                 # 主程序
├── 一键启动.bat              # 双击运行
├── 使用说明.txt              # 中文说明
└── 常见问题.txt              # FAQ
```

**技术方案：**
- [ ] GitHub Actions 自动构建
- [ ] 使用 `npm pack` 打包离线依赖
- [ ] 内置 Node.js 22 LTS
- [ ] 发布到国内 OSS（阿里云/腾讯云）

**验收标准：**
- 下载 → 解压 → 双击 `一键启动.bat` → Gateway 启动
- 整个过程不需要联网

---

### TODO 2.2: 安装脚本镜像优化 [P1]

**文件位置：** `../openclawcn.com/public/install.sh`（注意：在另一个仓库）

**改动点：**
- [ ] 自动检测中国区（通过 IP 或 DNS）
- [ ] 自动切换 npm 镜像到 `https://registry.npmmirror.com`
- [ ] Node.js 从 `https://npmmirror.com/mirrors/node/` 下载
- [ ] 失败时给出中文错误提示

**验收标准：**
- 在中国网络环境下 `curl ... | bash` 能成功安装

---

## Phase 3: 持续完善

### TODO 3.1: Mac/Linux 离线包 [P2]

**产出物：**
- `openclawcn-offline-macos-arm64-2026.x.x.tar.gz`
- `openclawcn-offline-macos-x64-2026.x.x.tar.gz`
- `openclawcn-offline-linux-x64-2026.x.x.tar.gz`

**备注：** Mac/Linux 用户通常技术水平较高，优先级降低

---

### TODO 3.2: README 文档优化 [P2]

**改动点：**
- [ ] 添加系统要求表格
- [ ] 添加配置目录结构说明
- [ ] 添加 FAQ 常见问题章节
- [ ] 添加安全建议专节

---

### TODO 3.3: Docker 支持恢复 [P3]

**前置调查：**
- [ ] 查明 `build/docker/` 为何被删除
- [ ] 评估是否真的需要

**备注：** 小白用户不会用 Docker，优先级最低

---

## 不做的事项

| 功能 | 原因 |
|------|------|
| Shell 配置菜单 (config-menu.sh) | 维护成本高，Web 向导已足够 |
| Telegram/Discord 优化 | 中国用户用不了 |
| 多语言支持 | 先做好中文，再考虑其他 |

---

## 参考资料

- OpenClawInstaller 项目：https://github.com/miaoxworld/OpenClawInstaller
- 现有中国区支持代码：`src/config/region-cn.ts`
- 现有 Setup Wizard：`src/gateway/setup-wizard.ts`
- 飞书扩展：`extensions/feishu/`
- 钉钉扩展：`extensions/dingtalk/`
- 企微扩展：`extensions/wecom/`

---

## 更新记录

| 日期 | 更新内容 |
|------|---------|
| 2026-02-04 | 初始版本，基于 OpenClawInstaller 调研 |
