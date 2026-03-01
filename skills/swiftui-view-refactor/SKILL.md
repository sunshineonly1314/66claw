---
name: swiftui-view-refactor
name_zh: SwiftUI视图重构
description: 对 SwiftUI 视图文件进行重构与审查，确保结构一致、依赖注入规范、Observation 使用得当。适用于被要求清理 SwiftUI 视图的布局/顺序、安全处理 view model（尽可能避免可选类型）、或标准化依赖项与 @Observable 状态的初始化与传递方式时。
description_zh: 对 SwiftUI 视图文件进行重构与审查，确保结构一致、依赖注入规范、Observation 使用得当。适用于被要求清理 SwiftUI 视图的布局/顺序、安全处理 view model（尽可能避免可选类型）、或标准化依赖项与 @Observable 状态的初始化与传递方式时。
---
# SwiftUI 视图重构

_署名：摘录自 @Dimillian 的 `Dimillian/Skills`（2025-12-31）。_

## 概述  
对 SwiftUI 视图应用统一的结构与依赖注入模式，重点关注顺序编排、Model-View（MV）模式、view model 的审慎处理，以及 Observation 的正确使用。

## 核心准则

### 1) 视图属性顺序（由上至下）
- Environment  
- `private`/`public` `let`  
- `@State` / 其他存储属性  
- 计算型 `var`（非视图类型）  
- `init`  
- `body`  
- 计算型视图构建器 / 其他视图辅助方法  
- 辅助函数 / 异步函数  

### 2) 优先采用 MV（Model-View）模式  
- 默认采用 MV：视图是轻量级的状态表达；模型/服务承载业务逻辑。  
- 优先选用 `@State`、`@Environment`、`@Query` 及 `task`/`onChange` 进行协调。  
- 通过 `@Environment` 注入服务与共享模型；保持视图小巧且可组合。  
- 将大型视图拆分为子视图，而非引入 view model。

### 3) 拆分大型 body 与视图属性  
- 若 `body` 超出一屏或包含多个逻辑区段，则将其拆分为更小的子视图。  
- 当大型计算型视图属性（`var header: some View { ... }`）携带状态或存在复杂分支逻辑时，应将其提取为专用的 `View` 类型。  
- 相关子视图可保留在同一文件中作为计算型视图属性；仅当结构上合理或预期复用时，才提取为独立的 `View` struct。  
- 优先传递小型输入（数据、Binding、回调），而非复用整个父视图状态。

示例（提取某一部分）：

```swift
var body: some View {
    VStack(alignment: .leading, spacing: 16) {
        HeaderSection(title: title, isPinned: isPinned)
        DetailsSection(details: details)
        ActionsSection(onSave: onSave, onCancel: onCancel)
    }
}
```

示例（长 body → 更短的 body + 同一文件内的计算型视图）：

```swift
var body: some View {
    List {
        header
        filters
        results
        footer
    }
}

private var header: some View {
    VStack(alignment: .leading, spacing: 6) {
        Text(title).font(.title2)
        Text(subtitle).font(.subheadline)
    }
}

private var filters: some View {
    ScrollView(.horizontal, showsIndicators: false) {
        HStack {
            ForEach(filterOptions, id: \.self) { option in
                FilterChip(option: option, isSelected: option == selectedFilter)
                    .onTapGesture { selectedFilter = option }
            }
        }
    }
}
```

示例（提取复杂的计算型视图）：

```swift
private var header: some View {
    HeaderSection(title: title, subtitle: subtitle, status: status)
}

private struct HeaderSection: View {
    let title: String
    let subtitle: String?
    let status: Status

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.headline)
            if let subtitle { Text(subtitle).font(.subheadline) }
            StatusBadge(status: status)
        }
    }
}
```

### 4) view model 处理（仅当已存在时）  
- 除非请求明确要求或现有代码已含 view model，否则不得引入 view model。  
- 若 view model 已存在，应尽可能使其为非可选类型（non-optional）。  
- 通过 `init` 向视图注入依赖项，再于视图的 `init` 中将这些依赖项传入 view model。  
- 避免 `bootstrapIfNeeded` 模式。

示例（基于 Observation）：

```swift
@State private var viewModel: SomeViewModel

init(dependency: Dependency) {
    _viewModel = State(initialValue: SomeViewModel(dependency: dependency))
}
```

### 5) Observation 使用规范  
- 对于 `@Observable` 引用类型，在根视图中应以其 `@State` 形式存储。  
- 显式向下传递 observables；除非必需，否则避免可选状态。

## 工作流程

1) 按照顺序规则重排视图。  
2) 优先采用 MV：使用 `@State`、`@Environment`、`@Query`、`task` 和 `onChange` 将轻量级协调逻辑移入视图。  
3) 若存在 view model，则以非可选的 `@State` view model 替换可选 view model，并在 `init` 中通过向 view model 传入视图依赖项完成初始化。  
4) 确认 Observation 使用：根 `@Observable` view model 应使用 `@State`，且不得存在冗余包装器。  
5) 保持行为不变：除非明确要求，否则不得更改布局或业务逻辑。

## 注意事项

- 优先选用小型、明确的辅助方法，而非大型条件块。  
- 计算型视图构建器应置于 `body` 下方；非视图类型的计算变量应置于 `init` 上方。  
- 关于 MV 优先原则的详细指引与原理，请参阅 `references/mv-patterns.md`。