---
name: samsung-smart-tv
name_zh: 三星 SmartThings
description: 通过 SmartThings（OAuth 应用 + 设备控制）控制三星电视。
description_zh: 通过 SmartThings（OAuth 应用 + 设备控制）控制三星电视。
homepage: https://developer.smartthings.com/docs
metadata: {"clawdbot":{"emoji":"📺","requires":{"bins":["python3","npx"]},"install":[{"id":"python-brew","kind":"brew","formula":"python","bins":["python3"],"label":"安装 Python（brew）"},{"id":"node-brew","kind":"brew","formula":"node","bins":["node","npx"],"label":"安装 Node.js（brew）"}]}}
---
# 三星智能电视（SmartThings）

该 skill 部署一个 SmartThings OAuth 应用，并将凭据存储供 Clawdbot 使用。

设置（仅需一次）
- 以无头模式（headless）创建 SmartThings OAuth 应用（需提供个人访问令牌 PAT），并打印手机登录 URL；全程仅使用纯文本说明，不涉及代码片段。
- 在手机上打开该 URL，完成登录后，从重定向页面的 URL 中复制 code 查询参数，然后重新运行命令以完成授权码交换。
- 若 PAT 应用创建失败（HTTP 403 错误），请改用普通计算机，通过 SmartThings CLI 的标准登录流程创建应用，再将 client id 和 client secret 手动填入 .env 文件，之后再运行授权码交换步骤。
- 可随时重新运行以刷新凭据：仅用纯文本描述操作步骤（不包含任何代码片段）。

功能说明
- 创建一个显示名称为 smartthings-clawdbot 的 OAuth-In SmartApp。
- 使用 r:devices:* 和 x:devices:* 权限范围（即读取设备信息 + 执行设备指令）。
- 重定向 URI 默认为 https://httpbin.org/get（可通过 redirect-uri 选项覆盖）。
- 将 SMARTTHINGS_APP_ID、SMARTTHINGS_CLIENT_ID、SMARTTHINGS_CLIENT_SECRET 以及 OAuth 访问令牌写入 ~/.clawdbot/.env（或 CLAWDBOT_STATE_DIR/.env）。
- 当提供 PAT 时，使用 SmartThings CLI 创建 OAuth 应用。
- 通过直接向 SmartThings 发起 HTTPS 请求（而非经由 CLI）完成授权码到令牌的交换。

设备配置
- 使用 SmartThings CLI 以 JSON 格式列出设备，并定位目标电视的 device id。
- 将该 device id 存储为同一 .env 文件中的 SMARTTHINGS_DEVICE_ID。

常用操作（仅限纯文本说明）
- 使用 SmartThings CLI 列出设备及其能力（capabilities）。
- 检查设备当前状态。
- 向电视设备发送开关机、音量调节、静音等指令。

应用启动（如 Netflix / Prime Video）
- 应用启动能力因设备而异；请在 capabilities 中查找 applicationLauncher 或 samsungtv 相关项。
- 在设备状态响应中，通过 supportedApps 或 installedApps 字段发现可用应用 ID。
- 使用 SmartThings CLI 及您电视上获取的实际 appId 启动对应应用。
- 示例应用 ID 并非通用；请务必使用您电视返回的具体 ID。

应用发现（当用户要求打开特定应用时）
- 首先，在电视上手动打开目标应用。
- 然后查询设备状态，检查 tvChannelName、installedApps 或 supportedApps 等字段，从中提取当前运行的应用 appId。
- 将该 appId 保存以供后续调用；部分 ID 具有设备唯一性。
- 已知应用 ID 命名模式（示例）：
  - 标准/全局应用（通常稳定）：
    - Netflix：org.tizen.netflix-app
    - Amazon Prime：org.tizen.primevideo
    - 命名模式：org.tizen.[app-name]
  - 设备专属应用（随电视型号变化）：
    - YouTube：{random}.TizenYouTube
    - Joyn：{random}.ZAPPNVOLLTVFREIGESTREAMT
    - 命名模式：{random}.{PackageName}
- 切勿猜测；务必始终依据电视返回的状态载荷确认 appId。

注意事项
- 脚本默认运行于无头模式，不会自动打开浏览器。
- 请通过环境变量 SMARTTHINGS_TOKEN（或 SMARTTHINGS_PAT）提供 PAT 完成身份验证。
- PAT 创建地址：https://account.smartthings.com/tokens
- OAuth 流程：在手机上打开打印出的 URL，从重定向页面 URL 中复制 code 查询参数，再以 auth-code 参数重新运行命令。
- 默认重定向地址使用 https://httpbin.org/get，以便在 URL 中直接显示 code；若您不希望使用 httpbin，可切换为自定义重定向 URI。
- 重复运行设置流程是安全的；它会就地更新 .env 中的对应条目。
- 回复风格：不得包含代码块或内联命令片段；仅使用纯文本步骤说明。