---
name: vercel
name_zh: Vercel
description: 使用完整的 CLI 参考文档部署应用并管理项目。涵盖部署、项目、域名、环境变量及实时文档访问等命令。
description_zh: 使用完整的 CLI 参考文档部署应用并管理项目。涵盖部署、项目、域名、环境变量及实时文档访问等命令。
metadata: {"clawdbot":{"emoji":"▲","requires":{"bins":["vercel","curl"]}}}
---
# Vercel

完整的 Vercel CLI 参考文档与文档访问功能。

## 适用场景
- 将应用部署到 Vercel
- 管理项目、域名和环境变量
- 运行本地开发服务器
- 查看部署日志与状态
- 查询 Vercel 官方文档

---

## 文档

以 Markdown 格式获取任意 Vercel 文档页面：

```bash
curl -s "https://vercel.com/docs/<path>" -H 'accept: text/markdown'
```

**获取完整站点地图以发现所有可用页面：**
```bash
curl -s "https://vercel.com/docs/sitemap.md" -H 'accept: text/markdown'
```

---

## CLI 命令

### 部署

#### `vercel` / `vercel deploy [path]`
部署当前目录或指定路径。

**选项：**
- `--prod` — 部署至生产环境
- `-e KEY=VALUE` — 设置运行时环境变量
- `-b KEY=VALUE` — 设置构建时环境变量
- `--prebuilt` — 部署预构建产物（需配合 `vercel build` 使用）
- `--force` — 即使内容未变更也强制执行新部署
- `--no-wait` — 不等待部署完成即返回
- `-y, --yes` — 跳过交互提示，使用默认值

**示例：**
```bash
vercel                          # deploy current directory
vercel --prod                   # deploy to production
vercel /path/to/project         # deploy specific path
vercel -e NODE_ENV=production   # with env var
vercel build && vercel --prebuilt  # prebuilt deploy
```

#### `vercel build`
在本地构建项目，输出至 `./vercel/output` 目录。

```bash
vercel build
```

#### `vercel dev [dir]`
启动本地开发服务器。

**选项：**
- `-l, --listen <URI>` — 指定端口/地址（默认：0.0.0.0:3000）

**示例：**
```bash
vercel dev                  # start on port 3000
vercel dev --listen 8080    # start on port 8080
```

---

### 项目管理

#### `vercel link [path]`
将本地目录关联至一个 Vercel 项目。

**选项：**
- `-p, --project <NAME>` — 指定项目名称
- `-y, --yes` — 跳过交互提示

**示例：**
```bash
vercel link
vercel link --yes
vercel link -p my-project
```

#### `vercel projects`
管理项目。

```bash
vercel projects list              # list all projects
vercel projects add <name>        # create new project
vercel projects inspect [name]    # show project details
vercel projects remove <name>     # delete project
```

#### `vercel pull [path]`
从云端拉取项目配置与环境变量。

```bash
vercel pull
```

---

### 环境变量

#### `vercel env`
管理环境变量。

```bash
vercel env list [environment]                    # list env vars
vercel env add <name> [environment]              # add env var
vercel env remove <name> [environment]           # remove env var
vercel env pull [filename]                       # pull to .env.local
```

**环境类型：** `development`、`preview`、`production`

**示例：**
```bash
vercel env list production
vercel env add DATABASE_URL production
vercel env pull .env.local
```

---

### 域名与别名

#### `vercel domains`
管理域名。

```bash
vercel domains list                          # list domains
vercel domains add <domain> <project>        # add domain
vercel domains inspect <domain>              # show domain info
vercel domains remove <domain>               # remove domain
vercel domains buy <domain>                  # purchase domain
vercel domains transfer-in <domain>          # transfer domain to Vercel
```

#### `vercel alias`
管理部署别名。

```bash
vercel alias list                                    # list aliases
vercel alias set <deployment> <alias>                # create alias
vercel alias remove <alias>                          # remove alias
```

**示例：**
```bash
vercel alias set my-app-abc123.vercel.app my-app.vercel.app
vercel alias set my-app-abc123.vercel.app custom-domain.com
```

---

### 部署

#### `vercel ls [app]` / `vercel list`
列出所有部署。

```bash
vercel ls
vercel ls my-project
```

#### `vercel inspect [id]`
显示某次部署的详细信息。

```bash
vercel inspect <deployment-url-or-id>
```

#### `vercel logs <url|id>`
查看某次部署的运行时日志。

**选项：**
- `-j, --json` — 以 JSON 格式输出（兼容 jq 工具）

**示例：**
```bash
vercel logs my-app.vercel.app
vercel logs <deployment-id> --json
vercel logs <deployment-id> --json | jq 'select(.level == "error")'
```

#### `vercel promote <url|id>`
将部署提升至生产环境。

```bash
vercel promote <deployment-url-or-id>
```

#### `vercel rollback [url|id]`
回滚至上一次部署。

```bash
vercel rollback
vercel rollback <deployment-url-or-id>
```

#### `vercel redeploy [url|id]`
重建并重新部署上一次的部署。

```bash
vercel redeploy <deployment-url-or-id>
```

#### `vercel rm <id>` / `vercel remove`
删除某次部署。

```bash
vercel rm <deployment-url-or-id>
```

---

### 认证与团队

```bash
vercel login [email]      # log in or create account
vercel logout             # log out
vercel whoami             # show current user
vercel switch [scope]     # switch between scopes/teams
vercel teams              # manage teams
```

---

### 其他命令

```bash
vercel open               # open project in dashboard
vercel init [example]     # initialize from example
vercel install [name]     # install marketplace integration
vercel integration        # manage integrations
vercel certs              # manage SSL certificates
vercel dns                # manage DNS records
vercel bisect             # binary search for bug-introducing deployment
```

---

## 全局选项

所有命令均支持以下选项：

| 选项 | 说明 |
|------|------|
| `-h, --help` | 显示帮助信息 |
| `-v, --version` | 显示版本号 |
| `-d, --debug` | 启用调试模式 |
| `-t, --token <TOKEN>` | 认证令牌 |
| `-S, --scope` | 设置作用域/团队 |
| `--cwd <DIR>` | 工作目录 |
| `-A, --local-config <FILE>` | vercel.json 文件路径 |
| `--no-color` | 禁用彩色输出 |

---

## 快速参考

| 任务 | 命令 |
|------|------|
| 部署 | `vercel` 或 `vercel --prod` |
| 开发服务器 | `vercel dev` |
| 关联项目 | `vercel link` |
| 列出部署 | `vercel ls` |
| 查看日志 | `vercel logs <url>` |
| 添加环境变量 | `vercel env add <name> <env>` |
| 拉取环境变量 | `vercel env pull` |
| 回滚 | `vercel rollback` |
| 添加域名 | `vercel domains add <domain> <project>` |
| 获取文档 | `curl -s "https://vercel.com/docs/<path>" -H 'accept: text/markdown'` |
| 文档站点地图 | `curl -s "https://vercel.com/docs/sitemap.md" -H 'accept: text/markdown'` |