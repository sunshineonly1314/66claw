---
name: get-focus-mode
name_zh: 专注模式
description: 获取当前 macOS 聚焦模式（Focus mode）
description_zh: 获取当前 macOS 聚焦模式（Focus mode）
---
# 获取聚焦模式

返回当前激活的 macOS 聚焦模式名称。

## 使用方法

```bash
~/clawd/skills/get-focus-mode/get-focus-mode.sh
```

## 输出

将聚焦模式名称打印至标准输出（stdout）：
- “No Focus” —— 聚焦模式已关闭  
- “Office” —— 办公聚焦模式已启用  
- “Sleep” —— 睡眠聚焦模式已启用  
- “Do Not Disturb” —— 勿扰模式已启用  

## 系统要求

- macOS  
- 已安装 `jq`  