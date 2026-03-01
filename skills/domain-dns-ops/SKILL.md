---
name: domain-dns-ops
name_zh: 域名DNS运维
description: >
description_zh: >
  面向 Peter 的跨平台域名/DNS 运维工具（支持 Cloudflare、DNSimple、Namecheap）。可用于 Cloudflare 区域入驻、域名服务器（NS）切换、配置重定向（页面规则/Page Rules / 规则集/Rulesets / Worker）、更新重定向 Worker 映射，以及 DNS/HTTP 验证。权威信源：~/Projects/manager。
---
# 域名/DNS 运维（Peter）

本 skill 仅为轻量级路由层：以 `~/Projects/manager` 为唯一事实来源，执行仓库脚本，并严格遵循检查清单。

## 权威信源（请优先阅读）

- `~/Projects/manager/DOMAINS.md`（域名 → 目标地址映射；注册商提示；排除项）  
- `~/Projects/manager/DNS.md`（Cloudflare 入驻流程 + DNS/重定向检查清单）  
- `~/Projects/manager/redirect-worker.ts` 与 `~/Projects/manager/redirect-worker-mapping.md`（Worker 重定向实现）

## 黄金路径（新自定义域名 → Cloudflare → 重定向）

1. **确定路由模型**
   - 页面规则（Page Rule）重定向（小规模、按区域配置）。  
   - 规则集（Rulesets）/批量重定向（账户级；需 token 权限）。  
   - Worker 路由（备用方案；依赖 `redirect-worker`）。  
2. **Cloudflare 区域（Zone）**
   - 在 UI 中创建区域，再通过 `cli4` 确认：  
     - `cli4 --get name=example.com /zones`  
3. **域名服务器（Nameservers）**
   - 若注册商为 Namecheap：执行 `cd ~/Projects/manager && source profile && bin/namecheap-set-ns example.com emma.ns.cloudflare.com scott.ns.cloudflare.com`  
   - 若注册商为 DNSimple：参阅 `~/Projects/manager/DNS.md` 中关于委托 API 的说明。  
4. **DNS 占位符（确保 Cloudflare 可终止 HTTPS）**
   - 已代理的根域名 `A` 与通配符 `A` → `192.0.2.1`（详见 `~/Projects/manager/DNS.md` 中的确切 `cli4` 调用方式）。  
5. **重定向配置**
   - 若使用页面规则（Page Rules）：采用 `cli4 --post ... /pagerules` 模板（来自 `~/Projects/manager/DNS.md`）。  
   - 若使用 Worker：更新映射文件（`~/Projects/manager/redirect-worker-mapping.md`），并按 `~/Projects/manager/DNS.md` 部署/绑定路由。  
6. **验证**
   - DNS：运行 `dig +short example.com @1.1.1.1`（预期返回 Cloudflare Anycast 地址）。  
   - HTTPS 重定向：运行 `curl -I https://example.com`（预期返回 `301`）。  

## 常见运维操作

- **Cloudflare Token 健康检查：** `source ~/.profile`（优先使用 `CLOUDFLARE_API_TOKEN`；`CF_API_TOKEN` 作为备用）。  
- **禁用“屏蔽 AI 爬虫”功能：** `cd ~/Projects/manager && source profile && bin/cloudflare-ai-bots status` / `bin/cloudflare-ai-bots disable`。  

## 修改后操作（提交/推送）

若您修改了 `~/Projects/manager`（文档、Worker、脚本、映射表等），也需同步提交至该仓库。

1. 审查变更：`cd ~/Projects/manager && git status && git diff`  
2. 暂存变更：`git add <paths>`  
3. 提交（遵循约定式提交规范）：`git commit -m "feat: …"` / `fix:` / `docs:` / `chore:`  
4. 仅在明确要求时推送：`git push origin main`  

## 安全守则

- 未经明确授权，不得触碰 `.md` 的传奇域名或 `steipete.md`；操作前请核查 `~/Projects/manager/DOMAINS.md`。  
- 排查 Cloudflare “无效域名服务器”错误前，请先确认注册商是否正确（常见原因为“注册商选择错误”）。  
- 优先采用可逆操作；每次变更后均需验证（NS → DNS → 重定向）。  