---
name: whoop
name_zh: WHOOP
description: WHOOP 晨间健康检查（恢复状态/睡眠/负荷），并提供个性化建议。
description_zh: WHOOP 晨间健康检查（恢复状态/睡眠/负荷），并提供个性化建议。
metadata:
  clawdbot:
    config:
      requiredEnv:
        - WHOOP_CLIENT_ID
        - WHOOP_CLIENT_SECRET
        - WHOOP_REFRESH_TOKEN
---
# whoop

WHOOP 晨间健康检查：
- 获取您最新的 WHOOP 数据（恢复状态、睡眠、生理周期/负荷）
- 生成简明的当日健康建议

## 快速入门（用户 + Bot）

### 用户操作（一次性设置）

1) 创建 WHOOP 应用并获取凭证：
- `WHOOP_CLIENT_ID`
- `WHOOP_CLIENT_SECRET`

2) 在 WHOOP 开发者控制台中设置重定向 URL：
- `https://localhost:3000/callback`

3) 将密钥写入 `~/.clawdbot/.env`：

```bash
WHOOP_CLIENT_ID=...
WHOOP_CLIENT_SECRET=...
```

4) 执行一次授权（获取刷新令牌）：

```bash
node /home/claw/clawd/skills/whoop/bin/whoop-auth --redirect-uri https://localhost:3000/callback
```

- 在手机或浏览器中打开打印出的 URL  
- 点击“允许”或“授权”  
- 复制回调 URL 中的 `code` 并粘贴回终端  

该步骤会将 `WHOOP_REFRESH_TOKEN=...` 写入 `~/.clawdbot/.env`。

### Bot 操作（每次运行时）

执行命令：

```bash
node /home/claw/clawd/skills/whoop/bin/whoop-morning
```

然后将输出结果发送给用户。

## 自动化（每日执行）

推荐：通过 Gateway 的 cron 功能实现每日晨间定时调度。  
- 命令：`node /home/claw/clawd/skills/whoop/bin/whoop-morning`  
- Bot 应将输出作为消息发送给用户。

## 注意事项

- OAuth 接口地址：  
  - 认证地址：`https://api.prod.whoop.com/oauth/oauth2/auth`  
  - 令牌地址：`https://api.prod.whoop.com/oauth/oauth2/token`  
- 需申请 `offline` 权限以获取刷新令牌。  
- WHOOP 会轮换刷新令牌；必须始终保存最新获得的刷新令牌。