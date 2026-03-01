---
name: apple-music
name_zh: 苹果音乐
description: 搜索 Apple Music、将歌曲添加至资料库、管理播放列表、控制播放与 AirPlay。
description_zh: 搜索 Apple Music、将歌曲添加至资料库、管理播放列表、控制播放与 AirPlay。
metadata: {"clawdbot":{"emoji":"🎵","os":["darwin"],"requires":{"bins":["node","curl"]}}}
---
# Apple Music

通过 MusicKit API 和 AppleScript 控制 Apple Music。路径：`~/.clawdbot/skills/apple-music/`

## 本地（无需配置）

**播放控制：** `./apple-music.sh player [now|play|pause|toggle|next|prev|shuffle|repeat|volume N|song "name"]`  
**AirPlay：** `./apple-music.sh airplay [list|select N|add N|remove N]`

## API（需配置）

需 Apple 开发者账号（99 美元/年）及 MusicKit 密钥。

### 配置步骤

**首先完成开发者门户操作：**  
1. 访问 developer.apple.com → Keys → 创建 MusicKit 密钥 → 下载 .p8 文件  
2. 记下你的 Key ID 和 Team ID  

**然后运行配置命令：**  
```bash
./launch-setup.sh  # Opens Terminal for interactive setup
```  

启动器将打开 Terminal.app 并在其中运行配置脚本。请依次输入 .p8 文件路径、Key ID、Team ID；随后在浏览器中完成授权，并将获取的 token 粘贴回终端。

**⚠️ agents：** 务必使用 `./launch-setup.sh` 打开 Terminal。切勿通过聊天界面运行 setup.sh（该脚本需要交互式输入）。

### 命令

- `search "query" [--type songs|albums|artists] [--limit N]`  
- `library add <song-id>`  
- `playlists [list|create "Name"|add <playlist-id> <song-id>]`  

### 配置

`config.json` 存储 token（有效期约 6 个月）。若认证失败，请重新运行 `./setup.sh`。

### 错误

- 401：token 已过期，请重新运行配置  
- 403：请检查 Apple Music 订阅状态  
- 404：ID 无效或受地区限制  

### 配置问题排查

- **授权页面返回 404：** 配置脚本会通过内置 HTTP 服务器自动修复验证流程  
- **浏览器中未显示 token：** 请重启 setup.sh  
- **浏览器无法自动打开：** 请手动访问终端中打印出的 URL（推荐使用 Chrome）