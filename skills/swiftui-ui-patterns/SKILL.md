---
name: swiftui-ui-patterns
name_zh: SwiftUI UI模式
description: 构建 SwiftUI 视图与组件的最佳实践及示例驱动指南。适用于创建或重构 SwiftUI UI、使用 TabView 设计标签页架构、组合屏幕，或需要特定组件的模式与示例时。
description_zh: 构建 SwiftUI 视图与组件的最佳实践及示例驱动指南。适用于创建或重构 SwiftUI UI、使用 TabView 设计标签页架构、组合屏幕，或需要特定组件的模式与示例时。
---
# SwiftUI UI 模式

## 快速入门

根据您的目标选择相应路径：

### 现有项目

- 明确待实现的功能或屏幕及其主要交互模型（列表、详情、编辑器、设置、标签页）。
- 在代码仓库中查找与 `rg "TabView\("` 或类似内容邻近的示例，然后阅读最接近的 SwiftUI 视图。
- 遵循本地约定：优先采用 SwiftUI 原生状态管理；尽可能将状态保持在局部；对共享依赖项使用环境注入（environment injection）。
- 从 `references/components-index.md` 中选取相关组件参考，并遵循其指导。
- 使用小型、专注的子视图构建视图，并采用 SwiftUI 原生数据流。

### 新项目脚手架

- 以 `references/app-scaffolding-wiring.md` 为起点，搭建 TabView + NavigationStack + sheets 的基础结构。
- 基于提供的骨架添加最小化的 `AppTab` 和 `RouterPath`。
- 根据您最先需要的 UI 组件（TabView、NavigationStack、Sheets），选择下一个组件参考。
- 随着新屏幕的增加，逐步扩展路由（route）和 sheet 枚举。

## 应遵循的一般规则

- 使用现代 SwiftUI 状态管理机制（`@State`、`@Binding`、`@Observable`、`@Environment`），避免不必要的 view model。
- 优先采用组合方式；保持视图小巧且职责单一。
- 结合 `.task` 使用 async/await，并显式声明加载/错误状态。
- 仅在编辑遗留文件时，才维持现有遗留模式。
- 遵循项目的格式化工具与风格指南。
- **Sheet（模态页）**：当状态表示一个已选模型时，优先使用 `.sheet(item:)` 而非 `.sheet(isPresented:)`；避免在 sheet 主体中使用 `if let`；sheet 应自主管理其操作行为，并在内部调用 `dismiss()`，而非转发 `onCancel`/`onConfirm` 闭包。

## 新 SwiftUI 视图的工作流程

1. 定义该视图的状态及其所属位置（ownership location）。
2. 识别需通过 `@Environment` 注入的依赖项。
3. 勾勒视图层级结构，并将重复部分提取为子视图。
4. 如需，使用 `.task` 实现异步加载，并显式定义状态枚举（state enum）。
5. 当 UI 具备交互性时，添加可访问性标签（accessibility labels）或标识符（identifiers）。
6. 通过构建验证，并在必要时更新调用站点（usages callsites）。

## 组件参考

以 `references/components-index.md` 作为入口点。每个组件参考应包含：
- 设计意图与适用场景。
- 符合本地约定的最小化使用模式。
- 常见陷阱与性能注意事项。
- 当前代码仓库中对应示例的路径。

## Sheet 模式

### 以条目驱动的 Sheet（推荐）

```swift
@State private var selectedItem: Item?

.sheet(item: $selectedItem) { item in
    EditItemSheet(item: item)
}
```

### Sheet 自主管理其操作行为

```swift
struct EditItemSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(Store.self) private var store

    let item: Item
    @State private var isSaving = false

    var body: some View {
        VStack {
            Button(isSaving ? "Saving…" : "Save") {
                Task { await save() }
            }
        }
    }

    private func save() async {
        isSaving = true
        await store.save(item)
        dismiss()
    }
}
```

## 添加新组件参考

- 创建 `references/<component>.md`。
- 保持简短且具备可操作性；链接至当前代码仓库中的具体文件。
- 在 `references/components-index.md` 中新增对应条目。