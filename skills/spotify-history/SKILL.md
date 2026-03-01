---
name: spotify-history
name_zh: Spotify 历史
description: 通过 Spotify Web API 访问 Spotify 听歌历史、最常听的艺术家/曲目，并获取个性化推荐。适用于获取用户近期播放记录、分析音乐品味或生成推荐场景。需一次性完成 OAuth 配置。
description_zh: 通过 Spotify Web API 访问 Spotify 听歌历史、最常听的艺术家/曲目，并获取个性化推荐。适用于获取用户近期播放记录、分析音乐品味或生成推荐场景。需一次性完成 OAuth 配置。
---
# Spotify 历史记录与推荐

访问 Spotify 听歌历史并获取个性化音乐推荐。

## 配置（一次性）

### 快速配置（推荐）

运行配置向导：  
```bash
bash skills/spotify-history/scripts/setup.sh
```  

该向导将引导您完成以下步骤：  
1. 创建 Spotify 开发者应用  
2. 安全保存凭据  
3. 授权访问权限  

### 手动配置

1. **创建 Spotify 开发者应用**  
   - 访问 [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)  
   - 点击 **Create App**（创建应用）  
   - 填写以下信息：  
     - **App name（应用名称）：** `Clawd`（或任意名称）  
     - **App description（应用描述）：** `Personal assistant integration`  
     - **Redirect URI（重定向 URI）：** `http://127.0.0.1:8888/callback` ⚠️ 请严格使用该精确 URL！  
   - 保存后复制 **Client ID（客户端 ID）** 和 **Client Secret（客户端密钥）**  

2. **存储凭据**  

   **选项 A：凭据文件（推荐）**  
   ```bash
   mkdir -p credentials
   cat > credentials/spotify.json <<EOF
   {
     "client_id": "your_client_id",
     "client_secret": "your_client_secret"
   }
   EOF
   chmod 600 credentials/spotify.json
   ```  

   **选项 B：环境变量**  
   ```bash
   # Add to ~/.zshrc or ~/.bashrc
   export SPOTIFY_CLIENT_ID="your_client_id"
   export SPOTIFY_CLIENT_SECRET="your_client_secret"
   ```  

3. **身份认证**  

   **带浏览器方式（本地机器）：**  
   ```bash
   python3 scripts/spotify-auth.py
   ```  

   **无头模式（无浏览器）：**  
   ```bash
   python3 scripts/spotify-auth.py --headless
   ```  
   按提示通过 URL 授权，并粘贴回调地址。  

访问令牌将保存至 `~/.config/spotify-clawd/token.json`，并在过期时自动刷新。

## 使用方法

### 命令行调用

```bash
# Recent listening history
python3 scripts/spotify-api.py recent

# Top artists (time_range: short_term, medium_term, long_term)
python3 scripts/spotify-api.py top-artists medium_term

# Top tracks
python3 scripts/spotify-api.py top-tracks medium_term

# Get recommendations based on your top artists
python3 scripts/spotify-api.py recommend

# Raw API call (any endpoint)
python3 scripts/spotify-api.py json /me
python3 scripts/spotify-api.py json /me/player/recently-played
```

### 时间范围

- `short_term` —— 近约 4 周  
- `medium_term` —— 近约 6 个月（默认）  
- `long_term` —— 全部时间  

### 示例输出

```
Top Artists (medium_term):
  1. Hans Zimmer [soundtrack, score]
  2. John Williams [soundtrack, score]
  3. Michael Giacchino [soundtrack, score]
  4. Max Richter [ambient, modern classical]
  5. Ludovico Einaudi [italian contemporary classical]
```

## Agent 使用方式

当用户询问音乐相关内容时：  
- “我最近都在听什么？” → `spotify-api.py recent`  
- “我最常听的艺术家是谁？” → `spotify-api.py top-artists`  
- “推荐一些新音乐” → `spotify-api.py recommend` + 并结合您自身的音乐知识  

对于推荐功能，请结合 API 数据与音乐知识，推荐用户曲库中尚未包含但风格相似的艺术家。

## 故障排除

### “未找到 Spotify 凭据！”
- 确保 `credentials/spotify.json` 文件存在 **或** 已设置环境变量  
- 系统优先检查凭据文件，其次检查环境变量  
- 运行 `bash skills/spotify-history/scripts/setup.sh` 创建凭据文件  

### “未完成身份认证。请先运行 spotify-auth.py。”
- 访问令牌不存在或已失效  
- 运行：`python3 scripts/spotify-auth.py`（若无浏览器，请附加 `--headless` 参数）  

### 刷新令牌时出现 “HTTP 错误 400：错误请求”
- 凭据已更改或无效  
- 重新运行配置流程：`bash skills/spotify-history/scripts/setup.sh`  
- 或更新 `credentials/spotify.json` 文件，填入正确的 Client ID / Client Secret  

### “HTTP 错误 401：未授权”
- 访问令牌已过期且自动刷新失败  
- 删除现有令牌并重新认证：  
  ```bash
  rm ~/.config/spotify-clawd/token.json
  python3 scripts/spotify-auth.py
  ```  

### 无头模式 / 无浏览器环境
- 使用 `--headless` 标志：`python3 scripts/spotify-auth.py --headless`  
- 在任意设备上手动打开认证 URL  
- 复制回调 URL（以 `http://127.0.0.1:8888/callback?code=...` 开头）  
- 在提示时将其粘贴回终端  

## 安全说明

- 访问令牌以 0600 权限存储（仅属主可读写）  
- 客户端密钥应严格保密  
- 重定向 URI 使用 `127.0.0.1`（仅限本地），保障安全性  

## 所需权限范围（Scopes）

- `user-read-recently-played` —— 近期听歌历史  
- `user-top-read` —— 最常听的艺术家与曲目  
- `user-read-playback-state` —— 当前播放状态  
- `user-read-currently-playing` —— 当前正在播放的曲目  