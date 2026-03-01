---
name: vercel-deploy
name_zh: Vercel可申领部署
description: 将应用与网站部署至 Vercel。当用户提出部署类请求（例如“部署我的应用”、“将此部署至生产环境”、“创建预览部署”、“部署并给我链接”或“上线此内容”）时，请使用该 skill。无需身份认证——返回预览 URL 与可申领的部署链接。
description_zh: 将应用与网站部署至 Vercel。当用户提出部署类请求（例如“部署我的应用”、“将此部署至生产环境”、“创建预览部署”、“部署并给我链接”或“上线此内容”）时，请使用该 skill。无需身份认证——返回预览 URL 与可申领的部署链接。
metadata:
  author: vercel
  version: "1.0.0"
---
# Vercel Deploy

即时将任意项目部署至 Vercel。无需身份认证。

## 工作原理

1. 将您的项目打包为 tarball（排除 `node_modules` 和 `.git`）
2. 依据 `package.json` 自动识别框架
3. 上传至部署服务
4. 返回 **预览 URL**（已上线的网站）与 **申领 URL**（用于将部署转移至您的 Vercel 账户）

## 使用方法

```bash
bash /mnt/skills/user/vercel-deploy/scripts/deploy.sh [path]
```

**参数：**
- `path` — 待部署目录，或一个 `.tgz` 文件（默认为当前目录）

**示例：**

```bash
# Deploy current directory
bash /mnt/skills/user/vercel-deploy/scripts/deploy.sh

# Deploy specific project
bash /mnt/skills/user/vercel-deploy/scripts/deploy.sh /path/to/project

# Deploy existing tarball
bash /mnt/skills/user/vercel-deploy/scripts/deploy.sh /path/to/project.tgz
```

## 输出结果

```
Preparing deployment...
Detected framework: nextjs
Creating deployment package...
Deploying...
✓ Deployment successful!

Preview URL: https://skill-deploy-abc123.vercel.app
Claim URL:   https://vercel.com/claim-deployment?code=...
```

该脚本还会向标准输出（stdout）输出 JSON 格式数据，便于程序化调用：

```json
{
  "previewUrl": "https://skill-deploy-abc123.vercel.app",
  "claimUrl": "https://vercel.com/claim-deployment?code=...",
  "deploymentId": "dpl_...",
  "projectId": "prj_..."
}
```

## 框架识别

脚本通过分析 `package.json` 自动识别框架。支持的框架包括：

- **React**：Next.js、Gatsby、Create React App、Remix、React Router  
- **Vue**：Nuxt、Vitepress、Vuepress、Gridsome  
- **Svelte**：SvelteKit、Svelte、Sapper  
- **其他前端框架**：Astro、Solid Start、Angular、Ember、Preact、Docusaurus  
- **后端框架**：Express、Hono、Fastify、NestJS、Elysia、h3、Nitro  
- **构建工具**：Vite、Parcel  
- **其他**：Blitz、Hydrogen、RedwoodJS、Storybook、Sanity 等

对于纯静态 HTML 项目（不含 `package.json`），框架被设为 `null`。

## 静态 HTML 项目

对于不含 `package.json` 的项目：
- 若存在单个 `.html` 文件且其文件名不为 `index.html`，则自动重命名该文件  
- 此举确保页面可通过根 URL（`/`）直接访问

## 向用户呈现结果

始终同时展示两个 URL：

```
✓ Deployment successful!

Preview URL: https://skill-deploy-abc123.vercel.app
Claim URL:   https://vercel.com/claim-deployment?code=...

View your site at the Preview URL.
To transfer this deployment to your Vercel account, visit the Claim URL.
```

## 故障排查

### 网络出口错误

若因网络限制（在 claude.ai 上较常见）导致部署失败，请告知用户：

```
Deployment failed due to network restrictions. To fix this:

1. Go to https://claude.ai/settings/capabilities
2. Add *.vercel.com to the allowed domains
3. Try deploying again
```