---
name: vercel-react-best-practices
name_zh: Vercel React最佳实践
description: Vercel 工程团队提供的 React 和 Next.js 性能优化指南。当编写、审查或重构 React/Next.js 代码时，应使用本 skill，以确保采用最优性能模式。在涉及 React 组件、Next.js 页面、数据获取、包体积优化或性能提升的任务中触发。
description_zh: Vercel 工程团队提供的 React 和 Next.js 性能优化指南。当编写、审查或重构 React/Next.js 代码时，应使用本 skill，以确保采用最优性能模式。在涉及 React 组件、Next.js 页面、数据获取、包体积优化或性能提升的任务中触发。
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
---
# Vercel React 最佳实践

由 Vercel 维护的 React 和 Next.js 应用程序全面性能优化指南。涵盖 8 个类别共 45 条规则，按影响程度排序，用于指导自动化重构与代码生成。

## 适用场景

在以下情况中参考本指南：
- 编写新的 React 组件或 Next.js 页面
- 实现数据获取（客户端或服务端）
- 审查代码中的性能问题
- 重构现有 React/Next.js 代码
- 优化包体积或加载时间

## 按优先级划分的规则类别

| 优先级 | 类别 | 影响程度 | 前缀 |
|----------|----------|--------|--------|
| 1 | 消除瀑布式请求 | CRITICAL | `async-` |
| 2 | 包体积优化 | CRITICAL | `bundle-` |
| 3 | 服务端性能 | HIGH | `server-` |
| 4 | 客户端数据获取 | MEDIUM-HIGH | `client-` |
| 5 | 重渲染优化 | MEDIUM | `rerender-` |
| 6 | 渲染性能 | MEDIUM | `rendering-` |
| 7 | JavaScript 性能 | LOW-MEDIUM | `js-` |
| 8 | 高级模式 | LOW | `advanced-` |

## 快速参考

### 1. 消除瀑布式请求（CRITICAL）

- `async-defer-await` - 将 await 移至实际使用处的分支中
- `async-parallel` - 对相互独立的操作使用 Promise.all()
- `async-dependencies` - 对存在部分依赖关系的操作使用 better-all
- `async-api-routes` - 在 API 路由中尽早启动 Promise，延迟 await
- `async-suspense-boundaries` - 使用 Suspense 流式传输内容

### 2. 包体积优化（CRITICAL）

- `bundle-barrel-imports` - 直接导入，避免使用 barrel 文件
- `bundle-dynamic-imports` - 对重型组件使用 next/dynamic
- `bundle-defer-third-party` - 在 hydration 后加载分析/日志模块
- `bundle-conditional` - 仅在功能启用时加载对应模块
- `bundle-preload` - 在悬停/聚焦时预加载，提升感知速度

### 3. 服务端性能（HIGH）

- `server-cache-react` - 使用 React.cache() 实现每请求去重
- `server-cache-lru` - 使用 LRU 缓存实现跨请求缓存
- `server-serialization` - 最小化传递给客户端组件的数据量
- `server-parallel-fetching` - 重构组件以并行化数据获取
- `server-after-nonblocking` - 使用 after() 执行非阻塞操作

### 4. 客户端数据获取（MEDIUM-HIGH）

- `client-swr-dedup` - 使用 SWR 实现自动请求去重
- `client-event-listeners` - 去重全局事件监听器

### 5. 重渲染优化（MEDIUM）

- `rerender-defer-reads` - 不要订阅仅在回调中使用的状态
- `rerender-memo` - 将高开销工作提取到记忆化组件中
- `rerender-dependencies` - 在 effect 中使用原始类型依赖项
- `rerender-derived-state` - 订阅派生布尔值，而非原始值
- `rerender-functional-setstate` - 对稳定回调使用函数式 setState
- `rerender-lazy-state-init` - 对高开销值，向 useState 传入函数
- `rerender-transitions` - 对非紧急更新使用 startTransition

### 6. 渲染性能（MEDIUM）

- `rendering-animate-svg-wrapper` - 动画 div 包裹器，而非 SVG 元素
- `rendering-content-visibility` - 对长列表使用 content-visibility
- `rendering-hoist-jsx` - 将静态 JSX 提取到组件外部
- `rendering-svg-precision` - 降低 SVG 坐标精度
- `rendering-hydration-no-flicker` - 对仅客户端数据使用内联脚本
- `rendering-activity` - 使用 Activity 组件控制显示/隐藏
- `rendering-conditional-render` - 使用三元运算符而非 && 进行条件渲染

### 7. JavaScript 性能（LOW-MEDIUM）

- `js-batch-dom-css` - 通过 CSS 类或 cssText 批量修改样式
- `js-index-maps` - 对重复查找构建 Map
- `js-cache-property-access` - 在循环中缓存对象属性
- `js-cache-function-results` - 在模块级 Map 中缓存函数结果
- `js-cache-storage` - 缓存 localStorage/sessionStorage 读取
- `js-combine-iterations` - 将多个 filter/map 合并为单次循环
- `js-length-check-first` - 在昂贵比较前检查数组长度
- `js-early-exit` - 函数中尽早返回
- `js-hoist-regexp` - 将正则表达式创建提升至循环外
- `js-min-max-loop` - 使用循环而非 sort 查找最小/最大值
- `js-set-map-lookups` - 使用 Set/Map 实现 O(1) 查找
- `js-tosorted-immutable` - 使用 toSorted() 保证不可变性

### 8. 高级模式（LOW）

- `advanced-event-handler-refs` - 将事件处理器存储在 ref 中
- `advanced-use-latest` - 使用 useLatest 获取稳定的回调 ref

## 使用方法

阅读各条规则文件，获取详细说明与代码示例：

```
rules/async-parallel.md
rules/bundle-barrel-imports.md
rules/_sections.md
```

每条规则文件包含：
- 简要说明其重要性
- 错误代码示例及解释
- 正确代码示例及解释
- 补充上下文与参考资料

## 完整编译版文档

获取含全部展开规则的完整指南：`AGENTS.md`