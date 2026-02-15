# PRD-07: 前端 UI 系统 (ui/)

## 1. 模块概述

OpenClawCN 前端采用 LitElement (Web Components) 框架，通过 Vite 构建，提供管理界面、聊天界面、技能市场、配置编辑等功能。

## 2. 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| LitElement (lit) | ^3.3.2 | Web Components 框架 |
| Vite | - | 构建工具 |
| Rolldown | 1.0.0-rc.1 | 打包器 |
| lucide | ^0.563.0 | 图标库 |
| DOMPurify | - | XSS 防护（通过 markdown 模块） |
| markdown-it | ^14.1.0 | Markdown 渲染 |

## 3. 功能需求

### 3.1 主应用 (app.ts, 950行)

**状态管理**:
- 50+ 响应式属性
- Gateway 连接状态
- 标签导航与路由
- 授权管理（OpenClawCN）
- 模型选择
- 安全模式
- 主题管理

**标签页**:
| 标签 | 组件 | 功能 |
|------|------|------|
| overview | overview.ts | 仪表盘、快速操作 |
| chat | chat.ts | 聊天界面 |
| config | config.ts | 配置编辑器 |
| skills | skills.ts | 技能市场 |
| playground | playground.ts | 技能试玩 |
| channels | channels.ts | 渠道管理 |
| logs | logs.ts | 日志查看 |

### 3.2 聊天界面 (app-chat.ts, chat.ts)

**消息管理**:
- 消息发送队列
- 流式消息接收
- 消息分组渲染
- 附件处理（粘贴、拖拽）
- 消息历史（限制 80 条）

**特性**:
- 打字指示器
- 压缩指示器
- 授权错误检测
- Markdown 渲染
- 代码高亮

### 3.3 仪表盘 (overview.ts, 1080行)

**快速操作**:
- 模型选择（带 API Key 验证）
- 安全模式切换
- 使用统计
- 渠道状态

**模型配置**:
- 提供商列表展示
- API Key 输入与验证
- 模型选择下拉
- 费用统计

### 3.4 配置编辑器 (config.ts, 504行)

**编辑模式**:
- 表单模式（Schema 驱动自动生成）
- 原始 JSON 模式
- 差异对比

**配置管理**:
- Schema 获取
- 配置保存与验证
- 冲突检测（基于 hash）

### 3.5 技能市场 (skills.ts, 1139行)

**展示功能**:
- 技能分类与筛选
- 平台兼容性检测
- 安装进度追踪
- 搜索与发现

**安全**:
- Honeypot 字段防自动填充
- 安装审批流程

### 3.6 Playground (playground.ts, 715行)

- 技能分类展示
- 示例运行
- 安装状态追踪
- 快速安装入口

### 3.7 渠道管理 (channels.ts 及子模块)

**渠道配置**:
| 文件 | 渠道 |
|------|------|
| channels.telegram.ts | Telegram |
| channels.discord.ts | Discord |
| channels.slack.ts | Slack |
| channels.signal.ts | Signal |
| channels.whatsapp.ts | WhatsApp |
| channels.dingtalk.ts | 钉钉 |
| channels.feishu.ts | 飞书 |
| channels.wecom.ts | 企业微信 |
| channels.qq.ts | QQ |
| channels.imessage.ts | iMessage |
| channels.nostr.ts | Nostr |
| channels.googlechat.ts | Google Chat |

### 3.8 授权管理 (license/)

- 授权码输入与激活
- 设备管理（绑定/解绑/切换）
- 到期提醒
- 通知展示

### 3.9 Markdown 渲染 (markdown.ts)

**安全渲染**:
- DOMPurify 消毒
- 允许标签白名单
- 链接安全处理（target=_blank, rel=noopener）
- 渲染缓存（避免重复渲染）

### 3.10 国际化 (i18n/)

- 中文/英文双语支持
- 模板变量替换
- 系统语言检测
- 翻译键回退

## 4. 设置管理 (app-settings.ts)

- 主题切换（亮色/暗色/系统）
- URL 参数同步
- localStorage 持久化
- 会话密钥管理

## 5. 数据流

```
用户操作 → LitElement 事件 → Controller → WebSocket RPC → Gateway
                                                    ↓
用户界面 ← LitElement 更新 ← 状态变更 ← WebSocket 推送 ← 处理结果
```

## 6. 非功能性需求

### 6.1 安全
- DOMPurify XSS 防护
- Content Security Policy
- URL 参数清理
- 输入验证

### 6.2 性能
- Markdown 渲染缓存
- 消息条数限制（80条）
- 虚拟滚动（长列表）
- 懒加载

### 6.3 可访问性
- 键盘导航
- ARIA 标签
- 响应式布局
- 主题切换

### 6.4 浏览器兼容性
- 现代浏览器（Chrome 90+, Firefox 90+, Safari 15+）
- Web Components 原生支持
