---
name: wechat-desktop
description: "Personal WeChat (微信) desktop automation for Windows. Send messages via wechat_send, check for new messages via wechat_check, read conversations via wechat_read. For WeCom (企业微信), use the wecom-desktop skill instead."
nameZh: "微信桌面操作"
descriptionZh: "Windows个人微信自动化：发消息用wechat_send，查看新消息用wechat_check，读取对话用wechat_read。企业微信请使用 wecom-desktop 技能。"
metadata: {"openclawcn":{"emoji":"💬","os":["win32"],"always":true}}
---

# 个人微信 WeChat Desktop Automation (Windows)

**注意: 本技能仅适用于个人微信 (WeChat/微信)。企业微信 (WeCom/企业微信) 请使用 wecom-desktop 技能。**

## 发送消息 — Sending Messages

**使用 `wechat_send` 工具:**
```
wechat_send({contact: "小李", message: "你好"})
```
自动完成全部流程: 搜索联系人 → 点击结果 → 输入消息 → 发送 → 返回截图验证。

**给多个人发消息**, 每人调用一次:
```
wechat_send({contact: "张三", message: "Hello"})
wechat_send({contact: "李四", message: "Meeting at 3pm"})
```

如果 `wechat_send` 失败，参见下方 "Manual Fallback" 部分。

## 查看新消息 — Checking for New Messages

**使用 `wechat_check` 工具:**
```
wechat_check({})                          -- 截图当前侧边栏
wechat_check({scroll_pages: 3})           -- 向下滚动3页，逐页截图
wechat_check({contact: "小李"})           -- 打开小李的聊天并截图
```

### 未读消息标识:
- **红色数字气泡**: 有N条未读消息
- **红点 (无数字)**: 免打扰的会话有未读消息
- **加粗联系人名**: 最近收到消息
- **列表顶部位置**: 最近有活动

分析截图识别:
1. 哪些联系人有红色气泡/红点
2. 气泡数字 (多少条未读)
3. 联系人名下方的最后一条消息预览

## 读取消息 — Reading Messages

找到有未读消息的联系人后:
```
1. wechat_check({contact: "小李"})                          -- 打开聊天，截图
2. desktop_control({action: "key", keys: "pageup"})         -- 向上滚动看更早消息
3. desktop_control({action: "screenshot"})                   -- 截图阅读
4. (重复2-3直到看到需要的消息)
```

或使用滚动精确控制:
```
desktop_control({action: "scroll", x: <chat_center_x>, y: <chat_center_y>, amount: 3})
desktop_control({action: "screenshot"})
```

## 自动回复 — Auto-Reply Workflow

```
1. wechat_check({scroll_pages: 2})          -- 扫描侧边栏未读气泡
2. (分析截图找到有未读消息的联系人)
3. 对每个有未读消息的联系人:
   a. wechat_check({contact: "联系人名"})   -- 打开聊天，截图阅读消息
   b. (分析截图中的消息内容)
   c. wechat_send({contact: "联系人名", message: "回复内容"})
   d. (验证发送成功)
```

## 登录处理 — Login Screen Detection

启动微信后截图检查:

**Screen A — 绿色 "进入微信" 按钮 + 圆形头像:**
微信已登录，点击绿色按钮即可。
```
desktop_control({action: "click", x: <button_x>, y: <button_y>})
```
**这个界面没有二维码，不要说"扫码"或"二维码"。**

**Screen B — 黑白二维码方块:**
告诉用户: "请用手机微信扫一扫屏幕上的二维码来登录。"

**Screen C — "已扫描，请在手机上确认":**
告诉用户: "请在手机上点击确认登录。"

## 启动微信 — Launching WeChat

```
open_app({name: "微信"})
-- 等待2-3秒，然后截图检查登录状态
desktop_control({action: "screenshot"})
```

## Manual Fallback (仅当 wechat_send/wechat_check 失败时)

使用 `desktop_control` 手动操作:

1. `focus` 微信窗口
2. `key` Ctrl+F 打开搜索
3. `screenshot` 确认搜索框
4. `type` 输入联系人名称
5. `screenshot` 查看搜索结果
6. `click` 点击搜索结果中的联系人 (不是搜索框!)
7. (搜索面板会自动关闭，不需要按 Escape)
8. `screenshot` 确认聊天标题显示正确联系人
9. `click` 点击底部输入框
10. `type` 输入消息
11. `key` Enter 发送
12. `screenshot` 验证

**关键**: 步骤6 (点击搜索结果) 不能跳过。在搜索框里输入消息是无效的。

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+F` | 打开搜索 |
| `Enter` | 发送消息 (默认) |
| `Ctrl+Enter` | 发送消息 (替代设置) |
| `Ctrl+V` | 粘贴图片/文件 |
| `PageUp` | 聊天记录向上滚动 |
| `PageDown` | 聊天记录向下滚动 |
