---
name: deploy-agent
name_zh: 部署智能体
description: 全栈应用的多步部署 agent。构建 → 测试 → GitHub → Cloudflare Pages，每一步均需人工审批。
description_zh: 全栈应用的多步部署 agent。构建 → 测试 → GitHub → Cloudflare Pages，每一步均需人工审批。
metadata:
  clawdbot:
    emoji: "🚀"
    requires:
      bins: ["gh", "wrangler", "git"]
---
# deploy-agent

通过多步工作流部署全栈应用，每阶段均需人工审批。

## 快速开始

```bash
# Install via ClawdHub
clawdhub install deploy-agent

# Initialize a new deployment
deploy-agent init my-app

# Check status
deploy-agent status my-app

# Continue through steps
deploy-agent continue my-app
```

## 工作流步骤

| 步骤 | 命令 | 描述 | 是否需要审批 |
|------|------|------|----------------|
| 1 | `deploy-agent init <name>` | 启动部署 | ✅ 设计阶段 |
| 2 | `deploy-agent build <name>` | 构建应用 | ✅ 测试前 |
| 3 | `deploy-agent test <name>` | 本地测试 | ✅ 推送至 GitHub 前 |
| 4 | `deploy-agent push <name>` | 推送至 GitHub | ✅ 推送至 Cloudflare 前 |
| 5 | `deploy-agent deploy <name>` | 部署至 Cloudflare | ✅ 最终步骤 |

## 命令

### 初始化部署  
```bash
deploy-agent init my-app
```  
创建新的部署状态，并等待设计输入。

### 查询状态  
```bash
deploy-agent status my-app
```  
显示当前步骤、审批状态及部署信息。

### 继续  
```bash
deploy-agent continue my-app
```  
提供当前步骤下一步操作指引。

### 构建（第 2 步）  
```bash
deploy-agent build my-app
```  
在使用 C.R.A.B 完成设计后，运行此命令构建应用。

### 测试（第 3 步）  
```bash
deploy-agent test my-app
```  
在推送前验证应用是否在本地正常运行。

### 推送至 GitHub（第 4 步）  
```bash
deploy-agent push my-app [repo-name]
```  
创建 GitHub 仓库并推送代码。默认仓库名 = 应用名。

### 部署至 Cloudflare（第 5 步）  
```bash
deploy-agent deploy my-app [custom-domain]
```  
部署至 Cloudflare Pages。默认域名：`{name}.sheraj.org`

### 取消  
```bash
deploy-agent cancel my-app
```  
中止并清理部署。

### 列出  
```bash
deploy-agent list
```  
显示所有活跃部署。

## 示例会话

```bash
# Start new deployment
$ deploy-agent init my-blog
🚀 Deployment initialized: my-blog
Step 1: Design your app with C.R.A.B

# ... design phase with C.R.A.B ...

$ deploy-agent build my-blog
🚀 Build complete! Step 2: Local Testing
Start dev server: cd my-blog && npm run dev

# ... test locally ...

$ deploy-agent push my-blog
🚀 GitHub repository ready!
Say 'deploy-agent deploy my-blog' to deploy to Cloudflare

$ deploy-agent deploy my-blog my-blog.sheraj.org
🎉 Deployment complete!
App live at: https://my-blog.sheraj.org
```

## 状态管理

状态存储位置：`~/.clawdbot/skills/deploy-agent/state/{deployment-name}.json`

```json
{
  "name": "my-blog",
  "step": 5,
  "status": "deployed",
  "created_at": "2026-01-18T08:00:00Z",
  "repo_url": "https://github.com/user/my-blog",
  "domain": "https://my-blog.sheraj.org"
}
```

## 要求

| 工具 | 用途 |
|------|------|
| `gh` | GitHub 仓库创建与管理 |
| `wrangler` | Cloudflare Pages 部署 |
| `git` | 版本控制 |
| `jq` | JSON 解析（用于状态管理） |

## 配置

Cloudflare 令牌应配置于 `~/.wrangler.toml`：  
```toml
[account]
api_token = "your-cloudflare-token"
```

## 注意事项

- 每次部署相互独立；  
- 状态在会话间持久化；  
- 每个主要步骤均需人工审批；  
- 可随时使用 “cancel” 中止。

---

## Next.js + Cloudflare D1 部署指南

本节涵盖在 Cloudflare Pages 上部署带 D1 的 Next.js 应用时常见陷阱及修复方法。

### 部署前检查清单

| 检查项 | 命令 | 失败时修复方法 |
|--------|------|----------------|
| Next.js 版本 | `npm list next` | `npm install next@15.5.2` |
| package lock 同步 | `rm -rf node_modules package-lock.json && npm install` | 提交 lock 文件 |
| Cloudflare 适配器 | `npm list @cloudflare/next-on-pages` | `npm install -D @cloudflare/next-on-pages` |
| wrangler 已安装 | `npm list wrangler` | `npm install -D wrangler` |

### 必需配置

**1. package.json**  
```json
{
  "dependencies": {
    "next": "15.5.2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@cloudflare/next-on-pages": "^1.13.16",
    "wrangler": "^4.x"
  }
}
```

**2. wrangler.toml**  
```toml
name = "my-app"
compatibility_date = "2026-01-18"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "your-db-id"
```

**3. API 路由（每个文件）**  
```typescript
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function GET() {
  const { env } = getRequestContext();
  const { results } = await env.DB.prepare("SELECT * FROM tasks").all();
  return Response.json({ data: results });
}
```

### Cloudflare Pages 构建设置

| 设置 | 值 |
|------|----|
| 构建命令 | `npx @cloudflare/next-on-pages` |
| 输出目录 | `.vercel/output/static` |
| Functions | 启用（用于 D1 API 路由） |

### 常见问题与修复

| 问题 | 错误 | 修复方法 |
|------|------|------------|
| lock 文件不匹配 | `npm ci can only install packages when your package.json and package-lock.json are in sync` | `rm -rf node_modules package-lock.json && npm install && git add package-lock.json` |
| Next.js 版本 | `peer next@">=14.3.0 && <=15.5.2"` 来自 @cloudflare/next-on-pages | 降级至 `next: "15.5.2"` |
| API 路由未部署至边缘 | `The following routes were not configured to run with the Edge Runtime` | 添加 `export const runtime = 'edge';` |
| D1 访问模式 | 使用 `context.env.DB` | 改用 `getRequestContext().env.DB` |
| 类型缺失 | D1 bindings 的 TypeScript 错误 | 创建 `env.d.ts`，含 CloudflareEnv 接口 |

### CSS 修复（滚动条闪烁）
```css
html {
  overflow-x: hidden;
  scrollbar-gutter: stable;
}
body {
  overflow-x: hidden;
}
```

### 部署后操作

1. Cloudflare 控制台 → Settings → Functions  
2. 添加 D1 binding：变量名 `DB` → 选择您的数据库

### 参考文档

- 完整指南：`docs/issues/nextjs-cloudflare-d1-deployment.md`  
- Cloudflare 文档：https://developers.cloudflare.com/pages/framework-guides/nextjs/