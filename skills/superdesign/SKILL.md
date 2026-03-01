---
name: superdesign
name_zh: 超级设计
description: 专业的前端设计指南，用于打造美观、现代的用户界面。在构建落地页、仪表盘或任何用户界面时使用。
description_zh: 专业的前端设计指南，用于打造美观、现代的用户界面。在构建落地页、仪表盘或任何用户界面时使用。
metadata: {"clawdbot":{"emoji":"🎨"}}
---
# Frontend Design Skill（前端设计技能）

在创建 UI 组件、落地页、仪表盘或执行任何前端设计工作时，请使用此 skill。

## 设计工作流

请遵循以下结构化 UI 设计流程：

1. **布局设计（Layout Design）** —— 思考组件结构，绘制 ASCII 格式线框图  
2. **主题设计（Theme Design）** —— 定义颜色、字体、间距、阴影  
3. **动效设计（Animation Design）** —— 规划微交互与过渡效果  
4. **实现（Implementation）** —— 生成实际代码  

### 1. 布局设计

编码前，请先以 ASCII 格式草绘布局：

```
┌─────────────────────────────────────┐
│         HEADER / NAV BAR            │
├─────────────────────────────────────┤
│                                     │
│            HERO SECTION             │
│         (Title + CTA)               │
│                                     │
├─────────────────────────────────────┤
│   FEATURE   │  FEATURE  │  FEATURE  │
│     CARD    │   CARD    │   CARD    │
├─────────────────────────────────────┤
│            FOOTER                   │
└─────────────────────────────────────┘
```

### 2. 主题规范

**配色规则：**  
- **切勿**使用通用 Bootstrap 风格蓝色（`#007bff`）——该色已显过时  
- 推荐使用 `oklch()` 定义现代色彩  
- 使用语义化颜色变量（如 `--primary`、`--secondary`、`--muted` 等）  
- 从项目初始阶段即需同时考虑明/暗两种模式  

**字体选择（Google Fonts）：**  
```
Sans-serif: Inter, Roboto, Poppins, Montserrat, Outfit, Plus Jakarta Sans, DM Sans, Space Grotesk
Monospace: JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono, Space Mono, Geist Mono
Serif: Merriweather, Playfair Display, Lora, Source Serif Pro, Libre Baskerville
Display: Architects Daughter, Oxanium
```

**间距与阴影：**  
- 采用统一的间距比例（以 `0.25rem` 为基准）  
- 阴影应轻盈克制——避免厚重的投影效果  
- 同样建议对阴影颜色也采用 `oklch()` 定义  

### 3. 主题范式

**现代暗色模式（Vercel / Linear 风格）：**  
```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.970 0 0);
  --muted: oklch(0.970 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --border: oklch(0.922 0 0);
  --radius: 0.625rem;
  --font-sans: Inter, system-ui, sans-serif;
}
```

**新粗野主义（90 年代网页复兴风）：**  
```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0 0 0);
  --primary: oklch(0.649 0.237 26.97);
  --secondary: oklch(0.968 0.211 109.77);
  --accent: oklch(0.564 0.241 260.82);
  --border: oklch(0 0 0);
  --radius: 0px;
  --shadow: 4px 4px 0px 0px hsl(0 0% 0%);
  --font-sans: DM Sans, sans-serif;
  --font-mono: Space Mono, monospace;
}
```

**玻璃拟态（Glassmorphism）：**  
```css
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 1rem;
}
```

### 4. 动效规范

**规划用微语法（Micro-syntax）：**  
```
button: 150ms [S1→0.95→1] press
hover: 200ms [Y0→-2, shadow↗]
fadeIn: 400ms ease-out [Y+20→0, α0→1]
slideIn: 350ms ease-out [X-100→0, α0→1]
bounce: 600ms [S0.95→1.05→1]
```

**常用时长模式：**  
- 入场动画：300–500ms，缓出（`ease-out`）  
- 悬停状态：150–200ms  
- 按钮按下反馈：100–150ms  
- 页面切换过渡：300–400ms  

### 5. 实现规范

**Tailwind CSS：**  
```html
<!-- Import via CDN for prototypes -->
<script src="https://cdn.tailwindcss.com"></script>
```

**Flowbite（组件库）：**  
```html
<link href="https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.js"></script>
```

**图标（Lucide）：**  
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<script>lucide.createIcons();</script>
```

**图片：**  
- 使用真实占位图服务：Unsplash、placehold.co  
- **禁止**虚构图片 URL  
- 示例：`https://images.unsplash.com/photo-xxx?w=800&h=600`

### 6. 响应式设计

始终采用移动优先（mobile-first）与响应式设计原则：

```css
/* Mobile first */
.container { padding: 1rem; }

/* Tablet */
@media (min-width: 768px) {
  .container { padding: 2rem; }
}

/* Desktop */
@media (min-width: 1024px) {
  .container { max-width: 1200px; margin: 0 auto; }
}
```

### 7. 可访问性（Accessibility）

- 使用语义化 HTML（`header`、`main`、`nav`、`section`、`article` 等）  
- 保持合理的标题层级（`h1` → `h2` → `h3`）  
- 为可交互元素添加 `aria-label`  
- 确保足够的颜色对比度（最低 4.5:1）  
- 支持键盘导航  

### 8. 组件设计技巧

**卡片（Cards）：**  
- 使用轻量阴影，避免厚重投影  
- 保持一致内边距（`p-4` 至 `p-6`）  
- 悬停状态：轻微上浮 + 阴影增强  

**按钮（Buttons）：**  
- 明确视觉层级（主按钮、次按钮、幽灵按钮等）  
- 提供充足触控区域（最小尺寸 44×44px）  
- 包含加载态与禁用态  

**表单（Forms）：**  
- 输入框上方显示清晰标签  
- 设置可见的焦点状态  
- 提供内联验证反馈  
- 字段间保留充足间距  

**导航（Navigation）：**  
- 长页面启用粘性页眉（sticky header）  
- 清晰标识当前激活项  
- 移动端适配汉堡菜单（hamburger menu）  

---

## 快速参考表

| 元素 | 推荐方案 |
|------|-----------|
| 主字体 | Inter、Outfit、DM Sans |
| 代码字体 | JetBrains Mono、Fira Code |
| 圆角半径 | `0.5rem` – `1rem`（现代风格），`0`（粗野主义） |
| 阴影 | 轻量，最多 1–2 层 |
| 间距 | 以 `4px`（即 `0.25rem`）为基准单位 |
| 动画 | 时长 `150–400ms`，缓出（`ease-out`） |
| 颜色 | 使用 `oklch()` 实现现代配色，避免通用蓝色 |

---

*基于 SuperDesign 设计范式 — https://superdesign.dev*