---
name: wecom-desktop
description: "WeCom (企业微信) desktop automation + smart CS for Windows. Core: wecom_send/check/read. Smart CS: wecom_auto_reply, wecom_patrol, wecom_group_summary, wecom_broadcast, wecom_ticket, wecom_handoff."
nameZh: "企业微信桌面操作+智能客服"
descriptionZh: "Windows企业微信自动化+智能客服全套：发消息wecom_send，查消息wecom_check，读消息wecom_read，智能回复wecom_auto_reply，巡检wecom_patrol，群摘要wecom_group_summary，批量发送wecom_broadcast，工单wecom_ticket，人工接管wecom_handoff"
metadata: {"openclawcn":{"emoji":"💼","os":["win32"],"always":true}}
---

# 企业微信 WeCom Desktop Automation + Smart CS (Windows)

**注意: 企业微信 (WeCom) 和个人微信 (WeChat) 是完全不同的应用！本技能仅适用于企业微信。个人微信请使用 wechat-desktop 技能。**

## 工具总览 — Tool Overview

| 工具 | 用途 | 需要窗口 |
|------|------|----------|
| `wecom_send` | 发送消息 | 是 |
| `wecom_check` | 查看新消息/截图 | 是 |
| `wecom_read` | Vision读取消息 | 是 |
| `wecom_auto_reply` | 智能客服一键回复 | 是 |
| `wecom_patrol` | 巡检未读+@我+关键词告警 | 是 |
| `wecom_group_summary` | 群消息摘要+统计 | 是 |
| `wecom_broadcast` | 批量发送通知 | 是 |
| `wecom_ticket` | 工单创建/查询/关闭 | 否 |
| `wecom_handoff` | 人工接管管理 | 否 |

## 发送消息 — Sending Messages

**使用 `wecom_send` 工具:**
```
wecom_send({contact: "小李", message: "你好"})
```
自动完成全部流程: 搜索联系人 → 点击结果 → 输入消息 → 发送 → 返回截图验证。

**给多个人发消息**, 每人调用一次:
```
wecom_send({contact: "张三", message: "Hello"})
wecom_send({contact: "李四", message: "Meeting at 3pm"})
```

## 查看新消息 — Checking for New Messages

**使用 `wecom_check` 工具:**
```
wecom_check({})                          -- 截图当前侧边栏
wecom_check({scroll_pages: 3})           -- 向下滚动3页，逐页截图
wecom_check({contact: "小李"})           -- 打开小李的聊天并截图
```

### 未读消息标识:
- **红色数字气泡**: 有N条未读消息
- **红点 (无数字)**: 免打扰的会话有未读消息
- **加粗联系人名**: 最近收到消息
- **列表顶部位置**: 最近有活动

## 读取消息 — Reading Messages

**使用 `wecom_read` 工具 (带 Vision 分析):**
```
wecom_read({contact: "小李", count: 10})    -- 读取最近10条消息
wecom_read({contact: "项目讨论群"})          -- 读取群最近5条消息
```

## 智能客服回复 — Smart Auto-Reply

**使用 `wecom_auto_reply` 工具 (一键完成全流程):**
```
wecom_auto_reply({contact: "张三"})                 -- 读取消息 → AI回复 → 发送
wecom_auto_reply({contact: "项目群", count: 10})     -- 读取10条上下文
wecom_auto_reply({contact: "客户A", dry_run: true})  -- 试运行，只生成不发送
```

完整流程:
1. 预检: API Key + 静默时段 + 人工接管检查 + 去重检查
2. 聚焦企业微信 → 搜索联系人 → 打开聊天窗口
3. 截图 → Ollama qwen2.5vl:7b 视觉模型提取消息
4. 提取对方最后一条消息
5. 知识库关键词匹配 → 注入 system prompt
6. Kimi Code API + 人设"小克" → 生成自然口语化回复
7. 防检测: 黑名单过滤 + 静默时段 + 打字延迟模拟
8. [转人工] 检测 → 自动加入接管列表
9. 发送回复 + 记录去重

## 巡检未读消息 — Patrol

**使用 `wecom_patrol` 工具:**
```
wecom_patrol({})                                    -- 默认巡检2页
wecom_patrol({scroll_pages: 5})                     -- 扫描5页
wecom_patrol({alert_keywords: ["紧急","P0","故障"]}) -- 自定义告警关键词
```

功能:
- 截图侧边栏 + Vision 分析识别未读气泡/红点
- @我消息检测 (优先处理)
- 关键词告警 (默认: 紧急/bug/投诉/退款/故障/崩溃/报错)
- 返回结构化巡检报告

典型用法 (定时巡检 + 批量回复):
```
1. wecom_patrol({scroll_pages: 3})           -- 扫描未读
2. (分析报告中的未读联系人)
3. 对每个需要回复的联系人:
   wecom_auto_reply({contact: "联系人名"})   -- 智能回复
```

## 群消息摘要 — Group Summary

**使用 `wecom_group_summary` 工具:**
```
wecom_group_summary({group: "项目讨论群"})
wecom_group_summary({group: "客服群", scroll_up: 5, count: 30})
```

返回:
- 消息量统计 + 活跃成员排名
- Kimi AI 生成的关键话题摘要
- 最近消息预览

## 批量发送 — Broadcast

**使用 `wecom_broadcast` 工具:**
```
wecom_broadcast({
  targets: [{contact:"张三"},{contact:"李四"},{contact:"客户群"}],
  message: "会议通知: 明天下午3点在会议室A"
})

wecom_broadcast({
  targets: [
    {contact:"张三", message: "张三你好，请确认参会"},
    {contact:"李四", message: "李四你好，请带上文档"}
  ]
})
```

功能:
- 统一消息或个性化消息
- 每次发送间随机延迟 (防检测)
- 静默时段自动跳过
- 单次最多 20 个目标

## 工单管理 — Ticket

**使用 `wecom_ticket` 工具:**
```
wecom_ticket({action:"create", contact:"张三", type:"bug", content:"登录页崩溃"})
wecom_ticket({action:"query", contact:"张三"})
wecom_ticket({action:"query", ticket_id:"T-20260218-001"})
wecom_ticket({action:"update", ticket_id:"T-20260218-001", status:"in_progress"})
wecom_ticket({action:"close", ticket_id:"T-20260218-001", resolution:"已修复"})
wecom_ticket({action:"list"})
wecom_ticket({action:"notify_pending"})
```

工单状态: open → in_progress → resolved → closed
存储: 本地 JSON 文件 (~/.wecom-tickets.json)

## 人工接管 — Handoff

**使用 `wecom_handoff` 工具:**
```
wecom_handoff({action:"add", contact:"张三", reason:"投诉需人工处理"})
wecom_handoff({action:"remove", contact:"张三"})
wecom_handoff({action:"list"})
wecom_handoff({action:"check", contact:"张三"})
```

当联系人在接管列表中时:
- `wecom_auto_reply` 自动跳过该联系人
- AI 回复包含 [转人工] 时自动加入接管列表
- 存储: 本地 JSON 文件 (~/.wecom-handoff.json)

## 知识库支持

内置关键词匹配知识库 (bug/产品/价格/账号/投诉等)。
自定义知识库: 设置 `WECOM_CS_KB_PATH` 环境变量指向 JSON 文件:
```json
[
  {"keywords": ["退款", "退费"], "category": "refund", "content": "退款流程: ..."},
  {"keywords": ["安装", "部署"], "category": "setup", "content": "安装步骤: ..."}
]
```

## AI 人设

默认人设"小克" — 友好专业的技术支持客服。
自定义人设: 设置 `WECOM_CS_PERSONA` 环境变量。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `KIMI_API_KEY` | 是 | Kimi Code API Key |
| `OLLAMA_BASE_URL` | 否 | Ollama 地址 (默认 localhost:11434) |
| `OLLAMA_VISION_MODEL` | 否 | 视觉模型 (默认 qwen2.5vl:7b) |
| `WECOM_CS_KB_PATH` | 否 | 自定义知识库 JSON 文件路径 |
| `WECOM_CS_PERSONA` | 否 | 自定义 AI 人设 |
| `WECOM_TICKET_FILE` | 否 | 工单存储路径 (默认 ~/.wecom-tickets.json) |
| `WECOM_HANDOFF_FILE` | 否 | 接管列表路径 (默认 ~/.wecom-handoff.json) |

## 企业微信关键注意事项

- **绝对不要按 Escape** — 会把企业微信整个窗口最小化到系统托盘！搜索面板在点击搜索结果后会自动关闭。
- **搜索前先清除残留** — 企业微信可能保留上次搜索的文字。工具已自动处理 (Ctrl+A 全选后输入)。
- **等待时间要充足** — 企业微信搜索结果加载比个人微信慢，输入后需等待2-3秒再点击结果。
- **搜索结果位置偏下** — 第一个可点击的联系人结果在 "联系人" 标题下方，比个人微信更低。

## Manual Fallback (仅当 wecom_send/wecom_check 失败时)

使用 `desktop_control` 手动操作:

1. `focus` 企业微信窗口
2. `key` Ctrl+F 打开搜索
3. `key` Ctrl+A 清除搜索框残留文字
4. `screenshot` 确认搜索框已激活
5. `type` 输入联系人名称
6. 等待 2-3 秒
7. `screenshot` 查看搜索结果
8. `click` 点击搜索结果中的联系人 (不是搜索框!)
9. (不要按 Escape — 搜索面板会自动关闭)
10. `screenshot` 确认聊天标题显示正确联系人
11. `click` 点击底部输入框
12. `type` 输入消息
13. `key` Enter 发送
14. `screenshot` 验证发送成功

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+F` | 打开搜索 |
| `Ctrl+A` | 全选 (用于清空搜索框) |
| `Enter` | 发送消息 |
| `Ctrl+V` | 粘贴图片/文件 |
| `PageUp` | 聊天记录向上滚动 |
| `PageDown` | 聊天记录向下滚动 |
| `Escape` | **危险! 会最小化企业微信到托盘!** |
