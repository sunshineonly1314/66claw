---
name: swift-concurrency-expert
name_zh: Swift并发专家
description: 针对 Swift 6.2+ 的 Swift Concurrency 审查与修复。当被要求审查 Swift Concurrency 的使用、提升并发合规性，或修复某项功能或文件中的 Swift 并发编译错误时启用。
description_zh: 针对 Swift 6.2+ 的 Swift Concurrency 审查与修复。当被要求审查 Swift Concurrency 的使用、提升并发合规性，或修复某项功能或文件中的 Swift 并发编译错误时启用。
---
# Swift Concurrency Expert

_署名：摘自 @Dimillian 的 `Dimillian/Skills`（2025-12-31）。_

## 概述

通过应用 actor 隔离、Sendable 安全性及现代并发模式，在尽可能不改变行为的前提下，审查并修复 Swift 6.2+ 代码库中的 Swift Concurrency 问题。

## 工作流程

### 1. 问题分诊

- 记录确切的编译器诊断信息及引发问题的符号（symbols）。
- 确定当前 actor 上下文（`@MainActor`、`actor`、`nonisolated`），并确认是否启用了默认 actor 隔离模式。
- 确认该代码是否绑定 UI，或预期在 main actor 之外运行。

### 2. 应用最小且安全的修复

优先选择能保持现有行为、同时满足数据竞争安全性的修改。

常见修复方式：
- **UI 绑定类型**：为该类型或相关成员添加 `@MainActor` 标注。
- **main actor 类型上的协议遵循**：使该遵循具备隔离性（例如：`extension Foo: @MainActor SomeProtocol`）。
- **全局/静态状态**：使用 `@MainActor` 进行保护，或将状态移入 actor。
- **后台工作**：将耗时操作移入 `@concurrent` 异步函数（位于 `nonisolated` 类型中），或使用 `actor` 来保护可变状态。
- **Sendable 错误**：优先采用不可变/值类型；仅在语义正确时添加 `Sendable` 遵循；除非能严格证明线程安全性，否则避免使用 `@unchecked Sendable`。

## 参考资料

- 请参阅 `references/swift-6-2-concurrency.md`，了解 Swift 6.2 的变更、模式与示例。
- 请参阅 `references/swiftui-concurrency-tour-wwdc.md`，获取 SwiftUI 特定的并发指导。