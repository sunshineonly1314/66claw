---
name: apple-docs
name_zh: 苹果文档
description: 查询 Apple 开发者文档、API 和 WWDC 视频（2014–2025 年）。支持搜索 SwiftUI、UIKit、Objective-C、Swift 框架及相关会议内容。
description_zh: 查询 Apple 开发者文档、API 和 WWDC 视频（2014–2025 年）。支持搜索 SwiftUI、UIKit、Objective-C、Swift 框架及相关会议内容。
metadata: {"clawdbot":{"emoji":"🍎","requires":{"bins":["node"]}}}
---
# Apple Docs skill

查询 Apple 开发者文档、框架、API 和 WWDC 视频。

## 设置

无需安装——开箱即用，依赖原生 fetch。

## 可用工具

### 文档搜索

| 命令 | 描述 |
|---------|-------------|
| `apple-docs search "query"` | 搜索 Apple 开发者文档 |
| `apple-docs symbols "UIView"` | 搜索框架中的类、结构体、协议 |
| `apple-docs doc "/path/to/doc"` | 根据路径获取详细文档 |

### API 探索

| 命令 | 描述 |
|---------|-------------|
| `apple-docs apis "UIViewController"` | 查找继承关系与协议遵循情况 |
| `apple-docs platform "UIScrollView"` | 检查平台/版本兼容性 |
| `apple-docs similar "UIPickerView"` | 查找 Apple 推荐的替代方案 |

### 技术浏览

| 命令 | 描述 |
|---------|-------------|
| `apple-docs tech` | 按类别列出全部 Apple 技术 |
| `apple-docs overview "SwiftUI"` | 获取全面的技术指南 |
| `apple-docs samples "SwiftUI"` | 浏览 Swift/Objective-C 示例项目 |

### WWDC 视频

| 命令 | 描述 |
|---------|-------------|
| `apple-docs wwdc-search "async"` | 搜索 WWDC 会议视频（2014–2025 年） |
| `apple-docs wwdc-video 2024-100` | 获取视频字幕、代码示例与相关资源 |
| `apple-docs wwdc-topics` | 列出 20 类 WWDC 主题分类 |
| `apple-docs wwdc-years` | 列出各 WWDC 年份及其视频数量 |

## 选项

| 选项 | 描述 |
|--------|-------------|
| `--limit <n>` | 限制返回结果数量 |
| `--category` | 按技术类别筛选 |
| `--framework` | 按框架名称筛选 |
| `--year` | 按 WWDC 年份筛选 |
| `--no-transcript` | 跳过 WWDC 视频字幕 |
| `--no-inheritance` | 在 `apis` 命令中跳过继承信息 |
| `--no-conformances` | 在 `apis` 命令中跳过协议遵循信息 |

## 示例

### 搜索文档

```bash
# Search for SwiftUI animations
apple-docs search "SwiftUI animation"

# Find UITableView delegate methods
apple-docs symbols "UITableViewDelegate"
```

### 检查平台兼容性

```bash
# Check iOS version support for Vision framework
apple-docs platform "VNRecognizeTextRequest"

# Find all SwiftUI views that support iOS 15+
apple-docs search "SwiftUI View iOS 15"
```

### 探索 API

```bash
# Get inheritance hierarchy for UIViewController
apple-docs apis "UIViewController"

# Find alternatives to deprecated API
apple-docs similar "UILabel"
```

### WWDC 视频

```bash
# Search for async/await sessions
apple-docs wwdc-search "async await"

# Get specific video details with transcript
apple-docs wwdc-video 2024-100

# List all available years
apple-docs wwdc-years
```

### 浏览技术

```bash
# List all Apple technologies
apple-docs tech

# Get SwiftUI overview guide
apple-docs overview "SwiftUI"

# Find Vision framework samples
apple-docs samples "Vision"
```

## 缓存

底层 MCP 服务器包含以下缓存策略：
- API 文档：30 分钟缓存  
- 搜索结果：10 分钟缓存  
- 框架信息：1 小时缓存  
- 离线预置 1,260+ 部 WWDC 视频（共 35 MB）

## 资源

- MCP 服务器：https://github.com/kimsungwhee/apple-docs-mcp  
- Apple 开发者文档：https://developer.apple.com/documentation/  
- Apple 开发者网站：https://developer.apple.com/