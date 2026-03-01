---
name: readwise
name_zh: Readwise
description: 访问 Readwise 的高亮内容及 Reader 中保存的文章  
description_zh: 访问 Readwise 的高亮内容及 Reader 中保存的文章
homepage: https://readwise.io  
metadata: {"clawdbot":{"emoji":"📚","requires":{"bins":["node"],"env":["READWISE_TOKEN"]},"primaryEnv":"READWISE_TOKEN"}}
---
# Readwise 与 Reader 技能

访问您的 Readwise 高亮内容及 Reader 中保存的文章。

## 设置

从以下地址获取您的 API Token：https://readwise.io/access_token  

设置环境变量：  
```bash
export READWISE_TOKEN="your_token_here"
```  

或在 ~/.clawdbot/clawdbot.json 文件的 "env" 字段下添加该变量。

## Readwise（高亮内容）

### 列出书籍/来源  
```bash
node {baseDir}/scripts/readwise.mjs books [--limit 20]
```  

### 获取某本书籍中的高亮内容  
```bash
node {baseDir}/scripts/readwise.mjs highlights [--book-id 123] [--limit 20]
```  

### 搜索高亮内容  
```bash
node {baseDir}/scripts/readwise.mjs search "query"
```  

### 导出全部高亮内容（分页）  
```bash
node {baseDir}/scripts/readwise.mjs export [--updated-after 2024-01-01]
```  

## Reader（已保存文章）

### 列出文档  
```bash
node {baseDir}/scripts/reader.mjs list [--location new|later|archive|feed] [--category article|book|podcast|...] [--limit 20]
```  

### 获取文档详情  
```bash
node {baseDir}/scripts/reader.mjs get <document_id>
```  

### 将 URL 保存至 Reader  
```bash
node {baseDir}/scripts/reader.mjs save "https://example.com/article" [--location later]
```  

### 搜索 Reader  
```bash
node {baseDir}/scripts/reader.mjs search "query"
```  

## 注意事项  
- 速率限制：Readwise 为每分钟 20 次请求；Reader 的限制视具体接口而定  
- 所有命令均输出 JSON 格式，便于解析  
- 在任意命令后使用 `--help` 可查看可用选项  