---
name: ui-skills
name_zh: UI技能
description: Opinionated constraints for building better interfaces with agents.
description_zh: Opinionated constraints for building better interfaces with agents.
---
# UI Skills

面向 agent 的更优界面构建之主张性约束（Opinionated constraints）。

## 技术栈

- **必须** 在引入自定义值前，优先采用 Tailwind CSS 默认配置（间距、圆角、阴影）  
- **必须** 在需要 JavaScript 动画时使用 `motion/react`（原名 `framer-motion`）  
- **建议** 在 Tailwind CSS 中使用 `tw-animate-css` 实现进入动画与微动效  
- **必须** 使用 `cn` 工具函数（`clsx` + `tailwind-merge`）管理类名逻辑  

## 组件

- **必须** 对任何涉及键盘或焦点行为的组件，使用无障碍组件基元（`Base UI`、`React Aria`、`Radix`）  
- **必须** 优先复用项目现有组件基元  
- **禁止** 在同一交互表面混用不同基元系统  
- **建议** 若兼容当前技术栈，新基元优先选用 [`Base UI`](https://base-ui.com/react/components)  
- **必须** 为仅含图标的按钮添加 `aria-label`  
- **禁止** 手动重写键盘或焦点行为，除非明确要求  

## 交互

- **必须** 对破坏性或不可逆操作使用 `AlertDialog`  
- **建议** 使用结构化骨架屏（structural skeletons）表示加载状态  
- **禁止** 使用 `h-screen`，改用 `h-dvh`  
- **必须** 遵守 `safe-area-inset` 处理固定元素  
- **必须** 在操作发生位置附近展示错误信息  
- **禁止** 在 `input` 或 `textarea` 元素中阻止粘贴  

## 动效

- **禁止** 添加动效，除非明确要求  
- **必须** 仅对合成器属性（compositor props）进行动画（`transform`、`opacity`）  
- **禁止** 对布局属性（layout properties）进行动画（`width`、`height`、`top`、`left`、`margin`、`padding`）  
- **建议** 除小范围局部 UI（如文字、图标）外，避免对绘制属性（paint properties）进行动画（`background`、`color`）  
- **建议** 在进入时使用 `ease-out`  
- **禁止** 交互反馈动效时长超过 `200ms`  
- **必须** 在元素移出视口时暂停循环动效  
- **必须** 遵守 `prefers-reduced-motion`  
- **禁止** 引入自定义缓动曲线，除非明确要求  
- **建议** 避免对大尺寸图像或全屏表面进行动画  

## 排版

- **必须** 使用 `text-balance` 作为标题字体，`text-pretty` 作为正文/段落字体  
- **必须** 使用 `tabular-nums` 展示数据  
- **建议** 在密集型 UI 中使用 `truncate` 或 `line-clamp`  
- **禁止** 修改 `letter-spacing`（`tracking-`），除非明确要求  

## 布局

- **必须** 使用固定 `z-index` 尺度（禁用任意 `z-x`）  
- **建议** 使用 `size-x` 创建正方形元素，而非 `w-x` + `h-x`  

## 性能

- **禁止** 对大尺寸 `blur()` 或 `backdrop-filter` 表面进行动画  
- **禁止** 在非活跃动画期间应用 `will-change`  
- **禁止** 使用 `useEffect` 表达本可通过渲染逻辑实现的功能  

## 设计

- **禁止** 使用渐变，除非明确要求  
- **禁止** 使用紫色或多彩渐变  
- **禁止** 将发光效果（glow effects）作为主要可操作提示  
- **建议** 除非明确要求，否则使用 Tailwind CSS 默认阴影尺度  
- **必须** 为空状态提供一个明确的下一步操作  
- **建议** 每个视图中限制强调色（accent color）使用不超过一种  
- **建议** 优先复用现有主题或 Tailwind CSS 色彩标记（color tokens），再考虑新增  