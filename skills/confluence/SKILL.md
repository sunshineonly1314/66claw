---
name: confluence
name_zh: Confluence
description: 使用 confluence-cli 搜索和管理 Confluence 页面与空间。阅读文档、创建页面、浏览空间。
description_zh: 使用 confluence-cli 搜索和管理 Confluence 页面与空间。阅读文档、创建页面、浏览空间。
homepage: https://github.com/pchuri/confluence-cli
metadata: {"clawdbot":{"emoji":"📄","primaryEnv":"CONFLUENCE_TOKEN","requires":{"bins":["confluence"],"env":["CONFLUENCE_TOKEN"]},"install":[{"id":"npm","kind":"node","package":"confluence-cli","bins":["confluence"],"label":"Install confluence-cli (npm)"}]}}
---
# Confluence

使用 confluence-cli 搜索和管理 Confluence 页面。

## 必需：首次设置

在使用本 skill 前，请完成以下步骤：

**步骤 1：安装 CLI**

```bash
npm install -g confluence-cli
```

**步骤 2：获取 API token**

1. 访问 https://id.atlassian.com/manage-profile/security/api-tokens  
2. 点击“Create API token”  
3. 为其指定一个标签（例如：“confluence-cli”）  
4. 复制该 token

**步骤 3：配置 CLI**

```bash
confluence init
```

当系统提示时，请输入：  
- **Domain（域名）**：`yourcompany.atlassian.net`（不包含 https://）  
- **Email（邮箱）**：您的 Atlassian 账户邮箱  
- **API token（API token）**：粘贴步骤 2 中复制的 token

**步骤 4：验证设置**

```bash
confluence spaces
```

若您能看到自己的空间列表，则说明 Confluence 已准备就绪，可以开始使用。

---

## 搜索页面

```bash
confluence search "deployment guide"
```

## 阅读页面

```bash
confluence read <page-id>
```

页面 ID 位于 URL 中：`https://yoursite.atlassian.net/wiki/spaces/SPACE/pages/123456/Title` → ID 为 `123456`

## 获取页面信息

```bash
confluence info <page-id>
```

## 按标题查找页面

```bash
confluence find "Page Title"
```

## 列出空间

```bash
confluence spaces
```

## 创建页面

```bash
confluence create "Page Title" SPACEKEY --body "Page content here"
```

## 创建子页面

```bash
confluence create-child "Child Page Title" <parent-page-id> --body "Content"
```

或从文件创建：

```bash
confluence create-child "Page Title" <parent-id> --file content.html --format storage
```

## 更新页面

```bash
confluence update <page-id> --body "Updated content"
```

或从文件更新：

```bash
confluence update <page-id> --file content.html --format storage
```

## 列出子页面

```bash
confluence children <page-id>
```

## 导出带附件的页面

```bash
confluence export <page-id> --output ./exported-page/
```

## 提示

- 配置中的 Domain 不应包含 `https://` —— 仅需 `yourcompany.atlassian.net`  
- 当内容采用 Confluence 存储格式（类 HTML 格式）时，请使用 `--format storage`  
- 页面 ID 为纯数字，可在页面 URL 中找到  
- 配置文件存储于 `~/.confluence-cli/config.json`