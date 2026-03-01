---
name: mcp-applemusic
name_zh: MCP-Apple Music
version: 0.6.0
description: 通过 AppleScript（macOS）或 MusicKit API 实现 Apple Music 集成
description_zh: 通过 AppleScript（macOS）或 MusicKit API 实现 Apple Music 集成
---
# Apple Music 集成

Apple Music 集成使用指南，涵盖 AppleScript（macOS）、MusicKit API（跨平台），以及关键的“以资料库为先”（library-first）工作流要求。

## 适用场景

当用户提出以下请求时调用：
- 管理播放列表（创建、添加/移除曲目、列出）
- 控制播放（播放、暂停、跳过、调节音量）
- 搜索目录（catalog）或资料库（library）
- 将歌曲添加至资料库
- 访问收听历史记录或个性化推荐

## 关键规则：“以资料库为先”工作流

**您不能直接将目录中的歌曲添加到播放列表中。**

歌曲必须首先存在于用户的资料库中：
- ❌ 目录 ID → 播放列表（失败）
- ✅ 目录 ID → 资料库 → 播放列表（成功）

**原因：** 播放列表使用资料库 ID（`i.abc123`），而非目录 ID（`1234567890`）。

该规则同时适用于 AppleScript 和 API 方式。

## 平台对比

| 功能 | AppleScript（macOS） | MusicKit API |
|---------|:-------------------:|:------------:|
| 是否需要配置 | 否 | 需 Apple 开发者账号 + Token |
| 播放列表管理 | 完整支持 | 仅支持 API 创建的播放列表 |
| 播放控制 | 完整支持 | 不支持 |
| 目录搜索 | 不支持 | 支持 |
| 资料库访问 | 即时可用 | 需 Token 授权 |
| 跨平台支持 | 否 | 是 |

---

# AppleScript（macOS）

零配置。可立即与 macOS “音乐”（Music）App 协同工作。

**通过 Bash 运行：**
```bash
osascript -e 'tell application "Music" to playpause'
osascript -e 'tell application "Music" to return name of current track'
```

**多行脚本：**
```bash
osascript <<'EOF'
tell application "Music"
    set t to current track
    return {name of t, artist of t}
end tell
EOF
```

## 可用操作

| 类别 | 操作 |
|----------|------------|
| **播放控制** | 播放、暂停、停止、恢复、下一曲、上一曲、快进、倒带 |
| **播放器状态** | 播放位置、播放状态、音量、静音、随机播放启用/模式、单曲循环 |
| **当前曲目** | 名称、艺术家、专辑、时长、当前时间、评分、喜爱、不喜爱、流派、年份、音轨编号 |
| **资料库** | 搜索、列出曲目、获取曲目属性、设置评分 |
| **播放列表** | 列出、创建、删除、重命名、添加曲目、移除曲目、获取曲目 |
| **AirPlay** | 列出设备、选择设备、当前设备 |

## 曲目属性（只读）

```applescript
tell application "Music"
    set t to current track
    -- Basic info
    name of t           -- "Hey Jude"
    artist of t         -- "The Beatles"
    album of t          -- "1 (Remastered)"
    album artist of t   -- "The Beatles"
    composer of t       -- "Lennon-McCartney"
    genre of t          -- "Rock"
    year of t           -- 1968

    -- Timing
    duration of t       -- 431.0 (seconds)
    time of t           -- "7:11" (formatted)
    start of t          -- start time in seconds
    finish of t         -- end time in seconds

    -- Track info
    track number of t   -- 21
    track count of t    -- 27
    disc number of t    -- 1
    disc count of t     -- 1

    -- Ratings
    rating of t         -- 0-100 (20 per star)
    loved of t          -- true/false
    disliked of t       -- true/false

    -- Playback
    played count of t   -- 42
    played date of t    -- date last played
    skipped count of t  -- 3
    skipped date of t   -- date last skipped

    -- IDs
    persistent ID of t  -- "ABC123DEF456"
    database ID of t    -- 12345
end tell
```

## 曲目属性（可写）

```applescript
tell application "Music"
    set t to current track
    set rating of t to 80          -- 4 stars
    set loved of t to true
    set disliked of t to false
    set name of t to "New Name"    -- rename track
    set genre of t to "Alternative"
    set year of t to 1995
end tell
```

## 播放器状态属性

```applescript
tell application "Music"
    player state          -- stopped, playing, paused, fast forwarding, rewinding
    player position       -- current position in seconds (read/write)
    sound volume          -- 0-100 (read/write)
    mute                  -- true/false (read/write)
    shuffle enabled       -- true/false (read/write)
    shuffle mode          -- songs, albums, groupings
    song repeat           -- off, one, all (read/write)
    current track         -- track object
    current playlist      -- playlist object
    current stream URL    -- URL if streaming
end tell
```

## 播放控制命令

```applescript
tell application "Music"
    -- Play controls
    play                          -- play current selection
    pause
    stop
    resume
    playpause                     -- toggle play/pause
    next track
    previous track
    fast forward
    rewind

    -- Play specific content
    play (first track of library playlist 1 whose name contains "Hey Jude")
    play user playlist "Road Trip"

    -- Settings
    set player position to 60     -- seek to 1:00
    set sound volume to 50        -- 0-100
    set mute to true
    set shuffle enabled to true
    set song repeat to all        -- off, one, all
end tell
```

## 资料库查询

```applescript
tell application "Music"
    -- All library tracks
    every track of library playlist 1

    -- Search by name
    tracks of library playlist 1 whose name contains "Beatles"

    -- Search by artist
    tracks of library playlist 1 whose artist contains "Beatles"

    -- Search by album
    tracks of library playlist 1 whose album contains "Abbey Road"

    -- Combined search
    tracks of library playlist 1 whose name contains "Hey" and artist contains "Beatles"

    -- By genre
    tracks of library playlist 1 whose genre is "Rock"

    -- By year
    tracks of library playlist 1 whose year is 1969

    -- By rating
    tracks of library playlist 1 whose rating > 60  -- 3+ stars

    -- Loved tracks
    tracks of library playlist 1 whose loved is true

    -- Recently played (sort by played date)
    tracks of library playlist 1 whose played date > (current date) - 7 * days
end tell
```

## 播放列表操作

```applescript
tell application "Music"
    -- List all playlists
    name of every user playlist

    -- Get playlist
    user playlist "Road Trip"
    first user playlist whose name contains "Road"

    -- Create playlist
    make new user playlist with properties {name:"New Playlist", description:"My playlist"}

    -- Delete playlist
    delete user playlist "Old Playlist"

    -- Rename playlist
    set name of user playlist "Old Name" to "New Name"

    -- Get playlist tracks
    every track of user playlist "Road Trip"
    name of every track of user playlist "Road Trip"

    -- Add track to playlist (must be library track)
    set targetPlaylist to user playlist "Road Trip"
    set targetTrack to first track of library playlist 1 whose name contains "Hey Jude"
    duplicate targetTrack to targetPlaylist

    -- Remove track from playlist
    delete (first track of user playlist "Road Trip" whose name contains "Hey Jude")

    -- Playlist properties
    duration of user playlist "Road Trip"   -- total duration
    time of user playlist "Road Trip"       -- formatted duration
    count of tracks of user playlist "Road Trip"
end tell
```

## AirPlay

```applescript
tell application "Music"
    -- List AirPlay devices
    name of every AirPlay device

    -- Get current device
    current AirPlay devices

    -- Set output device
    set current AirPlay devices to {AirPlay device "Living Room"}

    -- Multiple devices
    set current AirPlay devices to {AirPlay device "Living Room", AirPlay device "Kitchen"}

    -- Device properties
    set d to AirPlay device "Living Room"
    name of d
    kind of d           -- computer, AirPort Express, Apple TV, AirPlay device, Bluetooth device
    active of d         -- true if playing
    available of d      -- true if reachable
    selected of d       -- true if in current devices
    sound volume of d   -- 0-100
end tell
```

## 字符串转义

始终对用户输入进行转义：
```python
def escape_applescript(s):
    return s.replace('\\', '\\\\').replace('"', '\\"')

safe_name = escape_applescript(user_input)
script = f'tell application "Music" to play user playlist "{safe_name}"'
```

## 局限性

- **不支持目录访问** —— 仅支持资料库内容  
- **仅限 macOS** —— 不支持 Windows/Linux

---

# MusicKit API

跨平台，但需 Apple 开发者账号（每年 $99）及 Token 配置。

## 认证

**前提条件：**  
1. Apple 开发者账号  
2. 来自 [开发者门户](https://developer.apple.com/account/resources/authkeys/list) 的 MusicKit 密钥（.p8 文件）  
3. 开发者 Token（JWT，最长有效期 180 天）  
4. 用户音乐 Token（浏览器 OAuth 获取）

**生成开发者 Token：**  
```python
import jwt, datetime

with open('AuthKey_XXXXXXXXXX.p8') as f:
    private_key = f.read()

token = jwt.encode(
    {
        'iss': 'TEAM_ID',
        'iat': int(datetime.datetime.now().timestamp()),
        'exp': int((datetime.datetime.now() + datetime.timedelta(days=180)).timestamp())
    },
    private_key,
    algorithm='ES256',
    headers={'alg': 'ES256', 'kid': 'KEY_ID'}
)
```

**获取用户 Token：** 浏览器 OAuth 至 `https://authorize.music.apple.com/woa`

**所有请求所需请求头：**  
```
Authorization: Bearer {developer_token}
Music-User-Token: {user_music_token}
```

**基础 URL：** `https://api.music.apple.com/v1`

## 可用端点

### 目录（公开 — 仅限开发者 Token）

| 端点 | 方法 | 描述 |
|----------|--------|-------------|
| `/catalog/{storefront}/search` | GET | 搜索歌曲、专辑、艺人、播放列表 |
| `/catalog/{storefront}/songs/{id}` | GET | 歌曲详情 |
| `/catalog/{storefront}/albums/{id}` | GET | 专辑详情 |
| `/catalog/{storefront}/albums/{id}/tracks` | GET | 专辑曲目 |
| `/catalog/{storefront}/artists/{id}` | GET | 艺人详情 |
| `/catalog/{storefront}/artists/{id}/albums` | GET | 艺人的专辑 |
| `/catalog/{storefront}/artists/{id}/songs` | GET | 艺人的热门歌曲 |
| `/catalog/{storefront}/artists/{id}/related-artists` | GET | 相似艺人 |
| `/catalog/{storefront}/playlists/{id}` | GET | 播放列表详情 |
| `/catalog/{storefront}/charts` | GET | 热门排行榜 |
| `/catalog/{storefront}/genres` | GET | 全部流派 |
| `/catalog/{storefront}/search/suggestions` | GET | 搜索自动补全 |
| `/catalog/{storefront}/stations/{id}` | GET | 电台频道 |

### 资料库（需用户 Token）

| 端点 | 方法 | 描述 |
|----------|--------|-------------|
| `/me/library/songs` | GET | 所有资料库歌曲 |
| `/me/library/albums` | GET | 所有资料库专辑 |
| `/me/library/artists` | GET | 所有资料库艺人 |
| `/me/library/playlists` | GET | 所有资料库播放列表 |
| `/me/library/playlists/{id}` | GET | 播放列表详情 |
| `/me/library/playlists/{id}/tracks` | GET | 播放列表曲目 |
| `/me/library/search` | GET | 资料库搜索 |
| `/me/library` | POST | 添加至资料库 |
| `/catalog/{sf}/songs/{id}/library` | GET | 由目录 ID 获取资料库 ID |

### 播放列表管理

| 端点 | 方法 | 描述 |
|----------|--------|-------------|
| `/me/library/playlists` | POST | 创建播放列表 |
| `/me/library/playlists/{id}/tracks` | POST | 向播放列表添加曲目 |

### 个性化服务

| 端点 | 方法 | 描述 |
|----------|--------|-------------|
| `/me/recommendations` | GET | 个性化推荐 |
| `/me/history/heavy-rotation` | GET | 常听歌曲 |
| `/me/recent/played` | GET | 最近播放 |
| `/me/recent/added` | GET | 最近添加 |

### 评分

| 端点 | 方法 | 描述 |
|----------|--------|-------------|
| `/me/ratings/songs/{id}` | GET | 获取歌曲评分 |
| `/me/ratings/songs/{id}` | PUT | 设置歌曲评分 |
| `/me/ratings/songs/{id}` | DELETE | 移除评分 |
| `/me/ratings/albums/{id}` | GET/PUT/DELETE | 专辑评分 |
| `/me/ratings/playlists/{id}` | GET/PUT/DELETE | 播放列表评分 |

### 商店区域（Storefronts）

| 端点 | 方法 | 描述 |
|----------|--------|-------------|
| `/storefronts` | GET | 所有商店区域 |
| `/storefronts/{id}` | GET | 商店区域详情 |
| `/me/storefront` | GET | 用户所在商店区域 |

## 常用查询参数

| 参数 | 描述 | 示例 |
|-----------|-------------|---------|
| `term` | 搜索关键词 | `term=beatles` |
| `types` | 资源类型 | `types=songs,albums` |
| `limit` | 每页结果数（上限 25） | `limit=10` |
| `offset` | 分页偏移量 | `offset=25` |
| `include` | 关联资源 | `include=artists,albums` |
| `extend` | 额外属性 | `extend=editorialNotes` |
| `l` | 语言代码 | `l=en-US` |

## 搜索示例

```bash
GET /v1/catalog/us/search?term=wonderwall&types=songs&limit=10

Response:
{
  "results": {
    "songs": {
      "data": [{
        "id": "1234567890",
        "type": "songs",
        "attributes": {
          "name": "Wonderwall",
          "artistName": "Oasis",
          "albumName": "(What's the Story) Morning Glory?",
          "durationInMillis": 258773,
          "releaseDate": "1995-10-02",
          "genreNames": ["Alternative", "Music"]
        }
      }]
    }
  }
}
```

## “以资料库为先”完整工作流

将一首目录歌曲添加至播放列表需 4 次 API 调用：

```python
import requests

headers = {
    "Authorization": f"Bearer {dev_token}",
    "Music-User-Token": user_token
}

# 1. Search catalog
r = requests.get(
    "https://api.music.apple.com/v1/catalog/us/search",
    headers=headers,
    params={"term": "Wonderwall Oasis", "types": "songs", "limit": 1}
)
catalog_id = r.json()['results']['songs']['data'][0]['id']

# 2. Add to library
requests.post(
    "https://api.music.apple.com/v1/me/library",
    headers=headers,
    params={"ids[songs]": catalog_id}
)

# 3. Get library ID (catalog ID → library ID)
r = requests.get(
    f"https://api.music.apple.com/v1/catalog/us/songs/{catalog_id}/library",
    headers=headers
)
library_id = r.json()['data'][0]['id']

# 4. Add to playlist (library IDs only!)
requests.post(
    f"https://api.music.apple.com/v1/me/library/playlists/{playlist_id}/tracks",
    headers={**headers, "Content-Type": "application/json"},
    json={"data": [{"id": library_id, "type": "library-songs"}]}
)
```

## 创建播放列表

```bash
POST /v1/me/library/playlists
Content-Type: application/json

{
  "attributes": {
    "name": "Road Trip",
    "description": "Summer vibes"
  },
  "relationships": {
    "tracks": {
      "data": []
    }
  }
}
```

## 评分

```bash
# Love a song (value: 1 = love, -1 = dislike)
PUT /v1/me/ratings/songs/{id}
Content-Type: application/json

{"attributes": {"value": 1}}
```

## 局限性

- **不支持播放控制** —— API 无法执行播放/暂停/跳过等操作  
- **播放列表编辑** —— 仅能修改由 API 创建的播放列表  
- **Token 管理** —— 开发者 Token 每 180 天过期一次  
- **速率限制** —— Apple 对请求频率实施严格限制  

---

# 常见错误

**❌ 在播放列表中误用目录 ID：**  
```python
# WRONG
json={"data": [{"id": "1234567890", "type": "songs"}]}
```  
**修正方法：** 先添加至资料库，获取资料库 ID，再添加至播放列表。

**❌ 通过 AppleScript 播放目录歌曲：**  
```applescript
# WRONG
play track id "1234567890"
```  
**修正方法：** 歌曲必须已存在于资料库中。

**❌ AppleScript 字符串未转义：**  
```python
# WRONG
name = "Rock 'n Roll"
script = f'tell application "Music" to play playlist "{name}"'
```  
**修正方法：** 对引号进行转义。

**❌ Token 已过期：**  
开发者 Token 最长有效期为 180 天。  
**修正方法：** 检查过期时间，并妥善处理 401 错误。

---

# 简便方案：mcp-applemusic

[mcp-applemusic](https://github.com/epheterson/mcp-applemusic) MCP 服务器可自动处理全部复杂逻辑：AppleScript 字符串转义、Token 管理、“以资料库为先”工作流、ID 转换等。

**安装：**  
```bash
git clone https://github.com/epheterson/mcp-applemusic.git
cd mcp-applemusic && python3 -m venv venv && source venv/bin/activate
pip install -e .
```

**在 Claude Desktop 中配置：**  
```json
{
  "mcpServers": {
    "Apple Music": {
      "command": "/path/to/mcp-applemusic/venv/bin/python",
      "args": ["-m", "applemusic_mcp"]
    }
  }
}
```

在 macOS 上，大部分功能开箱即用；如需目录相关功能，或在 Windows/Linux 上使用，请参阅项目 README。

| 手动方式 | mcp-applemusic |
|--------|----------------|
| 添加一首歌需 4 次 API 调用 | `playlist(action="add", auto_search=True)` |
| AppleScript 字符串转义 | 自动完成 |
| Token 管理 | 自动完成，并提供过期预警 |