---
name: swiftui-empty-app-init
name_zh: SwiftUI空应用初始化
description: 通过 XcodeGen 在当前目录中生成一个单一的 `.xcodeproj`，从而初始化一个最简 SwiftUI iOS 应用（除非显式要求，否则不创建工作区、包或测试）。
description_zh: 通过 XcodeGen 在当前目录中生成一个单一的 `.xcodeproj`，从而初始化一个最简 SwiftUI iOS 应用（除非显式要求，否则不创建工作区、包或测试）。
---
# SwiftUI 空应用初始化

## 概述
在当前目录中初始化一个干净、单 target 的 SwiftUI iOS 应用。  
该项目使用 **XcodeGen** 生成单一 `.xcodeproj`，使开发者可立即开始添加功能。

## 前置条件
- 已安装 Xcode，并已通过 `xcode-select` 选定
- **XcodeGen** 已在 `PATH` 中可用

若任一前置条件缺失：
- 立即停止执行
- 明确告知用户缺失的具体项
- **不得**尝试替代脚手架方案或自动安装

## 输入项
- **项目名称**（必需）
- **最低 iOS 部署目标版本**
- **可选的 Bundle Identifier**（如未提供，则使用默认值）

## 默认行为（无需额外确认）
- Bundle Identifier 默认值：`com.example.<ProjectName>`
- 一旦提供全部必需输入，立即执行（不额外询问确认）

## 核心要求
所生成的项目必须满足以下全部条件：
- 必须通过 **XcodeGen** 生成（不得手动编写 `project.pbxproj`）
- 仅使用单一 `.xcodeproj`（不得包含 `.xcworkspace`）
- 恰好包含一个 **app target**
- 使用 SwiftUI `@main App` 生命周期
- 包含一个最简 `ContentView` 占位符
- 包含一个最简 `Info.plist`（避免不必要的 scene 或 delegate 键）
- **不包含任何 Swift 包**
- **不包含任何测试 target**，除非显式要求

## 生成流程
- 使用提供的输入创建一个最简 `project.yml`
- 使用 XcodeGen 生成 `YourApp.xcodeproj`
- 确保输出完全符合全部核心要求

## 预期目录结构
- `project.yml`
- `YourApp.xcodeproj`
- `YourApp/`（app target 的源文件）
- 仅包含可选的配置文件

不得存在额外的文件夹、包、工作区、脚本或资源。

## 最小化验证（快速）
- 确认 XcodeGen 已成功生成 `YourApp.xcodeproj`
- 确认默认 scheme 存在（例如，通过轻量级 scheme 列表检查）
- **不得**启动模拟器、构建、安装或运行应用，除非显式要求

## 注意事项
- 保持项目极简且无预设倾向（unopinionated）
- 不得添加图标、脚本、包、工作区或架构脚手架
- 本 skill 仅用于 **应用初始化**，不用于功能脚手架