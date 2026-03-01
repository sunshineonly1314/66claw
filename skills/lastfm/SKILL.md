---
name: lastfm
name_zh: Last.fm
description: 访问 Last.fm 听歌历史、音乐统计数据与发现功能。可查询近期播放曲目、热门艺术家/专辑/曲目、喜爱曲目、相似艺术家及全球排行榜。
description_zh: 访问 Last.fm 听歌历史、音乐统计数据与发现功能。可查询近期播放曲目、热门艺术家/专辑/曲目、喜爱曲目、相似艺术家及全球排行榜。
---
# Last.fm API Skill

访问 Last.fm 听歌历史、音乐统计数据与发现功能。

## 配置

**必需的环境变量**（请添加至 shell 配置文件，或可选地 `~/.clawdbot/.env`）：  
- `LASTFM_API_KEY` — 您的 Last.fm API 密钥（[在此申请](https://www.last.fm/api/account/create)）  
- `LASTFM_USER` — 您的 Last.fm 用户名  

**基础 URL**：`http://ws.audioscrobbler.com/2.0/`  
**文档**：https://lastfm-docs.github.io/api-docs/  

## 示例输出  

以下是长达 17 年以上的 scrobbling 数据呈现效果：

```
Total scrobbles: 519,778
Unique artists: 13,763
Unique tracks: 68,435
Unique albums: 33,637

Top Artists (all time):
• System of a Down (52,775 plays)
• Eminem (15,400 plays)
• Dashboard Confessional (10,166 plays)
• Edguy (10,161 plays)
• Metallica (9,927 plays)

Top Tracks (all time):
• System of a Down - Aerials (1,405 plays)
• System of a Down - Toxicity (1,215 plays)
• System of a Down - Sugar (1,149 plays)
• System of a Down - Chop Suey (1,116 plays)
• System of a Down - Prison Song (1,102 plays)
```  

## 快速参考  

所有请求均使用 GET 方法，并携带以下基础参数：  
```
?api_key=$LASTFM_API_KEY&format=json&user=$LASTFM_USER
```  

### 用户端点  

#### 近期播放曲目（当前播放 / 最近播放）  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=$LASTFM_USER&api_key=$LASTFM_API_KEY&format=json&limit=10"
```  
- 第一首曲目若带有 `@attr.nowplaying=true` 参数，表示当前正在播放  
- 返回字段：艺术家、曲目名、专辑、时间戳、图片  

#### 用户信息（个人资料统计）  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=$LASTFM_USER&api_key=$LASTFM_API_KEY&format=json"
```  
- 返回字段：总播放次数、艺术家数量、曲目数量、专辑数量、注册日期  

#### 热门艺术家  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=user.gettopartists&user=$LASTFM_USER&api_key=$LASTFM_API_KEY&format=json&period=7day&limit=10"
```  
- `period`：overall（全部时间）｜7day（7 天）｜1month（1 个月）｜3month（3 个月）｜6month（6 个月）｜12month（12 个月）  

#### 热门专辑  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=user.gettopalbums&user=$LASTFM_USER&api_key=$LASTFM_API_KEY&format=json&period=7day&limit=10"
```  

#### 热门曲目  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=user.gettoptracks&user=$LASTFM_USER&api_key=$LASTFM_API_KEY&format=json&period=7day&limit=10"
```  

#### 喜爱曲目  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=user.getlovedtracks&user=$LASTFM_USER&api_key=$LASTFM_API_KEY&format=json&limit=10"
```  

#### 每周排行榜  
```bash
# Weekly artist chart
curl -s "http://ws.audioscrobbler.com/2.0/?method=user.getweeklyartistchart&user=$LASTFM_USER&api_key=$LASTFM_API_KEY&format=json"

# Weekly track chart
curl -s "http://ws.audioscrobbler.com/2.0/?method=user.getweeklytrackchart&user=$LASTFM_USER&api_key=$LASTFM_API_KEY&format=json"

# Weekly album chart
curl -s "http://ws.audioscrobbler.com/2.0/?method=user.getweeklyalbumchart&user=$LASTFM_USER&api_key=$LASTFM_API_KEY&format=json"
```  

### 艺术家/曲目/专辑信息  

#### 艺术家信息  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=artist.getinfo&artist=Tame+Impala&api_key=$LASTFM_API_KEY&format=json&username=$LASTFM_USER"
```  
- 添加 `username` 参数可包含该艺术家在您账户中的播放次数  

#### 相似艺术家  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=Tame+Impala&api_key=$LASTFM_API_KEY&format=json&limit=10"
```  

#### 艺术家热门曲目  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=Tame+Impala&api_key=$LASTFM_API_KEY&format=json&limit=10"
```  

#### 曲目信息  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=track.getinfo&artist=Tame+Impala&track=The+Less+I+Know+The+Better&api_key=$LASTFM_API_KEY&format=json&username=$LASTFM_USER"
```  

#### 相似曲目  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=Tame+Impala&track=Elephant&api_key=$LASTFM_API_KEY&format=json&limit=10"
```  

#### 专辑信息  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=album.getinfo&artist=Tame+Impala&album=Currents&api_key=$LASTFM_API_KEY&format=json&username=$LASTFM_USER"
```  

### 搜索  

#### 搜索艺术家  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=artist.search&artist=tame&api_key=$LASTFM_API_KEY&format=json&limit=5"
```  

#### 搜索曲目  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=track.search&track=elephant&api_key=$LASTFM_API_KEY&format=json&limit=5"
```  

#### 搜索专辑  
```bash
curl -s "http://ws.audioscrobbler.com/2.0/?method=album.search&album=currents&api_key=$LASTFM_API_KEY&format=json&limit=5"
```  

### 排行榜（全球）  

```bash
# Top artists globally
curl -s "http://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&api_key=$LASTFM_API_KEY&format=json&limit=10"

# Top tracks globally
curl -s "http://ws.audioscrobbler.com/2.0/?method=chart.gettoptracks&api_key=$LASTFM_API_KEY&format=json&limit=10"
```  

### 标签（Tags）  

```bash
# Top albums for a tag/genre
curl -s "http://ws.audioscrobbler.com/2.0/?method=tag.gettopalbums&tag=psychedelic&api_key=$LASTFM_API_KEY&format=json&limit=10"

# Top artists for a tag
curl -s "http://ws.audioscrobbler.com/2.0/?method=tag.gettopartists&tag=brazilian&api_key=$LASTFM_API_KEY&format=json&limit=10"
```  

## 实用 jq 过滤器  

如需处理 JSON 数据，请参阅 [ClawdHub 上的 jq skill](https://clawdhub.com/skills/jq)。  

```bash
# Recent tracks: artist - track
jq '.recenttracks.track[] | "\(.artist["#text"]) - \(.name)"'

# Top artists: name (playcount)
jq '.topartists.artist[] | "\(.name) (\(.playcount))"'

# Check if currently playing
jq '.recenttracks.track[0] | if .["@attr"].nowplaying == "true" then "Now playing: \(.artist["#text"]) - \(.name)" else "Last played: \(.artist["#text"]) - \(.name)" end'
```  

## 注意事项  

- 只读端点无需身份验证（仅需 API 密钥）  
- 速率限制：请合理使用，官方未设定硬性上限  
- 艺术家/曲目/专辑名称需进行 URL 编码（空格 → `+` 或 `%20`）  
- 图片尺寸包括：small（小）、medium（中）、large（大）、extralarge（超大）  