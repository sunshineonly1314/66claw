---
name: web-perf
name_zh: Web性能
description: 使用 Chrome DevTools MCP 分析网页性能。测量核心网页指标（FCP、LCP、TBT、CLS、Speed Index），识别阻塞渲染的资源、网络依赖链、布局偏移、缓存问题及可访问性缺口。当被要求审核、分析、调试或优化页面加载性能、Lighthouse 分数或网站速度时使用。
description_zh: 使用 Chrome DevTools MCP 分析网页性能。测量核心网页指标（FCP、LCP、TBT、CLS、Speed Index），识别阻塞渲染的资源、网络依赖链、布局偏移、缓存问题及可访问性缺口。当被要求审核、分析、调试或优化页面加载性能、Lighthouse 分数或网站速度时使用。
---
# 网页性能审核

使用 Chrome DevTools MCP 工具审核网页性能。本 skill 聚焦于核心网页指标（Core Web Vitals）、网络优化及高层次的可访问性缺口。

## 第一步：验证 MCP 工具是否可用

**开始前务必执行此步骤。** 尝试调用 `navigate_page` 或 `performance_start_trace`。若不可用，请立即停止——chrome-devtools MCP 服务未配置。

请用户将其添加至其 MCP 配置中：

```json
"chrome-devtools": {
  "type": "local",
  "command": ["npx", "-y", "chrome-devtools-mcp@latest"]
}
```

## 关键准则

- **保持果断**：通过检查网络请求、DOM 或代码库来验证各项主张，然后明确陈述结论。
- **先验证，再建议**：确认某项资源确实未被使用后，方可建议移除。
- **量化影响**：依据洞察结果提供预估收益。不优先处理影响为 0ms 的变更。
- **跳过非问题项**：若阻塞渲染的资源预估影响为 0ms，仅作记录，无需提出操作建议。
- **表述具体**：应说“将 hero.png（450KB）压缩为 WebP 格式”，而非笼统地说“优化图片”。
- **严格优先级排序**：若某网站 LCP 为 200ms 且 CLS 为 0，则已属极佳表现——请明确指出。

## 快速参考

| 任务 | 工具调用 |
|------|-----------|
| 加载页面 | `navigate_page(url: "...")` |
| 启动追踪 | `performance_start_trace(autoStop: true, reload: true)` |
| 分析洞察 | `performance_analyze_insight(insightSetId: "...", insightName: "...")` |
| 列出请求 | `list_network_requests(resourceTypes: ["Script", "Stylesheet", ...])` |
| 请求详情 | `get_network_request(reqid: <id>)` |
| 可访问性快照 | `take_snapshot(verbose: true)` |

## 工作流程

复制以下清单以跟踪进度：

```
Audit Progress:
- [ ] Phase 1: Performance trace (navigate + record)
- [ ] Phase 2: Core Web Vitals analysis (includes CLS culprits)
- [ ] Phase 3: Network analysis
- [ ] Phase 4: Accessibility snapshot
- [ ] Phase 5: Codebase analysis (skip if third-party site)
```

### 第一阶段：性能追踪

1. 导航至目标 URL：
   ```
   navigate_page(url: "<target-url>")
   ```

2. 启动一次含重载的性能追踪，以捕获冷加载（cold-load）指标：
   ```
   performance_start_trace(autoStop: true, reload: true)
   ```

3. 等待追踪完成，随后获取结果。

**故障排查：**
- 若追踪返回空结果或失败，请先使用 `navigate_page` 验证页面是否正确加载
- 若洞察（insight）名称不匹配，请检查追踪响应内容，列出当前可用的洞察项

### 第二阶段：核心网页指标分析

使用 `performance_analyze_insight` 提取关键指标。

**注意：** 洞察名称可能因 Chrome DevTools 版本不同而异。若某洞察名称无效，请检查追踪响应中的 `insightSetId`，以发现当前可用的洞察项。

常见洞察名称：

| 指标 | 洞察名称 | 应关注内容 |
|--------|--------------|------------------|
| LCP | `LCPBreakdown` | 最大内容绘制时间；TTFB、资源加载、渲染延迟的细分 |
| CLS | `CLSCulprits` | 引发布局偏移的元素（如未设置尺寸的图片、动态注入的内容、字体替换） |
| 阻塞渲染 | `RenderBlocking` | 阻塞首次绘制的 CSS/JS |
| 文档延迟 | `DocumentLatency` | 服务器响应时间问题 |
| 网络依赖关系 | `NetworkRequestsDepGraph` | 因依赖其他资源先行加载而延迟的关键资源（如 CSS @import、JS 加载的字体） |

示例：
```
performance_analyze_insight(insightSetId: "<id-from-trace>", insightName: "LCPBreakdown")
```

**关键阈值（良好 / 需改进 / 较差）：**
- TTFB：＜ 800ms / ＜ 1.8s / ＞ 1.8s  
- FCP：＜ 1.8s / ＜ 3s / ＞ 3s  
- LCP：＜ 2.5s / ＜ 4s / ＞ 4s  
- INP：＜ 200ms / ＜ 500ms / ＞ 500ms  
- TBT：＜ 200ms / ＜ 600ms / ＞ 600ms  
- CLS：＜ 0.1 / ＜ 0.25 / ＞ 0.25  
- Speed Index：＜ 3.4s / ＜ 5.8s / ＞ 5.8s  

### 第三阶段：网络分析

列出全部网络请求，以识别优化机会：
```
list_network_requests(resourceTypes: ["Script", "Stylesheet", "Document", "Font", "Image"])
```

**重点关注：**

1. **阻塞渲染的资源**：位于 `<head>` 中但缺少 `async`/`defer`/`media` 属性的 JS/CSS  
2. **网络依赖链**：因依赖其他资源先行加载而较晚发现的资源（例如 CSS @import、JS 加载的字体）  
3. **缺失的预加载（preload）**：关键资源（如字体、首屏图片、核心脚本）未配置 preload  
4. **缓存问题**：缺失或弱效的 `Cache-Control`、`ETag` 或 `Last-Modified` 响应头  
5. **过大载荷**：未压缩或体积过大的 JS/CSS 打包文件  
6. **未使用的 preconnect**：若被标记为未使用，请核查是否有任何请求实际发送至该源站。若请求次数为零，则确属未使用——建议移除；若存在请求但加载较晚，则该 preconnect 仍可能具有价值。

获取详细请求信息：
```
get_network_request(reqid: <id>)
```

### 第四阶段：可访问性快照

获取可访问性树（accessibility tree）快照：
```
take_snapshot(verbose: true)
```

**标记高层次可访问性缺口：**
- ARIA ID 缺失或重复  
- 元素对比度不足（参照 WCAG AA 标准：常规文本需 ≥ 4.5:1，大号文本需 ≥ 3:1）  
- 焦点陷阱（focus traps）或缺失焦点指示器（focus indicators）  
- 交互式元素缺少可访问名称（accessible names）

## 第五阶段：代码库分析

**若审核第三方网站且无代码库访问权限，则跳过本阶段。**

分析代码库，以理解可在何处实施改进。

### 检测框架与打包工具

搜索配置文件以识别技术栈：

| 工具 | 配置文件 |
|------|--------------|
| Webpack | `webpack.config.js`, `webpack.*.js` |
| Vite | `vite.config.js`, `vite.config.ts` |
| Rollup | `rollup.config.js`, `rollup.config.mjs` |
| esbuild | `esbuild.config.js`, 含 `esbuild` 的构建脚本 |
| Parcel | `.parcelrc`, `package.json`（parcel 字段） |
| Next.js | `next.config.js`, `next.config.mjs` |
| Nuxt | `nuxt.config.js`, `nuxt.config.ts` |
| SvelteKit | `svelte.config.js` |
| Astro | `astro.config.mjs` |

同时检查 `package.json` 以识别框架依赖项及构建脚本。

### 摇树优化（Tree-Shaking）与死代码

- **Webpack**：检查 package.json 中是否存在 `mode: 'production'`、`sideEffects`，以及 `usedExports` 优化配置  
- **Vite/Rollup**：默认启用摇树优化；检查是否配置了 `treeshake` 选项  
- **重点关注**：桶文件（barrel files，即 `index.js` 重新导出）、整包导入的大型工具库（如 lodash、moment）

### 未使用的 JS/CSS

- 检查是否采用 CSS-in-JS 方案，或是否启用了静态 CSS 提取  
- 查找 PurgeCSS/UnCSS 配置（如 Tailwind 的 `content` 配置）  
- 区分动态导入（dynamic imports）与急切加载（eager loading）

### Polyfill

- 检查 `@babel/preset-env` 目标环境及 `useBuiltIns` 设置  
- 查找 `core-js` 导入（通常体积过大）  
- 检查 `browserslist` 配置是否存在过度宽泛的目标环境设定

### 压缩与混淆（Minification）

- 检查是否启用 `terser`、`esbuild` 或 `swc` 混淆  
- 查看构建输出或服务器配置中是否启用 gzip/brotli 压缩  
- 检查生产环境构建中是否包含源映射（source maps）——应设为外部文件或禁用

## 输出格式

按如下结构呈现发现结果：

1. **核心网页指标摘要** —— 表格形式，含指标名称、实测值及评级（良好 / 需改进 / 较差）  
2. **主要问题** —— 按影响程度（高 / 中 / 低）排序的问题列表，并附预估影响  
3. **改进建议** —— 具体、可操作的修复方案，含代码片段或配置修改说明  
4. **代码库发现** —— 已识别的框架/打包工具类型、潜在优化机会（若无代码库访问权限则省略）