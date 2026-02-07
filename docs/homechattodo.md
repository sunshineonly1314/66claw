# ClawbotCN Web UI 优化迭代记录

> 基于 `docs/chattodo.md` 需求文档，针对中国用户进行的全面 UI/UE 优化
> 迭代日期：2026-01-31
> 品牌升级：clawdbot → ClawbotCN
> 技术支持：tecbinai (www.tecbinai.com)

---

## 目录

1. [品牌重塑](#一品牌重塑)
2. [tecbinai 品牌整合](#二tecbinai-品牌整合)
3. [导航中文化](#三导航中文化)
4. [对话页欢迎卡片](#四对话页欢迎卡片)
5. [连接错误提示优化](#五连接错误提示优化)
6. [翻译文件完善](#六翻译文件完善)
7. [安装指南页面优化](#七安装指南页面优化)
8. [样式系统扩展](#八样式系统扩展)
9. [修改文件清单](#九修改文件清单)

---

## 一、品牌重塑

### 1.1 产品名称变更

| 原名称 | 新名称 |
|--------|--------|
| Clawdbot | ClawbotCN |
| CLAWDBOT | ClawbotCN |
| ClawdCN | ClawbotCN |

### 1.2 修改详情

#### `ui/index.html`

```html
<!-- 修改前 -->
<html lang="en">
<title>Clawdbot Control</title>

<!-- 修改后 -->
<html lang="zh-CN">
<title>ClawbotCN 控制台</title>
<meta name="description" content="ClawbotCN - 智能 AI 助手控制台，由 tecbinai 提供技术支持" />
```

#### `ui/src/ui/app-render.ts`

```typescript
// 修改前
<div class="brand-title">CLAWDBOT</div>
<div class="brand-sub">Gateway Dashboard</div>

// 修改后
<div class="brand-title">ClawbotCN</div>
<div class="brand-sub">智能 AI 助手控制台</div>
```

#### `ui/public/install-guide.html`

```html
<!-- 修改前 -->
<title>ClawdCN 安装指南</title>
<h1>ClawdCN 安装指南</h1>

<!-- 修改后 -->
<title>ClawbotCN 安装指南 - 由 tecbinai 提供技术支持</title>
<h1>ClawbotCN 安装指南</h1>
```

---

## 二、tecbinai 品牌整合

### 2.1 品牌露出位置

| 位置 | 展示形式 | 链接 |
|------|----------|------|
| 导航侧边栏页脚 | 渐变卡片按钮 | https://www.tecbinai.com |
| 安装指南页头 | 文字链接 | https://www.tecbinai.com |
| 安装指南页脚 | 大按钮 + 版权信息 | https://www.tecbinai.com |
| 对话欢迎卡片 | 底部标识链接 | https://www.tecbinai.com |
| 连接错误提示 | 帮助链接 | https://www.tecbinai.com |

### 2.2 导航侧边栏页脚

**文件：** `ui/src/ui/app-render.ts`

```typescript
<!-- tecbinai Footer Link -->
<div class="nav-footer">
  <a href="https://www.tecbinai.com" target="_blank" rel="noreferrer" class="nav-footer-link">
    <span class="nav-footer-icon">🚀</span>
    <span class="nav-footer-text">
      <span class="nav-footer-title">tecbinai</span>
      <span class="nav-footer-desc">及时追踪 AI 内容</span>
    </span>
  </a>
</div>
```

### 2.3 安装指南页头

**文件：** `ui/public/install-guide.html`

```html
<header>
  <div class="logo">🤖</div>
  <h1>ClawbotCN 安装指南</h1>
  <p class="subtitle">5 分钟完成配置，开启智能对话之旅</p>
  <p class="powered-by" style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px;">
    由 <a href="https://www.tecbinai.com" target="_blank" style="color: var(--primary);">tecbinai</a> 提供技术支持 · 
    <a href="https://www.tecbinai.com" target="_blank" style="color: var(--text-muted);">及时追踪 AI 最新内容</a>
  </p>
</header>
```

### 2.4 安装指南页脚

```html
<footer style="margin-top: 48px; padding: 32px 0; border-top: 1px solid var(--border); text-align: center;">
  <div style="margin-bottom: 16px;">
    <a href="https://www.tecbinai.com" target="_blank" class="quick-link" 
       style="display: inline-flex; padding: 16px 32px; background: linear-gradient(135deg, var(--primary), #a855f7);">
      <div>
        <div class="quick-link-icon">🚀</div>
        <div class="quick-link-title" style="color: white;">访问 tecbinai</div>
        <div class="quick-link-desc" style="color: rgba(255,255,255,0.8);">及时追踪 AI 最新内容</div>
      </div>
    </a>
  </div>
  <p style="color: var(--text-muted); font-size: 0.85rem;">
    ClawbotCN © 2024-2026 · 由 <a href="https://www.tecbinai.com" style="color: var(--primary);">tecbinai.com</a> 提供技术支持
  </p>
  <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 8px;">
    发现问题？<a href="https://www.tecbinai.com" style="color: var(--primary);">联系我们</a> · 
    <a href="https://www.tecbinai.com" style="color: var(--text-muted);">使用文档</a> · 
    <a href="https://www.tecbinai.com" style="color: var(--text-muted);">常见问题</a>
  </p>
</footer>
```

---

## 三、导航中文化

### 3.1 导航分组标签

**文件：** `ui/src/ui/navigation.ts`

| 原标签 | 翻译后 |
|--------|--------|
| Chat | 对话 |
| Control | 控制台 |
| Agent | 助手 |
| Settings | 设置 |
| Resources | 文档中心 |

### 3.2 实现方式

```typescript
// 使用 getTabGroups() 函数动态获取翻译后的标签组
export function getTabGroups() {
  return [
    { label: t("nav.chat"), tabs: ["chat"] as const },
    {
      label: t("nav.control"),
      tabs: ["overview", "channels", "instances", "sessions", "cron"] as const,
    },
    { label: t("nav.agent"), tabs: ["playground", "skills", "nodes"] as const },
    { label: t("nav.settings"), tabs: ["config", "debug", "logs"] as const },
  ];
}
```

### 3.3 app-render.ts 中的调用变更

```typescript
// 修改前
import { TAB_GROUPS, ... } from "./navigation";
${TAB_GROUPS.map((group) => { ... })}

// 修改后
import { getTabGroups, ... } from "./navigation";
import { t } from "./i18n/index.js";
${getTabGroups().map((group) => { ... })}
```

---

## 四、对话页欢迎卡片

### 4.1 功能说明

当用户首次进入对话页面或当前会话没有消息历史时，显示欢迎卡片：
- 展示产品图标和欢迎语
- 提供5个可点击的示例提示
- 展示3个核心能力说明
- 包含 tecbinai 品牌链接

### 4.2 示例提示列表

| 图标 | 示例文本 |
|------|----------|
| ☀️ | 帮我查询今天北京的天气 |
| 🎨 | 生成一张夕阳下的山水画 |
| ✉️ | 帮我写一封工作邮件 |
| 📊 | 分析这个 CSV 文件的数据 |
| 💻 | 帮我执行一个 Git 命令 |

### 4.3 核心能力展示

| 图标 | 能力 | 描述 |
|------|------|------|
| 💬 | 智能对话 | 回答问题、头脑风暴、写作辅助 |
| 🔧 | 工具调用 | 搜索、代码执行、文件操作 |
| ⚡ | 自动化 | 定时任务、消息推送、工作流 |

### 4.4 实现代码

**文件：** `ui/src/ui/views/chat.ts`

```typescript
// 检查是否有消息
const hasMessages = props.messages.length > 0 || props.stream !== null || props.loading;

// 示例提示
const examplePrompts = [
  { icon: "☀️", text: t("chat.welcome.example1") },
  { icon: "🎨", text: t("chat.welcome.example2") },
  { icon: "✉️", text: t("chat.welcome.example3") },
  { icon: "📊", text: t("chat.welcome.example4") },
  { icon: "💻", text: t("chat.welcome.example5") },
];

// 欢迎卡片 HTML 结构
const welcomeCard = html`
  <div class="chat-welcome">
    <div class="chat-welcome__header">
      <div class="chat-welcome__icon">🤖</div>
      <h2 class="chat-welcome__title">${t("chat.welcome.title")}</h2>
      <p class="chat-welcome__subtitle">${t("chat.welcome.subtitle")}</p>
    </div>
    
    <div class="chat-welcome__section">
      <h3 class="chat-welcome__section-title">${t("chat.welcome.tryAsk")}</h3>
      <div class="chat-welcome__examples">
        ${examplePrompts.map(
          (example) => html`
            <button
              class="chat-welcome__example"
              type="button"
              @click=${() => props.onDraftChange(example.text)}
            >
              <span class="chat-welcome__example-icon">${example.icon}</span>
              <span class="chat-welcome__example-text">${example.text}</span>
            </button>
          `,
        )}
      </div>
    </div>
    
    <!-- 能力展示和 tecbinai 链接 -->
  </div>
`;

// 在 thread 中条件渲染
${!hasMessages && props.connected ? welcomeCard : nothing}
```

---

## 五、连接错误提示优化

### 5.1 友好错误消息映射

**文件：** `ui/src/ui/views/overview.ts`

```typescript
const getFriendlyError = (error: string): string => {
  const lower = error.toLowerCase();
  if (lower.includes("unauthorized") || lower.includes("1008")) {
    return t("connection.error.unauthorized");  // 认证失败，请检查令牌是否正确
  }
  if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("econnrefused")) {
    return t("connection.error.network");  // 网络连接失败，请检查网关是否正常运行
  }
  if (lower.includes("timeout")) {
    return t("connection.error.timeout");  // 连接超时，请检查网络状况
  }
  return t("connection.error.unknown");  // 连接失败，请稍后重试
};
```

### 5.2 一键复制命令功能

```typescript
const copyCommand = (cmd: string) => {
  navigator.clipboard.writeText(cmd).then(() => {
    // 复制成功
  });
};

// 命令复制按钮
<div class="connection-hint__cmd">
  <code>clawdbot dashboard --no-open</code>
  <button 
    class="btn btn--sm" 
    type="button"
    @click=${() => copyCommand("clawdbot dashboard --no-open")}
    title="${t("connection.hint.copyCommand")}"
  >
    ${t("common.copy")}
  </button>
</div>
```

### 5.3 帮助链接

```typescript
<div class="connection-hint__links">
  <a href="https://gitee.com/tecbinai/cnDoc/blob/master/web/dashboard.md" target="_blank" rel="noreferrer">
    📖 ${t("common.docs")}
  </a>
  <span class="connection-hint__divider">·</span>
  <a href="https://www.tecbinai.com" target="_blank" rel="noreferrer">
    🚀 tecbinai
  </a>
</div>
```

---

## 六、翻译文件完善

### 6.1 新增翻译 key 统计

| 分类 | 数量 | 说明 |
|------|------|------|
| 品牌相关 | 11 | brand.*, footer.* |
| 新手引导 | 12 | onboarding.* |
| 对话欢迎 | 15 | chat.welcome.* |
| 连接状态 | 12 | connection.* |
| 技能补充 | 5 | skills.local.emptyHint, skills.time.* |
| 按钮禁用提示 | 4 | button.disabled.* |
| **合计** | **59** | |

### 6.2 品牌翻译 (brand.*)

**文件：** `ui/src/ui/i18n/locales/zh-CN.ts`

```typescript
// 品牌与页脚 (Branding & Footer)
"brand.name": "ClawbotCN",
"brand.tagline": "智能 AI 助手，让工作更轻松",
"brand.poweredBy": "由 tecbinai 提供技术支持",
"brand.tecbinai": "tecbinai",
"brand.tecbinaiUrl": "https://www.tecbinai.com",
"brand.tecbinaiDesc": "及时追踪 AI 最新内容",
"brand.copyright": "ClawbotCN © 2024-2026",
"footer.visitTecbinai": "访问 tecbinai",
"footer.trackAI": "及时追踪 AI 最新内容",
"footer.contactUs": "联系我们",
"footer.docs": "使用文档",
"footer.faq": "常见问题",
```

### 6.3 新手引导翻译 (onboarding.*)

```typescript
// 新手引导 (Onboarding)
"onboarding.welcome": "欢迎使用 ClawbotCN",
"onboarding.subtitle": "您的智能 AI 助手已准备就绪",
"onboarding.step1.title": "连接网关",
"onboarding.step1.desc": "确保网关服务已启动并正常运行",
"onboarding.step2.title": "配置模型",
"onboarding.step2.desc": "选择并配置您喜欢的 AI 模型",
"onboarding.step3.title": "开始对话",
"onboarding.step3.desc": "与 AI 助手开始智能对话",
"onboarding.skip": "跳过引导",
"onboarding.next": "下一步",
"onboarding.prev": "上一步",
"onboarding.finish": "开始使用",
"onboarding.restart": "重新查看引导",
```

### 6.4 对话欢迎翻译 (chat.welcome.*)

```typescript
// 对话欢迎消息 (Chat Welcome)
"chat.welcome.title": "开始与 AI 助手对话",
"chat.welcome.subtitle": "我可以帮助你完成各种任务",
"chat.welcome.tryAsk": "试着问我：",
"chat.welcome.example1": "帮我查询今天北京的天气",
"chat.welcome.example2": "生成一张夕阳下的山水画",
"chat.welcome.example3": "帮我写一封工作邮件",
"chat.welcome.example4": "分析这个 CSV 文件的数据",
"chat.welcome.example5": "帮我执行一个 Git 命令",
"chat.welcome.capabilities": "我的能力",
"chat.welcome.capability.chat": "智能对话 - 回答问题、头脑风暴、写作辅助",
"chat.welcome.capability.tool": "工具调用 - 搜索、代码执行、文件操作",
"chat.welcome.capability.automation": "自动化 - 定时任务、消息推送、工作流",
"chat.placeholder.default": "输入消息，或试试示例问题...",
"chat.placeholder.withSkills": "试试问我天气，或让我帮你操作 GitHub...",
```

### 6.5 连接状态翻译 (connection.*)

```typescript
// 连接状态增强 (Connection Status)
"connection.status.connected": "已连接",
"connection.status.connecting": "连接中...",
"connection.status.disconnected": "未连接",
"connection.status.reconnecting": "重新连接中...",
"connection.error.unauthorized": "认证失败，请检查令牌是否正确",
"connection.error.network": "网络连接失败，请检查网关是否正常运行",
"connection.error.timeout": "连接超时，请检查网络状况",
"connection.error.unknown": "连接失败，请稍后重试",
"connection.hint.getToken": "获取令牌命令：",
"connection.hint.copyCommand": "点击复制命令",
"connection.hint.lastConnected": "上次连接：",
"connection.action.retry": "重试连接",
"connection.action.copyToken": "一键复制令牌命令",
```

### 6.6 其他补充翻译

```typescript
// 技能相关补充
"skills.local.emptyHint": "暂无本地技能。技能可以扩展 AI 助手的能力，如网页搜索、代码执行等。",
"skills.time.justNow": "刚刚",
"skills.time.minutesAgo": "{{count}} 分钟前",
"skills.time.hoursAgo": "{{count}} 小时前",
"skills.time.daysAgo": "{{count}} 天前",

// 按钮禁用提示
"button.disabled.notConnected": "未连接到网关",
"button.disabled.loading": "加载中，请稍候",
"button.disabled.noPermission": "没有权限执行此操作",
"button.disabled.configRequired": "需要先完成配置",
```

### 6.7 产品名称替换

在翻译文件中将所有 `Clawdbot` 替换为 `ClawbotCN`：

```typescript
// 修改前
"nodes.help.description": "节点是连接到 Clawdbot 网关的远程设备...",
"subtitle.playground": "发现技能玩法，探索 Clawdbot 的无限可能",

// 修改后
"nodes.help.description": "节点是连接到 ClawbotCN 网关的远程设备...",
"subtitle.playground": "发现技能玩法，探索 ClawbotCN 的无限可能",
```

---

## 七、安装指南页面优化

### 7.1 品牌元素更新

**文件：** `ui/public/install-guide.html`

| 修改项 | 原内容 | 新内容 |
|--------|--------|--------|
| 页面标题 | ClawdCN 安装指南 | ClawbotCN 安装指南 - 由 tecbinai 提供技术支持 |
| 主标题 | ClawdCN 安装指南 | ClawbotCN 安装指南 |
| 安装包名 | ClawdCN-Windows-Portable.zip | ClawbotCN-Windows-Portable.zip |
| 成功提示 | ClawdCN 已配置完成 | ClawbotCN 已配置完成 |

### 7.2 页头 tecbinai 标识

```html
<p class="powered-by">
  由 <a href="https://www.tecbinai.com">tecbinai</a> 提供技术支持 · 
  <a href="https://www.tecbinai.com">及时追踪 AI 最新内容</a>
</p>
```

### 7.3 页脚版权信息

```html
<footer>
  <!-- 大按钮 -->
  <a href="https://www.tecbinai.com" class="quick-link">
    🚀 访问 tecbinai · 及时追踪 AI 最新内容
  </a>
  
  <!-- 版权信息 -->
  <p>ClawbotCN © 2024-2026 · 由 tecbinai.com 提供技术支持</p>
  
  <!-- 帮助链接 -->
  <p>发现问题？联系我们 · 使用文档 · 常见问题</p>
</footer>
```

---

## 八、样式系统扩展

### 8.1 导航页脚样式

**文件：** `ui/src/styles/layout.css`

```css
/* Nav Footer (tecbinai branding) */
.nav-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.nav-footer-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, rgba(255, 92, 92, 0.1), rgba(168, 85, 247, 0.1));
  border: 1px solid rgba(255, 92, 92, 0.2);
  text-decoration: none;
  transition: all var(--duration-normal) var(--ease-out);
}

.nav-footer-link:hover {
  background: linear-gradient(135deg, rgba(255, 92, 92, 0.15), rgba(168, 85, 247, 0.15));
  border-color: rgba(255, 92, 92, 0.4);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 92, 92, 0.15);
}

.nav-footer-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
}

.nav-footer-desc {
  font-size: 10px;
  color: var(--muted);
}
```

### 8.2 对话欢迎卡片样式

**文件：** `ui/src/styles/chat/layout.css`

```css
/* CHAT WELCOME CARD */
.chat-welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  max-width: 600px;
  margin: auto;
  animation: rise 0.4s var(--ease-out);
}

.chat-welcome__icon {
  font-size: 64px;
  margin-bottom: 16px;
  animation: glow-pulse 2s ease-in-out infinite;
}

.chat-welcome__title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-strong);
}

.chat-welcome__example {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}

.chat-welcome__example:hover {
  background: var(--panel-hover);
  border-color: var(--accent);
  transform: translateX(4px);
}

.chat-welcome__tecbinai {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: linear-gradient(135deg, rgba(255, 92, 92, 0.1), rgba(168, 85, 247, 0.1));
  border: 1px solid rgba(255, 92, 92, 0.2);
  border-radius: var(--radius-full);
  font-size: 12px;
  color: var(--text);
}
```

### 8.3 连接提示样式

**文件：** `ui/src/styles/components.css`

```css
/* Connection Hint - Friendly error guidance */
.connection-hint {
  margin-top: 12px;
  padding: 16px;
  background: var(--panel);
  border-radius: var(--radius-md);
  border: 1px solid var(--border);
}

.connection-hint__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-strong);
  margin-bottom: 12px;
}

.connection-hint__cmd {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.connection-hint__cmd code {
  flex: 1;
  font-size: 11px;
  font-family: var(--mono);
  color: var(--text);
}

.connection-hint__links {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.connection-hint__links a {
  color: var(--accent);
}
```

### 8.4 响应式适配

```css
/* 移动端隐藏导航页脚 */
@media (max-width: 1100px) {
  .nav-footer {
    display: none;
  }
}

/* 移动端欢迎卡片适配 */
@media (max-width: 640px) {
  .chat-welcome {
    padding: 32px 16px;
  }
  
  .chat-welcome__icon {
    font-size: 48px;
  }
  
  .chat-welcome__title {
    font-size: 20px;
  }
}
```

---

## 九、修改文件清单

### 9.1 TypeScript 文件

| 文件路径 | 修改内容 |
|----------|----------|
| `ui/src/ui/app-render.ts` | 品牌名、导航中文化、tecbinai 页脚 |
| `ui/src/ui/views/chat.ts` | 欢迎卡片组件 |
| `ui/src/ui/views/overview.ts` | 连接错误提示优化 |
| `ui/src/ui/i18n/locales/zh-CN.ts` | 新增 59 个翻译 key |
| `ui/src/ui/i18n/locales/en.ts` | 新增对应英文翻译 |

### 9.2 HTML 文件

| 文件路径 | 修改内容 |
|----------|----------|
| `ui/index.html` | 语言、标题、description |
| `ui/public/install-guide.html` | 品牌名、tecbinai 标识、页脚 |

### 9.3 CSS 文件

| 文件路径 | 修改内容 |
|----------|----------|
| `ui/src/styles/layout.css` | nav-footer 样式 |
| `ui/src/styles/chat/layout.css` | chat-welcome 样式 |
| `ui/src/styles/components.css` | connection-hint 样式 |

### 9.4 静态资源

| 文件路径 | 说明 |
|----------|------|
| `ui/public/logo.png` | ClawbotCN Logo ✅ |

---

## 十、待办事项

### 10.1 Logo 集成 ✅ 已完成

- [x] 重命名为 `logo.png`
- [x] 更新 `app-render.ts` 中的 logo 引用（`/logo.png`）
- [x] 替换 `install-guide.html` 中的 emoji 图标

### 10.2 后续优化建议

| 优先级 | 任务 | 状态 |
|--------|------|------|
| P1 | 新手引导向导组件实现 | 待开发 |
| P1 | 渠道配置分步向导 | 待开发 |
| P1 | 技能状态可视化增强 | 待开发 |
| P2 | 首页仪表板 | 待开发 |
| P2 | Cron 表达式构建器 | 待开发 |

---

## 设计原则总结

### 符合中国用户习惯

1. **全中文界面** - 所有可见文本均有中文翻译
2. **国内模型优先** - 推荐硅基流动、通义、DeepSeek 等国内服务
3. **企业 IM 集成** - 飞书、钉钉配置向导

### 现代视觉体验

1. **渐变色品牌元素** - tecbinai 链接使用红紫渐变
2. **微动效** - hover 效果、入场动画
3. **主题适配** - 深色/浅色主题完美支持

### 用户体验优先

1. **快速上手** - 欢迎卡片 + 示例提示
2. **错误友好** - 中文错误消息 + 一键复制命令
3. **品牌一致** - ClawbotCN + tecbinai 标识统一

---

*文档生成时间：2026-01-31*
*由 ClawbotCN 团队维护*
