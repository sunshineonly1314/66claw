---
name: pocket-casts
name_zh: Pocket Casts YT
description: 下载 YouTube 视频并上传至 Pocket Casts Files，以便离线观看。仅限个人用途，且仅适用于您拥有版权或合法使用权的内容。
description_zh: 下载 YouTube 视频并上传至 Pocket Casts Files，以便离线观看。仅限个人用途，且仅适用于您拥有版权或合法使用权的内容。
version: 1.0.0
author: emmanuelem
---
# Pocket Casts YouTube 上传器

下载 YouTube 视频并上传至 Pocket Casts Files，实现离线观看。

## 使用方法

```bash
~/skills/pocket-casts/scripts/upload.sh "YOUTUBE_URL"
```

或指定自定义标题：
```bash
~/skills/pocket-casts/scripts/upload.sh "YOUTUBE_URL" "Custom Title"
```

## 前置依赖

### 必需组件
- **yt-dlp** — YouTube 下载器（通过 uv 安装：`uvx yt-dlp`）
- **ffmpeg** — 视频处理工具（`apt install ffmpeg`）
- **curl** — HTTP 请求工具（通常已预装）
- **jq** — JSON 解析工具（`apt install jq`）

### 推荐组件  
- **deno** — JavaScript 运行时，用于应对 yt-dlp 的挑战性验证：
  ```bash
  curl -fsSL https://deno.land/install.sh | sh
  ```
  请将其添加至 PATH：`export PATH="$HOME/.deno/bin:$PATH"`

## 设置步骤

1. **创建凭据目录：**  
   ```bash
   mkdir -p ~/.clawdbot/credentials/pocket-casts
   chmod 700 ~/.clawdbot/credentials/pocket-casts
   ```

2. **添加 Pocket Casts 刷新令牌（refresh token）：**  
   
   登录 pocketcasts.com 后，通过浏览器开发者工具获取您的刷新令牌，然后执行：  
   ```bash
   cat > ~/.clawdbot/credentials/pocket-casts/config.json << 'EOF'
   {
     "refreshToken": "YOUR_REFRESH_TOKEN_HERE"
   }
   EOF
   chmod 600 ~/.clawdbot/credentials/pocket-casts/config.json
   ```  
   
   刷新令牌有效期约为 1 年；访问令牌（access tokens）将自动获取。

3. **添加 YouTube Cookies（必需，绝大多数视频均需此步骤）：**  
   
   YouTube 的机器人检测机制要求使用已登录浏览器会话产生的 Cookies。
   
   - 安装浏览器扩展 “Get cookies.txt LOCALLY”（或类似工具）
   - 在已登录 YouTube 账户的状态下访问 youtube.com
   - 使用该扩展导出 Cookies
   - 将导出的文件保存至 `~/.clawdbot/credentials/pocket-casts/cookies.txt`
   
   ```bash
   chmod 600 ~/.clawdbot/credentials/pocket-casts/cookies.txt
   ```

## 工作原理

1. 通过 `yt-dlp --remux-video mp4` 下载视频  
2. 使用已存储的刷新令牌刷新 Pocket Casts 访问令牌  
3. 向 Pocket Casts API 请求预签名上传 URL（presigned upload URL）  
4. 通过预签名 URL 将文件 PUT 至 S3  
5. 删除本地视频文件  

## 环境变量

- `CLAWDBOT_CREDENTIALS` — 覆盖凭据目录路径（默认为 `~/.clawdbot/credentials`）

## 注意事项

- 文件将显示在 Pocket Casts 应用的 “Files（文件）” 标签页中  
- 视频可在 iOS / Android / Web 版应用中原生播放  
- 最大文件尺寸取决于您的 Pocket Casts 订阅等级（Plus 用户约为 2GB）  
- 若 YouTube 屏蔽请求，可能需要重新获取 Cookies  

## ⚠️ 法律免责声明

**本技能仅供个人、合理使用目的。**

- **YouTube 服务条款** 禁止除官方途径外的视频下载行为。根据您的司法管辖区及具体用途，下载行为可能违反 YouTube 的服务条款。
- **Pocket Casts 服务条款** 要求：您上传至 “Files” 图书馆的所有媒体内容，必须由您本人拥有版权或已获得合法授权。
- **著作权法** 因国家/地区而异。未经许可下载并存储受版权保护的内容，在您所在司法管辖区可能属违法行为。

使用本技能即视为您完全理解并承担全部责任，确保自身使用行为符合所有适用的服务条款与法律法规。作者不对任何滥用行为承担责任。

**推荐使用场景：** 个人录制内容、知识共享许可（Creative Commons）内容、您本人创作的视频，或内容创作者明确允许下载的视频。