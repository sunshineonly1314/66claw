---
name: macos-spm-app-packaging
name_zh: macOS SPM应用打包
description: 无需 Xcode 项目即可搭建、构建和打包基于 SwiftPM 的 macOS 应用。适用于需要从零开始构建 macOS 应用目录结构、使用 SwiftPM 目标与资源、自定义 .app bundle 组装脚本，或在 Xcode 外执行签名/公证/appcast 等步骤的场景。
description_zh: 无需 Xcode 项目即可搭建、构建和打包基于 SwiftPM 的 macOS 应用。适用于需要从零开始构建 macOS 应用目录结构、使用 SwiftPM 目标与资源、自定义 .app bundle 组装脚本，或在 Xcode 外执行签名/公证/appcast 等步骤的场景。
---
# macOS SwiftPM 应用打包（无需 Xcode）

## 概述
引导生成完整的 SwiftPM macOS 应用目录结构，随后在不依赖 Xcode 的前提下完成构建、打包与运行。使用 `assets/templates/bootstrap/` 获取初始布局，使用 `references/packaging.md` + `references/release.md` 查阅打包与发布相关细节。

## 两步式工作流
1) 引导项目目录
   - 将 `assets/templates/bootstrap/` 复制到新仓库中。
   - 在 `Package.swift`、`Sources/MyApp/` 和 `version.env` 中重命名 `MyApp`。
   - 自定义 `APP_NAME`、`BUNDLE_ID` 及版本号。

2) 构建、打包并运行已引导的应用
   - 将 `assets/templates/` 中的脚本复制到您的仓库中（例如，`Scripts/`）。
   - 构建与测试：`swift build` 和 `swift test`。
   - 打包：`Scripts/package_app.sh`。
   - 运行：`Scripts/compile_and_run.sh`（推荐）或 `Scripts/launch.sh`。
   - 发布（可选）：`Scripts/sign-and-notarize.sh` 和 `Scripts/make_appcast.sh`。
   - 打标签 + GitHub 发布（可选）：创建 git 标签，将 zip 文件及 appcast（若托管于 GitHub Releases）上传至 GitHub Release 并发布。

## 模板
- `assets/templates/package_app.sh`：构建二进制文件、创建 .app bundle、复制资源、签名。
- `assets/templates/compile_and_run.sh`：开发循环脚本，用于终止正在运行的应用、重新打包并启动。
- `assets/templates/build_icon.sh`：根据 Icon Composer 文件生成 .icns 图标（需已安装 Xcode）。
- `assets/templates/sign-and-notarize.sh`：对发布版构建产物进行公证、加钉（staple）并打包为 zip。
- `assets/templates/make_appcast.sh`：为更新生成 Sparkle appcast 条目。
- `assets/templates/setup_dev_signing.sh`：创建稳定的开发用代码签名身份。
- `assets/templates/launch.sh`：用于启动已打包 .app 的简易启动器。
- `assets/templates/version.env`：供打包脚本读取的示例版本文件。
- `assets/templates/bootstrap/`：最小化的 SwiftPM macOS 应用骨架（含 Package.swift、Sources/、version.env）。

## 注意事项
- 保持 entitlements（权限配置）与签名配置显式化；请直接编辑模板脚本，而非重新实现。
- 若未使用 Sparkle 实现更新功能，请移除相关步骤。
- Sparkle 依赖 Bundle 构建号（`CFBundleVersion`），因此 `BUILD_NUMBER` 在 `version.env` 中必须随每次更新而递增。
- 对于菜单栏应用，在打包时设置 `MENU_BAR_APP=1`，以便在 Info.plist 中写入 `LSUIElement`。