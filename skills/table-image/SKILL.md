---
name: table-image
name_zh: 表格图像
description: 为便于 Telegram 等消息应用阅读，将表格渲染为 PNG 图像。当需展示表格数据时使用。
description_zh: 为便于 Telegram 等消息应用阅读，将表格渲染为 PNG 图像。当需展示表格数据时使用。
metadata: {"clawdis":{"emoji":"📊"}}
---
# Table Image Skill

将 Markdown 表格渲染为 PNG 图像，适用于不支持 Markdown 表格的消息平台。

## 前置条件

安装 tablesnap：

```bash
go install github.com/joargp/tablesnap/cmd/tablesnap@latest
```  

或从源码构建：  
```bash
git clone https://github.com/joargp/tablesnap.git
cd tablesnap
go build -o tablesnap ./cmd/tablesnap
```  

## 使用方法

```bash
echo "| Header 1 | Header 2 |
|----------|----------|
| Data 1   | Data 2   |" | tablesnap -o /tmp/table.png
```  

然后使用 `MEDIA:/tmp/table.png` 发送图像  

## 选项

| 标志 | 默认值 | 描述 |
|------|--------|------|
| `-i` | stdin | 输入文件 |
| `-o` | stdout | 输出文件 |
| `--theme` | dark | 主题：`dark` 或 `light` |
| `--font-size` | 14 | 字体大小（像素） |
| `--padding` | 10 | 单元格内边距（像素） |

## Emoji 支持

**内置支持**（开箱即用）：✅ ❌ 🔴 🟢 🟡 ⭕ ⚠️  

**完整 emoji 支持**（需一次性下载）：  
```bash
tablesnap emojis install
```  

未安装完整 emoji 集时，不支持的 emoji 将显示为 □。

## 示例工作流程

```bash
# Create table image
echo "| Task | Status |
|------|--------|
| Build | ✅ |
| Deploy | 🚀 |" | tablesnap -o /tmp/table.png

# Send in reply
MEDIA:/tmp/table.png
```  

## 注意事项

- 默认使用深色主题（适配 Telegram/Discord 深色模式）  
- 自动缩放以适配内容  
- 输出体积约 10–20 KB（适合消息传输）  
- 跨平台（嵌入 Inter 字体）  

## 相关链接

- [tablesnap 仓库](https://github.com/joargp/tablesnap)