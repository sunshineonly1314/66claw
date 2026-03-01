---
name: nudocs
name_zh: NuDocs
description: 通过 Nudocs.ai 上传、编辑和导出文档。适用于创建可共享的文档链接以供协作编辑、将 Markdown/文档上传至 Nudocs 进行富文本编辑，或拉取已编辑的内容。当用户触发“发送到 nudocs”、“上传到 nudocs”、“在 nudocs 中编辑”、“从 nudocs 拉取”、“获取 nudocs 链接”、“显示我的 nudocs 文档”等指令时激活。
description_zh: 通过 Nudocs.ai 上传、编辑和导出文档。适用于创建可共享的文档链接以供协作编辑、将 Markdown/文档上传至 Nudocs 进行富文本编辑，或拉取已编辑的内容。当用户触发“发送到 nudocs”、“上传到 nudocs”、“在 nudocs 中编辑”、“从 nudocs 拉取”、“获取 nudocs 链接”、“显示我的 nudocs 文档”等指令时激活。
homepage: https://nudocs.ai
metadata:
  clawdbot:
    emoji: "📄"
    requires:
      bins: ["nudocs"]
    install:
      - id: npm
        kind: node
        package: "@nutrient-sdk/nudocs-cli"
        bins: ["nudocs"]
        label: "安装 Nudocs CLI（npm）"
---
# Nudocs

将文档上传至 Nudocs.ai 进行富文本编辑，获取可共享链接，并拉取编辑结果。

## 设置

1. 安装 CLI：
```bash
npm install -g @nutrient-sdk/nudocs-cli
```

2. 在 https://nudocs.ai 获取您的 API 密钥（登录后点击“集成”）

3. 配置密钥：
```bash
# Option 1: Environment variable
export NUDOCS_API_KEY="nudocs_your_key_here"

# Option 2: Config file
mkdir -p ~/.config/nudocs
echo "nudocs_your_key_here" > ~/.config/nudocs/api_key
```

## 命令

```bash
nudocs upload <file>              # Upload and get edit link
nudocs list                       # List all documents
nudocs link [ulid]                # Get edit link (last upload if no ULID)
nudocs pull [ulid] [--format fmt] # Download document (default: docx)
nudocs delete <ulid>              # Delete a document
nudocs config                     # Show configuration
```

## 工作流

### 上传流程
1. 创建或撰写文档内容  
2. 保存为 Markdown（或其他受支持格式）  
3. 运行：`nudocs upload <file>`  
4. 将返回的编辑链接分享给用户  

### 拉取流程
1. 用户请求取回文档  
2. 运行：`nudocs pull [ulid] --format <fmt>`  
3. 读取并呈现所下载的文件  

### 格式选择

| 场景 | 推荐格式 |
|------|----------|
| 用户使用富文本格式编辑 | `docx`（默认） |
| 纯文本/代码类内容 | `md` |
| 最终交付/共享 | `pdf` |

详见 `references/formats.md` 查看完整格式支持列表。

## 自然语言触发词

识别以下用户意图：

**上传/发送**：
- “发送到 nudocs”
- “上传到 nudocs”  
- “在 nudocs 中打开”
- “在 nudocs 中编辑此内容”
- “让我在 nudocs 中编辑此内容”
- “将此内容放入 nudocs”

**拉取/获取**：
- “拉回它”
- “从 nudocs 拉取”
- “获取该文档”
- “从 nudocs 获取”
- “从 nudocs 下载”
- “获取更新后的版本”
- “我修改了什么”
- “获取我的编辑”

**链接**：
- “获取 nudocs 链接”
- “分享链接”
- “该文档在哪”
- “nudocs 网址”

**列表**：
- “显示我的 nudocs”
- “列出我的文档”
- “我有哪些文档”
- “我的 nudocs 文档”

## 文档最佳实践

上传前确保结构良好：
- 清晰的标题层级（H1 → H2 → H3）  
- 一致的段落间距  
- 合适的列表格式  
- 简洁的段落（3–5 句）  

详见 `references/document-design.md` 查看模板与指南。

## 示例会话

```
User: Write me a blog post about remote work and send it to Nudocs

Agent:
1. Writes blog-remote-work.md with proper structure
2. Runs: nudocs upload blog-remote-work.md
3. Returns: "Here's your Nudocs link: https://nudocs.ai/file/01ABC..."

User: *edits in Nudocs, adds formatting, images*
User: Pull that back

Agent:
1. Runs: nudocs pull --format docx
2. Reads the downloaded file
3. Returns: "Got your updated document! Here's what changed..."
```

## 错误处理

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| “未找到 API 密钥” | 凭据缺失 | 设置 NUDOCS_API_KEY 环境变量或创建配置文件 |
| “DOCUMENT_LIMIT_REACHED” | 免费版限制（10 份文档） | 删除旧文档或升级至 Pro 版 |
| “未授权” | API 密钥无效 | 在 Nudocs 设置中重新生成密钥 |
| “未提供 ULID” | 缺少文档 ID | 指定 ULID 或先上传一份文档 |

## 相关链接

- CLI：https://github.com/PSPDFKit/nudocs-cli  
- MCP Server：https://github.com/PSPDFKit/nudocs-mcp-server  
- Nudocs：https://nudocs.ai  