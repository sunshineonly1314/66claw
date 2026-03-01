---
name: shortcuts-generator
name_zh: 快捷指令技能
description: 通过生成 plist 文件来创建 macOS/iOS 快捷指令。当被要求创建快捷指令、自动化工作流、构建 .shortcut 文件或生成快捷指令 plist 时使用。覆盖 1,155 个操作（427 个 WF*Actions + 728 个 AppIntents）、变量引用及控制流。
description_zh: 通过生成 plist 文件来创建 macOS/iOS 快捷指令。当被要求创建快捷指令、自动化工作流、构建 .shortcut 文件或生成快捷指令 plist 时使用。覆盖 1,155 个操作（427 个 WF*Actions + 728 个 AppIntents）、变量引用及控制流。
allowed-tools: Write, Bash
---
# macOS 快捷指令生成器

生成有效的 `.shortcut` 文件，可签名并导入 Apple 快捷指令应用。

## 快速入门

快捷指令是一个具有如下结构的二进制 plist：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>WFWorkflowActions</key>
    <array>
        <!-- Actions go here -->
    </array>
    <key>WFWorkflowClientVersion</key>
    <string>2700.0.4</string>
    <key>WFWorkflowHasOutputFallback</key>
    <false/>
    <key>WFWorkflowIcon</key>
    <dict>
        <key>WFWorkflowIconGlyphNumber</key>
        <integer>59511</integer>
        <key>WFWorkflowIconStartColor</key>
        <integer>4282601983</integer>
    </dict>
    <key>WFWorkflowImportQuestions</key>
    <array/>
    <key>WFWorkflowMinimumClientVersion</key>
    <integer>900</integer>
    <key>WFWorkflowMinimumClientVersionString</key>
    <string>900</string>
    <key>WFWorkflowName</key>
    <string>My Shortcut</string>
    <key>WFWorkflowOutputContentItemClasses</key>
    <array/>
    <key>WFWorkflowTypes</key>
    <array/>
</dict>
</plist>
```

### 最简 Hello World 示例

```xml
<dict>
    <key>WFWorkflowActionIdentifier</key>
    <string>is.workflow.actions.gettext</string>
    <key>WFWorkflowActionParameters</key>
    <dict>
        <key>UUID</key>
        <string>A1B2C3D4-E5F6-7890-ABCD-EF1234567890</string>
        <key>WFTextActionText</key>
        <string>Hello World!</string>
    </dict>
</dict>
<dict>
    <key>WFWorkflowActionIdentifier</key>
    <string>is.workflow.actions.showresult</string>
    <key>WFWorkflowActionParameters</key>
    <dict>
        <key>Text</key>
        <dict>
            <key>Value</key>
            <dict>
                <key>attachmentsByRange</key>
                <dict>
                    <key>{0, 1}</key>
                    <dict>
                        <key>OutputName</key>
                        <string>Text</string>
                        <key>OutputUUID</key>
                        <string>A1B2C3D4-E5F6-7890-ABCD-EF1234567890</string>
                        <key>Type</key>
                        <string>ActionOutput</string>
                    </dict>
                </dict>
                <key>string</key>
                <string>￼</string>
            </dict>
            <key>WFSerializationType</key>
            <string>WFTextTokenString</string>
        </dict>
    </dict>
</dict>
```

## 核心概念（Core Concepts）

### 1. 操作（Actions）
每个操作均具备：
- **标识符**：`is.workflow.actions.<name>`（例如 `is.workflow.actions.showresult`）  
- **参数**：在 `WFWorkflowActionParameters` 中定义的操作专属配置  
- **UUID**：用于引用该操作输出的唯一标识符  

### 2. 变量引用（Variable References）
要使用前一操作的输出：
1. 源操作需设置 `UUID` 参数  
2. 在目标操作的 `attachmentsByRange` 字典中通过 `OutputUUID` 引用该 UUID  
3. 在字符串中变量插入位置使用 `￼`（U+FFFC）作为占位符  
4. 将 `WFSerializationType` 设为 `WFTextTokenString`  

### 3. 控制流（Control Flow）
控制流操作（重复、条件判断、菜单）使用：
- `GroupingIdentifier`：用于关联起始/中间/结束操作的 UUID  
- `WFControlFlowMode`：0=起始，1=中间（else/case），2=结束  

## 常用操作速查表（Common Actions Quick Reference）

| 操作 | 标识符 | 关键参数 |
|------|--------|------------|
| 文本 | `is.workflow.actions.gettext` | `WFTextActionText` |
| 显示结果 | `is.workflow.actions.showresult` | `Text` |
| 请求输入 | `is.workflow.actions.ask` | `WFAskActionPrompt`、`WFInputType` |
| 使用 AI 模型 | `is.workflow.actions.askllm` | `WFLLMPrompt`、`WFLLMModel`、`WFGenerativeResultType` |
| 注释 | `is.workflow.actions.comment` | `WFCommentActionText` |
| URL | `is.workflow.actions.url` | `WFURLActionURL` |
| 获取 URL 内容 | `is.workflow.actions.downloadurl` | `WFURL`、`WFHTTPMethod` |
| 获取天气 | `is.workflow.actions.weather.currentconditions` | （无需参数） |
| 打开应用 | `is.workflow.actions.openapp` | `WFAppIdentifier` |
| 打开 URL | `is.workflow.actions.openurl` | `WFInput` |
| 警告 | `is.workflow.actions.alert` | `WFAlertActionTitle`、`WFAlertActionMessage` |
| 通知 | `is.workflow.actions.notification` | `WFNotificationActionTitle`、`WFNotificationActionBody` |
| 设置变量 | `is.workflow.actions.setvariable` | `WFVariableName`、`WFInput` |
| 获取变量 | `is.workflow.actions.getvariable` | `WFVariable` |
| 数值 | `is.workflow.actions.number` | `WFNumberActionNumber` |
| 列表 | `is.workflow.actions.list` | `WFItems` |
| 字典 | `is.workflow.actions.dictionary` | `WFItems` |
| 重复（按次数） | `is.workflow.actions.repeat.count` | `WFRepeatCount`、`GroupingIdentifier`、`WFControlFlowMode` |
| 重复（逐项） | `is.workflow.actions.repeat.each` | `WFInput`、`GroupingIdentifier`、`WFControlFlowMode` |
| 如果/否则 | `is.workflow.actions.conditional` | `WFInput`、`WFCondition`、`GroupingIdentifier`、`WFControlFlowMode` |
| 从菜单选择 | `is.workflow.actions.choosefrommenu` | `WFMenuPrompt`、`WFMenuItems`、`GroupingIdentifier`、`WFControlFlowMode` |
| 查找照片 | `is.workflow.actions.filter.photos` | `WFContentItemFilter`（参见 FILTERS.md） |
| 删除照片 | `is.workflow.actions.deletephotos` | `photos`（**不是** `WFInput`！） |

## 详细参考文档（Detailed Reference Files）

完整文档请参阅：
- [PLIST_FORMAT.md](PLIST_FORMAT.md) — 完整 plist 结构  
- [ACTIONS.md](ACTIONS.md) — 全部 427 个 WF*Action 标识符与参数  
- [APPINTENTS.md](APPINTENTS.md) — 全部 728 个 AppIntent 操作  
- [PARAMETER_TYPES.md](PARAMETER_TYPES.md) — 所有参数值类型与序列化格式  
- [VARIABLES.md](VARIABLES.md) — 变量引用系统  
- [CONTROL_FLOW.md](CONTROL_FLOW.md) — 重复、条件判断、菜单模式  
- [FILTERS.md](FILTERS.md) — “查找/筛选”类操作（照片、文件等）的内容筛选器  
- [EXAMPLES.md](EXAMPLES.md) — 完整可运行示例  

## 快捷指令签名（Signing Shortcuts）

快捷指令必须签名后方可导入。请使用 macOS `shortcuts` CLI 工具：

```bash
# Sign for anyone to use
shortcuts sign --mode anyone --input MyShortcut.shortcut --output MyShortcut_signed.shortcut

# Sign for people who know you
shortcuts sign --mode people-who-know-me --input MyShortcut.shortcut --output MyShortcut_signed.shortcut
```

签名流程如下：
1. 将 plist 以 XML 格式写入 `.shortcut` 文件  
2. 运行 `shortcuts sign` 添加加密签名（约增加 19KB）  
3. 签名后的文件可直接在 Shortcuts.app 中打开/导入  

## 创建快捷指令的工作流程（Workflow for Creating Shortcuts）

1. **定义操作** — 列出快捷指令应执行的任务  
2. **生成 UUID** — 每个产生输出的操作均需分配唯一 UUID  
3. **构建操作数组** — 为每个操作创建含标识符与参数的字典  
4. **连接变量引用** — 使用 `OutputUUID` 将输出连接至输入  
5. **封装为 plist** — 添加根结构（含图标、名称、版本等）  
6. **写入文件** — 保存为 `.shortcut`（XML plist 格式即可）  
7. **签名** — 运行 `shortcuts sign` 使其可导入  

## 关键规则（Key Rules）

1. **UUID 必须大写**：`A1B2C3D4-E5F6-7890-ABCD-EF1234567890`  
2. **WFControlFlowMode 为整数**：使用 `<integer>0</integer>`，而非 `<string>0</string>`  
3. **范围键（range keys）格式**：`{position, length}` — 例如 `{0, 1}` 表示首字符  
4. **占位符字符**：`￼`（U+FFFC）标记变量插入位置  
5. **控制流需配对结尾**：每个 repeat/if/menu 的起始操作，均需对应一个具有相同 `GroupingIdentifier` 的结束操作  