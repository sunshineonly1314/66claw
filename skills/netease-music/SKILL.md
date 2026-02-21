---
name: netease-music
description: "Search and play music on NetEase Cloud Music (网易云音乐) desktop app. Use app_search action for reliable search."
nameZh: "网易云音乐"
descriptionZh: "在网易云音乐桌面版中搜索和播放歌曲"
metadata: {"openclawcn":{"emoji":"🎵","os":["win32"],"always":true,"skillKey":"netease-music"}}
tags:
  - 音乐
  - 网易云
  - 播放
  - music
  - netease
  - cloudmusic
---

# 网易云音乐桌面控制 (NetEase Cloud Music)

## 搜索并播放歌曲 — 标准流程

当用户说"播放 XXX"或"搜索 XXX"时，严格按以下步骤执行：

### Step 1: 打开网易云音乐
```
open_app({name: "网易云音乐"})
```

### Step 2: 搜索歌曲（一键完成）
使用 `app_search` action，自动找到窗口、点击搜索框、输入、回车：
```
desktop_control({action: "app_search", window: "cloudmusic", text: "用户要搜的歌名"})
```
**window 参数必须是 "cloudmusic"（进程名），不是窗口标题！**
**text 参数必须是用户给的原始搜索词，禁止修改！**

### Step 3: 等待并双击第一首歌
等 2 秒，然后用 list_windows 获取窗口位置，双击第一首歌：
第一首歌位置约在窗口内 y ≈ 310 处。
```
desktop_control({action: "list_windows"})
```
根据窗口位置计算：first_song_x = 窗口x + 窗口宽 × 0.35, first_song_y = 窗口y + 310
```
desktop_control({action: "click", x: <计算值>, y: <计算值>, double: true})
```

### Step 4: 截图验证
```
desktop_control({action: "screenshot"})
```

## 播放控制

注意：网易云音乐窗口标题是当前播放歌曲名（如 "Free Loop - Daniel Powter"），不含"网易云"。
用 focus 时，先 list_windows 找到 cloudmusic 进程对应的标题。

| 操作 | 方法 |
|------|------|
| 暂停/播放 | focus 后 `key({keys: "space"})` |
| 下一首 | focus 后 `key({keys: "ctrl+right"})` |
| 上一首 | focus 后 `key({keys: "ctrl+left"})` |

## 重要注意

1. **搜索用 app_search**：`desktop_control({action: "app_search", window: "cloudmusic", text: "xxx"})`
2. **搜索词原样使用**：用户说 "starlight" 就传 "starlight"
3. **窗口标题不固定**：显示当前歌名，不含"网易云"，用进程名 cloudmusic 匹配
