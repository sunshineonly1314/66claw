---
name: swiftui-performance-audit
name_zh: SwiftUI性能审计
description: 从代码审查与架构层面审计并提升 SwiftUI 运行时性能。适用于请求诊断 SwiftUI 应用中渲染缓慢、滚动卡顿、CPU/内存占用过高、视图更新过于频繁或布局抖动（layout thrash）等问题；当仅靠代码审查不足以定位问题时，亦可用于指导用户运行 Instruments 进行性能剖析。
description_zh: 从代码审查与架构层面审计并提升 SwiftUI 运行时性能。适用于请求诊断 SwiftUI 应用中渲染缓慢、滚动卡顿、CPU/内存占用过高、视图更新过于频繁或布局抖动（layout thrash）等问题；当仅靠代码审查不足以定位问题时，亦可用于指导用户运行 Instruments 进行性能剖析。
---
# SwiftUI 性能审计（SwiftUI Performance Audit）

_署名：摘录自 @Dimillian 的 `Dimillian/Skills`（2025-12-31）。_

## 概述

端到端审计 SwiftUI 视图性能，涵盖性能剖析与基线建立、根本原因分析，以及具体可行的修复步骤。

## 工作流决策树

- 若用户提供代码，从“代码优先审查（Code-First Review）”开始。
- 若用户仅描述症状，请先索取最小化代码/上下文，再执行“代码优先审查”。
- 若代码审查无法得出明确结论，则进入“指导用户进行性能剖析（Guide the User to Profile）”，并请用户提供 trace 或截图。

## 1. 代码优先审查（Code-First Review）

需收集：
- 目标视图/功能的代码。
- 数据流：状态（state）、环境（environment）、可观测模型（observable models）。
- 症状表现及复现步骤。

重点关注：
- 因宽泛状态变更引发的视图失效风暴（view invalidation storms）。
- 列表中不稳定的标识（identity）（`id` 抖动、`UUID()` 每次渲染均变化）。
- 在 `body` 中执行的繁重工作（格式化、排序、图像解码）。
- 布局抖动（layout thrash）（深层堆叠、`GeometryReader`、偏好链 preference chains）。
- 未经缩放或降采样的大尺寸图像。
- 过度动画化的视图层级（在大型视图树上启用隐式动画）。

需提供：
- 带代码引用的可能根本原因。
- 建议的修复方案与重构方向。
- 如有必要，提供最小可复现示例或性能剖析建议。

## 2. 指导用户进行性能剖析（Guide the User to Profile）

说明如何使用 Instruments 收集数据：
- 在 Instruments 中使用 SwiftUI 模板（需 Release 构建版本）。
- 精确复现目标交互（如滚动、导航、动画）。
- 同时捕获 SwiftUI 时间线与时间剖析器（Time Profiler）。
- 导出或截取相关轨道（lanes）及调用树（call tree）。

需向用户索取：
- Trace 导出文件，或 SwiftUI 轨道与时间剖析器调用树的截图。
- 设备型号、操作系统版本及构建配置。

## 3. 分析与诊断（Analyze and Diagnose）

优先排查最可能的 SwiftUI 根本原因：
- 因宽泛状态变更引发的视图失效风暴（view invalidation storms）。
- 列表中不稳定的标识（identity）（`id` 抖动、`UUID()` 每次渲染均变化）。
- 在 `body` 中执行的繁重工作（格式化、排序、图像解码）。
- 布局抖动（layout thrash）（深层堆叠、`GeometryReader`、偏好链 preference chains）。
- 未经缩放或降采样的大尺寸图像。
- 过度动画化的视图层级（在大型视图树上启用隐式动画）。

需基于 trace/日志中的证据总结发现。

## 4. 修复（Remediate）

实施针对性修复：
- 缩小状态作用域（将 `@State`/`@Observable` 尽量靠近叶子视图）。
- 稳定 `ForEach` 与列表项的标识（identity）。
- 将繁重工作移出 `body`（预计算、缓存、`@State`）。
- 对高开销子树使用 `equatable()` 或值包装器（value wrappers）。
- 渲染前对图像进行降采样（downsample）。
- 降低布局复杂度，或在可行处使用固定尺寸（fixed sizing）。

## 常见代码异味（Code Smells）及其修复方案

在代码审查期间留意以下模式。

### 在 `body` 中使用高开销格式化器（formatters）

```swift
var body: some View {
    let number = NumberFormatter() // slow allocation
    let measure = MeasurementFormatter() // slow allocation
    Text(measure.string(from: .init(value: meters, unit: .meters)))
}
```

推荐改用模型或专用辅助类中缓存的格式化器：

```swift
final class DistanceFormatter {
    static let shared = DistanceFormatter()
    let number = NumberFormatter()
    let measure = MeasurementFormatter()
}
```

### 执行繁重工作的计算属性（computed properties）

```swift
var filtered: [Item] {
    items.filter { $0.isEnabled } // runs on every body eval
}
```

推荐在状态变更时预计算或缓存：

```swift
@State private var filtered: [Item] = []
// update filtered when inputs change
```

### 在 `body` 或 `ForEach` 中执行排序/过滤

```swift
List {
    ForEach(items.sorted(by: sortRule)) { item in
        Row(item)
    }
}
```

推荐在视图更新前一次性完成排序：

```swift
let sortedItems = items.sorted(by: sortRule)
```

### 在 `ForEach` 中内联过滤

```swift
ForEach(items.filter { $0.isEnabled }) { item in
    Row(item)
}
```

推荐使用具备稳定标识（stable identity）的预过滤集合。

### 不稳定的标识（Unstable identity）

```swift
ForEach(items, id: \.self) { item in
    Row(item)
}
```

避免对非稳定值使用 `id: \.self`；应使用稳定 ID。

### 主线程上的图像解码（Image decoding on the main thread）

```swift
Image(uiImage: UIImage(data: data)!)
```

推荐在非主线程上完成解码/降采样，并将结果缓存。

### 可观测模型中的宽泛依赖（Broad dependencies in observable models）

```swift
@Observable class Model {
    var items: [Item] = []
}

var body: some View {
    Row(isFavorite: model.items.contains(item))
}
```

推荐采用细粒度 view model 或逐项状态（per-item state），以减少更新扩散。

## 5. 验证（Verify）

请用户重新执行相同的性能采集，并与基线指标对比。
若用户提供数据，需汇总差异（CPU 占用、掉帧数、内存峰值）。

## 输出内容（Outputs）

需提供：
- 简明指标表格（如有，包含修改前/后对比）。
- 问题清单（按影响程度排序）。
- 建议修复方案及预估工作量。

## 参考资料（References）

根据用户提供的资料，在 `references/` 下补充 Apple 官方文档与 WWDC 资源：
- 使用 Instruments 优化 SwiftUI 性能：`references/optimizing-swiftui-performance-instruments.md`
- 理解并提升 SwiftUI 性能：`references/understanding-improving-swiftui-performance.md`
- 理解应用中的卡顿：`references/understanding-hangs-in-your-app.md`
- 解密 SwiftUI 性能（WWDC23）：`references/demystify-swiftui-performance-wwdc23.md`