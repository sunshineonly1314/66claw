---
name: PagerKit
name_zh: PagerKit
description: '关于 PagerKit（一款面向高级、可定制页面导航的 SwiftUI 库）的专业指导。当开发者提及以下内容时启用：(1) PagerKit、PKPagesView、PKPage；(2) 自定义页面控件、指示器或分页行为；(3) 跨平台 SwiftUI 分页；(4) 动态页面生成；(5) 将页面视图集成至自定义布局；(6) 特定 PagerKit 修饰符或枚举；(7) 页面视图控制器选项；(8) 页面变更事件处理。'
description_zh: 关于 PagerKit（一款面向高级、可定制页面导航的 SwiftUI 库）的专业指导。当开发者提及以下内容时启用：(1) PagerKit、PKPagesView、PKPage；(2) 自定义页面控件、指示器或分页行为；(3) 跨平台 SwiftUI 分页；(4) 动态页面生成；(5) 将页面视图集成至自定义布局；(6) 特定 PagerKit 修饰符或枚举；(7) 页面视图控制器选项；(8) 页面变更事件处理。
---
# PagerKit 技能

## 概述

本技能提供关于 `PagerKit` 的专业指导——这是一款功能强大的 SwiftUI 库，用于构建高度可定制且跨平台的基于页面的导航。内容涵盖从基础用法与动态页面生成，到页面指示器高级定制、事件处理及最佳实践等全部方面。使用本技能可帮助开发者在所有 Apple 平台上的 SwiftUI 应用中，高效实现灵活且视觉丰富的分页体验。

## Agent 行为（请遵守以下规则）

1.  **明确分页需求**：在提供解决方案前，务必确认用户在页面内容、指示器样式、导航流程及目标平台等方面的具体需求。
2.  **优先采用符合 SwiftUI 风格的方式**：优先使用 PagerKit 的 `PKPageBuilder` 和 `ForEach` 进行声明式页面构建，以契合 SwiftUI 的设计理念。
3.  **提供平台专属建议**：在讨论指示器图像、进度条或 `UIPageViewController` 选项时，务必说明其平台可用性及正确类型（`UIImage` 与 `Image`、`UIPageControlProgress`）。
4.  **强调修饰符的使用**：引导用户使用相关 `PKPagesView` 或 `PKPage` 修饰符进行自定义，并提供完整修饰符签名（例如 `.pkPageNavigationOrientation(_:)`）。
5.  **提供上下文相关的代码示例**：提供简洁的代码片段，展示推荐用法在 `PKPagesView` 或 `PKPage` 上下文中的实际应用。
6.  **突出跨平台特性**：在可能的情况下，提醒用户 PagerKit 的跨平台一致性，以及如何使用 `#if os(...)` 指令处理平台差异。

## 项目设置

PagerKit 的行为受项目部署目标与 Swift 版本影响。

-   **部署目标**：PagerKit 支持 iOS 14.0+、iPadOS 14.0+、macOS 14.0+、tvOS 14.0+、visionOS 1.0+ 和 watchOS 10.0+。部分功能（例如 `UIPageControlProgress`）仅在特定平台及操作系统版本上可用。
-   **Swift 版本**：需使用 Swift 5.9+。

若上述信息未知，请向开发者确认，尤其在讨论平台专属功能时。

## 快速决策树

当开发者需要 PagerKit 指导时，请遵循以下决策树：

1.  **搭建新分页器？**
    *   基础安装与概念 → `references/PagerKit.md`
    *   定义整体分页器结构 → `references/PKPagesView.md`
    *   创建单个页面内容 → `references/PKPage.md`

2.  **从数据动态生成页面？**
    *   使用项目集合 → `references/ForEach.md`

3.  **控制页面流或结构？**
    *   添加条件页面（if/else）→ `references/PKPageBuilder.md`
    *   设置水平或垂直导航 → `references/PKPagesView.md`（`.pkPageNavigationOrientation`）

4.  **自定义页面指示器（圆点）？**
    *   更改颜色（活动/非活动）→ `references/PKPagesView.md`（`.pkPageControlIndicatorTintColor`、`.pkPageControlIndicatorCurrentIndicatorTintColor`）
    *   更改背景样式（极简、显著、自动）→ `references/PKPageControlBackgroundStyle.md`
    *   调整位置或间距 → `references/PKPagesView.md`（`.pkPageControlIndicatorAlignment`、`.pkPageControlPadding`）
    *   设置布局方向（例如，垂直对齐）→ `references/PKPageControlDirection.md`
    *   使用自定义图像（全局或按页）→ `references/PKPagesView.md`、`references/PKPage.md`
    *   隐藏指示器（始终隐藏或单页时隐藏）→ `references/PKPagesView.md`

5.  **处理页面变更事件或状态？**
    *   绑定至当前页面索引 → `references/PKPagesView.md`（`.pkCurrentPageIndex`）
    *   响应手动页面变更 → `references/PKPagesView.md`（`.pkOnManualPageChange`）
    *   响应自动页面变更 → `references/PKPagesView.md`（`.pkOnAutoPageChange`）
    *   识别页面切换方向 → `references/PKPageDirection.md`
    *   切换开始/结束时执行操作 → `references/PKPagesView.md`

6.  **自定义单个页面行为？**
    *   设置自动切换持续时间 → `references/PKPage.md`（`.pkPageDuration`）
    *   为页面添加自定义页脚 → `references/PKPage.md`（`.pkPageFooter`）

## 首要排查行动手册

-   **“我的页面未显示或显示异常。”**
    *   验证 `PKPagesView` 是否包含有效的 `PKPage` 实例。参阅 `references/PKPagesView.md`、`references/PKPage.md`。
    *   若使用动态内容，请检查 `ForEach` 的实现。参阅 `references/ForEach.md`。
-   **“页面指示器位置或样式不正确。”**
    *   检查 `.pkPageControlIndicatorAlignment`、`.pkPageControlIndicatorBackgroundStyle`、`.pkPageControlIndicatorDirection` 修饰符是否已应用于 `PKPagesView`。参阅 `references/PKPagesView.md`、`references/PKPageControlBackgroundStyle.md`、`references/PKPageControlDirection.md`。
-   **“我想更改活动圆点的颜色，但未生效。”**
    *   确保 `.pkPageControlIndicatorCurrentIndicatorTintColor(_:)` 已应用于 `PKPagesView`。参阅 `references/PKPagesView.md`。
-   **“页面未自动切换。”**
    *   检查是否已对各个 `PKPage` 应用 `.pkPageDuration(_:)`，且持续时间参数非空。参阅 `references/PKPage.md`。
-   **“我在 `PKPagesView` 内部使用的 `if` 语句导致编译错误。”**
    *   复习 `PKPageBuilder` 概念，确保所有分支均返回有效的 `PKPage` 组件。参阅 `references/PKPageBuilder.md`。
-   **“如何判断用户是向前还是向后滑动？”**
    *   在 `.pkOnManualPageChange` 中使用 `PKPageDirection` 参数。参阅 `references/PKPagesView.md`、`references/PKPageDirection.md`。

## 核心模式参考

### 基础分页器设置

```swift
PKPagesView {
    PKPage { Text("Page A").font(.title) }
    PKPage { Text("Page B").font(.title) }
    PKPage { Text("Page C").font(.title) }
}
.pkCurrentPageIndex($currentPage) // Bind to @State
.pkPageNavigationOrientation(.horizontal)
```

### 使用 ForEach 动态生成页面

```swift
struct Item: Identifiable {
    let id = UUID()
    let title: String
}

// ... inside a View
let items = [Item(title: "Item 1"), Item(title: "Item 2")]

PKPagesView {
    ForEach(items) { item in
        PKPage { Text(item.title) }
            .pkPageFooter { Text("Footer for \(item.title)") }
    }
}
```

### 自定义页面指示器样式

```swift
.pkPageControlIndicatorAlignment(spacing: 10, alignment: .bottomTrailing)
.pkPageControlIndicatorBackgroundStyle(.prominent)
.pkPageControlIndicatorDirection(.topToBottom) // Vertical dots
.pkPageControlIndicatorTintColor(.gray)
.pkPageControlIndicatorCurrentIndicatorTintColor(.blue)
// Custom images
#if os(iOS)
.pkPageControlIndicatorPreferredCurrentPageIndicatorImage(UIImage(systemName: "star.fill"))
#else
.pkPageControlIndicatorPreferredCurrentPageIndicatorImage(Image(systemName: "star.fill"))
#endif
```

### 处理页面变更事件

```swift
.pkOnManualPageChange { currentIndex, direction in
    print("User navigated to page \(currentIndex) by going \(direction).")
}
.pkOnAutoPageChange { previousIndex, currentIndex in
    print("Auto change from \(previousIndex) to \(currentIndex).")
}
.pkOnTransitionEnd { previous, current in
    print("Transition ended. Was on \(previous), now on \(current).")
}
```

## 集成快速指南

PagerKit 通过 Swift Package Manager 集成。

1.  **添加软件包依赖项**：在 Xcode 中，选择 **文件 > 添加软件包依赖项**，然后输入 `https://github.com/SzpakKamil/PagerKit.git`。
2.  **导入**：在 Swift 文件中使用 `import PagerKit`。
3.  **部署目标**：确保项目目标为 iOS 14.0+、iPadOS 14.0+、macOS 14.0+、tvOS 14.0+、visionOS 1.0+ 或 watchOS 10.0+（需 Swift 5.9+）。

详细设置请参阅 `references/PagerKit.md`。

## 参考文档文件

根据具体主题按需加载以下文件：

-   **`PagerKit.md`** — 通用概述、安装步骤及核心优势。
-   **`PKPagesView.md`** — 关于主分页器容器及其全局修饰符的详细信息。
-   **`PKPage.md`** — 关于单个页面创建及页面专属修饰符的信息。
-   **`ForEach.md`** — 如何从数据集合生成页面。
-   **`PKPageBuilder.md`** — 理解 `PKPagesView` 的声明式内容构建。
-   **`PKPageControlBackgroundStyle.md`** — 页面指示器背景样式的选项。
-   **`PKPageControlDirection.md`** — 页面指示器圆点布局方向的选项。
-   **`PKPageDirection.md`** — 理解页面切换方向。
-   **`_index.md`** — PagerKit 所有参考文档的综合索引。

## 最佳实践摘要

1.  **拥抱声明式 UI**：使用 `PKPageBuilder` 与 `ForEach` 构建灵活且易于维护的页面。
2.  **审慎自定义**：充分利用丰富的修饰符 API，使其匹配原生平台美学与应用品牌风格，避免过度自定义而损害可用性。
3.  **管理分页器状态**：始终将 `pkCurrentPageIndex` 绑定至外部状态（`@State` 或 `@Binding`），以实现编程控制与状态监听。
4.  **实现事件处理**：利用回调（例如 `.pkOnManualPageChange`、`.pkOnTransitionEnd`）进行分析统计、触觉反馈，或在导航响应中执行自定义逻辑。
5.  **关注平台差异**：注意在不同 Apple 平台及操作系统版本上行为不同或仅在特定平台可用的修饰符与功能。
6.  **优先考虑无障碍访问**：确保自定义指示器与页脚保持无障碍访问性（例如，支持 VoiceOver）。

**注意**：本技能基于 PagerKit 的完整文档。欲了解更多信息，请访问官方文档网站 [documentation.kamilszpak.com/documentation/pagerkit/](https://documentation.kamilszpak.com/documentation/pagerkit/) 或项目官网 [kamilszpak.com/pl/pagerkit](https://kamilszpak.com/pl/pagerkit)。