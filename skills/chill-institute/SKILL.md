---
name: chill-institute
name_zh: Chill学院
description: 使用 chill.institute（网页界面）搜索内容，并点击“发送至 put.io”（与 putio skill 搭配效果最佳）—— 扬帆起航，挑选最佳的 1080p/x265 资源，并将其传送。
description_zh: 使用 chill.institute（网页界面）搜索内容，并点击“发送至 put.io”（与 putio skill 搭配效果最佳）—— 扬帆起航，挑选最佳的 1080p/x265 资源，并将其传送。
---
# chill.institute

通过交互式浏览器会话，使用 **chill.institute** 查找资源并发送至 put.io。

若您同时安装了 skills（**chill-institute** + **putio**），工作流将更加顺畅：chill.institute 启动传输，putio 则通过 CLI 进行验证与监控。

## 前置条件（Prereqs）

- 用户必须已登录 **chill.institute**（通过浏览器完成 put.io OAuth 登录）。  
- `putio` skill 应可用，以便在 put.io 上验证传输。

## 端到端工作流（End-to-end workflow）

1. 打开网站：  
   - 起始地址：`https://chill.institute/sign-in`  
2. 若出现提示，请点击 **“在 put.io 认证（authenticate at put.io）”**，并请用户完成登录。  
3. 搜索标题（如涉及剧集/画质，建议加入相应关键词）。  
4. 如有快速筛选选项（如勾选 **1080p**、**x265**），请启用。  
5. 选取最佳结果（优先考虑种子健康度高、体积合理、命名符合预期的资源）。  
6. 点击 **“发送至 put.io（send to put.io）”**。  
7. 确认按钮文字变为 **“在 put.io 查看（see in put.io）”**。  
8. 在 put.io 上验证：  
   ```bash
   bash skills/putio/scripts/list_transfers.sh
   ```  

## 浏览器自动化注意事项（Browser automation notes）

- 优先使用 `browser` 工具配合独立浏览器配置文件（`profile="clawd"`）。  
- 若点击操作超时，请重新截取快照（`refs="aria"`），并在新快照引用上重试。

## 安全与政策（Safety / policy）

- 切勿在聊天中向用户索取其 put.io 密码。  
- 切勿抓取或在文件中存储 cookies/会话令牌。  
- 仅对用户拥有合法权利/许可访问的内容使用本工作流。