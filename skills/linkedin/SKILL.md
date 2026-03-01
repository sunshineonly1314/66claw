---
name: linkedin
name_zh: LinkedIn
description: 通过浏览器中继或 Cookie 实现 LinkedIn 自动化，支持消息收发、个人资料浏览及人脉操作。
description_zh: 通过浏览器中继或 Cookie 实现 LinkedIn 自动化，支持消息收发、个人资料浏览及人脉操作。
homepage: https://linkedin.com
metadata: {"clawdbot":{"emoji":"💼"}}
---
# LinkedIn

使用浏览器自动化与 LinkedIn 交互——检查消息、浏览个人资料、执行搜索、发送好友请求。

## 连接方式

### 方式 1：Chrome 扩展中继（推荐）
1. 在 Chrome 中打开 LinkedIn 并登录  
2. 点击 Clawdbot 浏览器中继工具栏图标，将当前标签页绑定至中继  
3. 使用 `browser` 工具配合 `profile="chrome"`

### 方式 2：独立浏览器实例
1. 使用 `browser` 工具配合 `profile="clawd"`  
2. 导航至 linkedin.com  
3. 手动登录（一次性配置）  
4. 会话将在后续使用中持续有效

## 常见操作

### 检查好友关系状态
```
browser action=snapshot profile=chrome targetUrl="https://www.linkedin.com/feed/"
```

### 查看通知/消息
```
browser action=navigate profile=chrome targetUrl="https://www.linkedin.com/messaging/"
browser action=snapshot profile=chrome
```

### 搜索联系人
```
browser action=navigate profile=chrome targetUrl="https://www.linkedin.com/search/results/people/?keywords=QUERY"
browser action=snapshot profile=chrome
```

### 浏览个人资料
```
browser action=navigate profile=chrome targetUrl="https://www.linkedin.com/in/USERNAME/"
browser action=snapshot profile=chrome
```

### 发送消息（须先获得用户确认！）
1. 导航至消息界面或目标个人资料页  
2. 使用 `browser action=act` 执行点击/输入等操作  
3. 发送前务必确认消息内容

## 安全规则
- **未经用户明确批准，禁止发送任何消息**  
- **未经确认，禁止接受或发送好友请求**  
- **避免高频自动化操作**——LinkedIn 对自动化行为检测极为严格  
- 速率限制：建议最高不超过每小时 30 次操作

## Cookie 会话方法（进阶）
若无法使用浏览器中继，可从浏览器中提取 `li_at` Cookie：  
1. 在浏览器中打开 LinkedIn 并完成登录  
2. 打开开发者工具（DevTools）→ Application（应用）→ Cookies（Cookie）→ linkedin.com  
3. 复制 `li_at` 的值  
4. 安全存储该值，用于后续 API 请求

## 故障排查
- 若已登出：需在浏览器中重新完成身份验证  
- 若遭遇限频：等待 24 小时，并降低操作频率  
- 若出现 CAPTCHA：需在浏览器中手动完成验证，之后恢复自动化流程