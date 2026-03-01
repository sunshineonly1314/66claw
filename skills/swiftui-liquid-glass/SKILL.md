---
name: swiftui-liquid-glass
name_zh: SwiftUI液态玻璃效果
description: 使用 iOS 26+ Liquid Glass API 实现、评审或改进 SwiftUI 功能。当被要求在新的 SwiftUI UI 中采用 Liquid Glass、将现有功能重构为使用 Liquid Glass，或评审 Liquid Glass 的使用是否符合正确性、性能及设计规范时，请使用本 skill。
description_zh: 使用 iOS 26+ Liquid Glass API 实现、评审或改进 SwiftUI 功能。当被要求在新的 SwiftUI UI 中采用 Liquid Glass、将现有功能重构为使用 Liquid Glass，或评审 Liquid Glass 的使用是否符合正确性、性能及设计规范时，请使用本 skill。
---
# SwiftUI Liquid Glass

_署名：摘自 @Dimillian 的 `Dimillian/Skills`（2025-12-31）。_

## 概述
使用本 skill 构建或评审完全符合 iOS 26+ Liquid Glass API 的 SwiftUI 功能。优先采用原生 API（`glassEffect`、`GlassEffectContainer`、glass button styles）及 Apple 设计指南。确保用法一致、在必要处支持交互，并兼顾性能。

## 工作流决策树
根据请求内容选择对应路径：

### 1) 评审现有功能
- 检查 Liquid Glass 应该使用和不应使用的位置。
- 验证修饰符顺序、形状用法及容器放置是否正确。
- 检查是否已妥善处理 iOS 26+ 可用性，并提供了合理的降级方案。

### 2) 使用 Liquid Glass 改进现有功能
- 识别需应用玻璃效果的目标组件（表面、chip、按钮、卡片等）。
- 当存在多个玻璃元素时，重构为使用 `GlassEffectContainer`。
- 仅对可点击或可聚焦的元素引入交互式玻璃效果。

### 3) 使用 Liquid Glass 实现新功能
- 首先设计玻璃表面及其交互行为（形状、显著程度、分组方式）。
- 在布局/外观修饰符之后添加玻璃修饰符。
- 仅当视图层级发生带动画的变化时，才添加形变（morphing）过渡效果。

## 核心准则
- 优先选用原生 Liquid Glass API，而非自定义模糊效果。
- 当多个玻璃元素共存时，使用 `GlassEffectContainer`。
- 在布局和视觉修饰符之后应用 `.glassEffect(...)`。
- 对响应触控/指针操作的元素，使用 `.interactive()`。
- 保持相关元素间形状的一致性，以实现统一的视觉效果。
- 使用 `#available(iOS 26, *)` 进行版本控制，并提供非玻璃材质的降级方案。

## 评审检查清单
- **可用性**：`#available(iOS 26, *)` 已正确声明，并配有降级 UI。
- **组合方式**：多个玻璃视图已包裹于 `GlassEffectContainer` 内。
- **修饰符顺序**：`glassEffect` 在布局/外观修饰符之后应用。
- **交互性**：`interactive()` 仅应用于存在用户交互的场景。
- **过渡效果**：使用 `glassEffectID` 配合 `@Namespace` 实现形变过渡。
- **一致性**：形状、着色与间距在整个功能中保持统一。

## 实现检查清单
- 明确目标元素及期望的玻璃显著程度。
- 将成组的玻璃元素包裹于 `GlassEffectContainer` 中，并调整间距。
- 按需使用 `.glassEffect(.regular.tint(...).interactive(), in: .rect(cornerRadius: ...))`。
- 对操作行为使用 `.buttonStyle(.glass)` / `.buttonStyle(.glassProminent)`。
- 当视图层级发生变化时，使用 `glassEffectID` 添加形变过渡效果。
- 为早期 iOS 版本提供降级材质与视觉表现。

## 快速代码片段
直接使用以下模式，并按需调整形状、着色与间距。

```swift
if #available(iOS 26, *) {
    Text("Hello")
        .padding()
        .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 16))
} else {
    Text("Hello")
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
}
```

```swift
GlassEffectContainer(spacing: 24) {
    HStack(spacing: 24) {
        Image(systemName: "scribble.variable")
            .frame(width: 72, height: 72)
            .font(.system(size: 32))
            .glassEffect()
        Image(systemName: "eraser.fill")
            .frame(width: 72, height: 72)
            .font(.system(size: 32))
            .glassEffect()
    }
}
```

```swift
Button("Confirm") { }
    .buttonStyle(.glassProminent)
```

## 资源
- 参考指南：`references/liquid-glass.md`
- 建议优先查阅 Apple 官方文档，以获取最新 API 细节。