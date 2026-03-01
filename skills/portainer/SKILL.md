---
name: portainer
name_zh: Portainer
description: 通过 Portainer API 控制 Docker 容器与堆栈。列出容器、启动/停止/重启容器、查看日志，并从 Git 重新部署堆栈。
description_zh: 通过 Portainer API 控制 Docker 容器与堆栈。列出容器、启动/停止/重启容器、查看日志，并从 Git 重新部署堆栈。
metadata: {"clawdbot":{"emoji":"🐳","requires":{"bins":["curl","jq"],"env":["PORTAINER_API_KEY"]},"primaryEnv":"PORTAINER_API_KEY"}}
---
# 🐳 Portainer Skill

```
    ╔═══════════════════════════════════════════════════════════╗
    ║                                                           ║
    ║   🐳  P O R T A I N E R   C O N T R O L   C L I  🐳      ║
    ║                                                           ║
    ║       Manage Docker containers via Portainer API          ║
    ║            Start, stop, deploy, redeploy                  ║
    ║                                                           ║
    ╚═══════════════════════════════════════════════════════════╝
```

> *"Docker containers? I'll handle them from my lily pad."* 🐸

---

## 📖 本 skill 的功能

**Portainer Skill** 通过 Portainer 的 REST API，赋予你对 Docker 基础设施的控制能力。无需操作 Web UI，即可管理容器、堆栈与部署。

**功能特性：**
- 📊 **状态** — 检查 Portainer 服务器状态
- 🖥️ **端点** — 列出所有 Docker 环境
- 📦 **容器** — 列出、启动、停止、重启容器
- 📚 **堆栈** — 列出并管理 Docker Compose 堆栈
- 🔄 **重新部署** — 从 Git 拉取并重新部署堆栈
- 📜 **日志** — 查看容器日志

---

## ⚙️ 要求

| 项目 | 说明 |
|------|---------|
| **Portainer** | 版本 2.x，启用 API 访问 |
| **工具** | `curl`、`jq` |
| **认证** | API 访问令牌 |

### 设置步骤

1. **从 Portainer 获取 API 令牌：**
   - 登录 Portainer Web UI
   - 点击用户名 → 我的账户
   - 滚动至“访问令牌” → 添加访问令牌
   - 复制该令牌（此后将无法再次查看！）

2. **配置凭据：**
   ```bash
   # Add to ~/.clawdbot/.env
   PORTAINER_URL=https://your-portainer-server:9443
   PORTAINER_API_KEY=ptr_your_token_here
   ```

3. **准备就绪！** 🚀

---

## 🛠️ 命令

### `status` — 检查 Portainer 服务器

```bash
./portainer.sh status
```

**输出：**
```
Portainer v2.27.3
```

---

### `endpoints` — 列出环境

```bash
./portainer.sh endpoints
```

**输出：**
```
3: portainer (local) - ✓ online
4: production (remote) - ✓ online
```

---

### `containers` — 列出容器

```bash
# List containers on default endpoint (4)
./portainer.sh containers

# List containers on specific endpoint
./portainer.sh containers 3
```

**输出：**
```
steinbergerraum-web-1    running    Up 2 days
cora-web-1               running    Up 6 weeks
minecraft                running    Up 6 weeks (healthy)
```

---

### `stacks` — 列出全部堆栈

```bash
./portainer.sh stacks
```

**输出：**
```
25: steinbergerraum - ✓ active
33: cora - ✓ active
35: minecraft - ✓ active
4: pulse-website - ✗ inactive
```

---

### `stack-info` — 堆栈详情

```bash
./portainer.sh stack-info 25
```

**输出：**
```json
{
  "Id": 25,
  "Name": "steinbergerraum",
  "Status": 1,
  "EndpointId": 4,
  "GitConfig": "https://github.com/user/repo",
  "UpdateDate": "2026-01-25T08:44:56Z"
}
```

---

### `redeploy` — 拉取并重新部署堆栈 🔄

```bash
./portainer.sh redeploy 25
```

**输出：**
```
✓ Stack 'steinbergerraum' redeployed successfully
```

此操作将：
1. 从 Git 拉取最新代码
2. 如需则重建容器
3. 重启堆栈

---

### `start` / `stop` / `restart` — 容器控制

```bash
# Start a container
./portainer.sh start steinbergerraum-web-1

# Stop a container
./portainer.sh stop steinbergerraum-web-1

# Restart a container
./portainer.sh restart steinbergerraum-web-1

# Specify endpoint (default: 4)
./portainer.sh restart steinbergerraum-web-1 4
```

**输出：**
```
✓ Container 'steinbergerraum-web-1' restarted
```

---

### `logs` — 查看容器日志

```bash
# Last 100 lines (default)
./portainer.sh logs steinbergerraum-web-1

# Last 50 lines
./portainer.sh logs steinbergerraum-web-1 4 50
```

---

## 🎯 示例工作流

### 🚀 “部署网站更新”
```bash
# After merging PR
./portainer.sh redeploy 25
./portainer.sh logs steinbergerraum-web-1 4 20
```

### 🔧 “调试容器”
```bash
./portainer.sh containers
./portainer.sh logs cora-web-1
./portainer.sh restart cora-web-1
```

### 📊 “系统概览”
```bash
./portainer.sh status
./portainer.sh endpoints
./portainer.sh containers
./portainer.sh stacks
```

---

## 🔧 故障排除

### ❌ “需要身份认证 / 仓库未找到”

**问题：** 堆栈重新部署因 Git 认证错误而失败

**解决方案：** 堆栈需配置 `repositoryGitCredentialID` 参数。脚本会自动从现有堆栈配置中读取该参数。

---

### ❌ “未找到容器”

**问题：** 容器名称不匹配

**解决方案：** 使用 `./portainer.sh containers` 中显示的确切名称：
- 使用完整名称：`steinbergerraum-web-1`，而非 `steinbergerraum`
- 名称区分大小写

---

### ❌ “PORTAINER_URL 和 PORTAINER_API_KEY 必须设置”

**问题：** 凭据未配置

**解决方案：**
```bash
# Add to ~/.clawdbot/.env
echo "PORTAINER_URL=https://your-server:9443" >> ~/.clawdbot/.env
echo "PORTAINER_API_KEY=ptr_your_token" >> ~/.clawdbot/.env
```

---

## 🔗 与 Clawd 集成

```
"Redeploy the website"
→ ./portainer.sh redeploy 25

"Show me running containers"
→ ./portainer.sh containers

"Restart the Minecraft server"
→ ./portainer.sh restart minecraft

"What stacks do we have?"
→ ./portainer.sh stacks
```

---

## 📜 更新日志

| 版本 | 日期 | 更改内容 |
|---------|------|---------|
| 1.0.0 | 2026-01-25 | 初始发布 |

---

## 🐸 致谢

```
  @..@
 (----)
( >__< )   "Containers are just fancy lily pads
 ^^  ^^     for your code to hop around!"
```

**作者：** Andy Steinberger（并得到他的 Clawdbot Owen the Frog 🐸 协助）  
**技术支持：** [Portainer](https://portainer.io/) API  
**所属系列：** [Clawdbot](https://clawdhub.com) Skills 集合

---

<div align="center">

**为 Clawdbot 社区倾情打造 💚**

*Ribbit!* 🐸

</div>