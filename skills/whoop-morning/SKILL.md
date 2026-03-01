---
name: whoop-morning
name_zh: WHOOP晨间报告
description: 每日清晨检查 WHOOP 恢复/睡眠/负荷状态，并推送个性化建议。
description_zh: 每日清晨检查 WHOOP 恢复/睡眠/负荷状态，并推送个性化建议。
metadata:
  clawdbot:
    config:
      requiredEnv:
        - WHOOP_CLIENT_ID
        - WHOOP_CLIENT_SECRET
        - WHOOP_REFRESH_TOKEN
---
# whoop-morning

WHOOP 晨间签到：  
- 获取您最新的 WHOOP 数据（恢复、睡眠、周期/负荷）  
- 生成一组简明的当日建议  

## 设置

### 1) 创建 WHOOP OAuth 凭据

您已拥有：  
- `WHOOP_CLIENT_ID`  
- `WHOOP_CLIENT_SECRET`  

请将上述凭据存入 `~/.clawdbot/.env`。

### 2) 一次性授权（获取刷新令牌）

运行：

```bash
/home/claw/clawd/skills/whoop-morning/bin/whoop-auth --scopes offline read:recovery read:sleep read:cycles read:profile
```

该命令将打印一条授权 URL。  
请在浏览器中打开该链接，完成授权后，将 `code` 粘贴回终端。

脚本将据此交换获取令牌，并将 `WHOOP_REFRESH_TOKEN=...` 写入 `~/.clawdbot/.env`。

### 3) 运行晨间报告

```bash
/home/claw/clawd/skills/whoop-morning/bin/whoop-morning
```

## 自动化

推荐方式：通过 Gateway cron 定时执行（每日清晨）。  
该定时任务应运行 `whoop-morning`，并将输出作为消息发送。

## 注意事项

- 本 skill 使用 WHOOP OAuth2 协议：  
  - 授权 URL：`https://api.prod.whoop.com/oauth/oauth2/auth`  
  - 令牌 URL：`https://api.prod.whoop.com/oauth/oauth2/token`  
- WHOOP 会轮换刷新令牌；请避免并行执行多次刷新操作。  
- API 可用性及字段可能变更；若 WHOOP 在令牌刷新期间返回 401/400 错误，请重新运行 `whoop-auth`。