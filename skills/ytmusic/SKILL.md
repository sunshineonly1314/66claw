---
name: ytmusic-librarian
name_zh: YT音乐
description: 通过 ytmusicapi 管理 YouTube Music 的资料库、播放列表及内容发现。
description_zh: 通过 ytmusicapi 管理 YouTube Music 的资料库、播放列表及内容发现。
---
# YTMusic 图书管理员（Librarian）

该 skill 使用 `ytmusicapi` Python 库与 YouTube Music 进行交互。

## 前置依赖

- Python 3.x
- `ytmusicapi` 包：`pip install ytmusicapi`
- 认证文件（`oauth.json` 或 `browser.json`）需置于 skill 文件夹内。

## 配置说明

1. **安装库：**
   ```bash
   pip install ytmusicapi
   ```

2. **生成认证（“cURL 握手”）：**
   - 使用 **Microsoft Edge** 打开 [music.youtube.com](https://music.youtube.com)（确保已登录）。
   - 按 `F12` 打开开发者工具（DevTools），切换至 **Network（网络）** 标签页。
   - 在页面上点击您的 **头像图标 → Library（资料库）**。
   - 在网络请求列表中查找名为 `browse` 的请求。
   - **右键单击** `browse` 请求 → **Copy → Copy as cURL (bash)**。
   - 将复制的 cURL 命令粘贴到 skill 文件夹中一个名为 `headers.txt` 的文件里。
   - 运行如下 Python 片段以生成 `browser.json`：
     ```python
     from ytmusicapi.auth.browser import setup_browser
     with open('headers.txt', 'r') as f:
         setup_browser('browser.json', f.read())
     ```
   - 确保 `browser.json` 位于 skill 文件夹中。

3. **验证：**
   ```bash
   python -c "from ytmusicapi import YTMusic; yt = YTMusic('browser.json'); print(yt.get_library_songs(limit=1))"
   ```

## 工作流

### 资料库管理
- 列出歌曲/专辑：`yt.get_library_songs()`、`yt.get_library_albums()`
- 添加/移除：`yt.rate_song(videoId, 'LIKE')`、`yt.edit_song_library_status(feedbackToken)`

### 播放列表管理
- 创建：`yt.create_playlist(title, description)`
- 添加曲目：`yt.add_playlist_items(playlistId, [videoIds])`
- 移除曲目：`yt.remove_playlist_items(playlistId, [videoIds])`

### 元数据与内容发现
- 获取歌词：`yt.get_lyrics(browseId)`
- 获取关联内容：`yt.get_watch_playlist(videoId)` → `related`