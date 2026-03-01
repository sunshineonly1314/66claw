---
name: upload-post
name_zh: 上传发布
description: "通过 Upload-Post API 将内容上传至社交媒体平台。当用户需要向 TikTok、Instagram、YouTube、LinkedIn、Facebook、X（Twitter）、Threads、Pinterest、Reddit 或 Bluesky 发布视频、图片、文字或文档时启用。支持定时发布、数据分析、FFmpeg 处理及上传历史记录。"
description_zh: 通过 Upload-Post API 将内容上传至社交媒体平台。当用户需要向 TikTok、Instagram、YouTube、LinkedIn、Facebook、X（Twitter）、Threads、Pinterest、Reddit 或 Bluesky 发布视频、图片、文字或文档时启用。支持定时发布、数据分析、FFmpeg 处理及上传历史记录。
---
# Upload-Post API

通过单次 API 调用，将内容发布至多个社交媒体平台。

## 文档

- 完整 API 文档：https://docs.upload-post.com  
- LLM 友好版文档：https://docs.upload-post.com/llm.txt  

## 设置步骤

1. 在 [upload-post.com](https://upload-post.com) 注册账户  
2. 关联您的社交媒体账号  
3. 创建一个 **Profile**（例如：“mybrand”）——该 Profile 将关联您已连接的所有账号  
4. 在控制台生成一个 **API 密钥**  
5. 在 API 请求中，将 Profile 名称作为 `user` 参数传入  

## 认证方式

```
Authorization: Apikey YOUR_API_KEY
```

基础 URL：`https://api.upload-post.com/api`

所有端点中的 `user` 参数均指代您的 **Profile 名称**（非用户名），该名称决定哪些已连接的社交账号将接收内容。

## 端点参考

| 端点 | 方法 | 描述 |
|------|------|------|
| `/upload_videos` | POST | 上传视频 |
| `/upload_photos` | POST | 上传图片/轮播图 |
| `/upload_text` | POST | 纯文字帖 |
| `/upload_document` | POST | 上传文档（仅限 LinkedIn） |
| `/uploadposts/status?request_id=X` | GET | 查询异步上传状态 |
| `/uploadposts/history` | GET | 上传历史记录 |
| `/uploadposts/schedule` | GET | 列出已定时发布的帖子 |
| `/uploadposts/schedule/<job_id>` | DELETE | 取消已定时发布的帖子 |
| `/uploadposts/schedule/<job_id>` | PATCH | 编辑已定时发布的帖子 |
| `/uploadposts/me` | GET | 验证 API 密钥有效性 |
| `/analytics/<profile>` | GET | 获取数据分析结果 |
| `/uploadposts/facebook/pages` | GET | 列出 Facebook 页面 |
| `/uploadposts/linkedin/pages` | GET | 列出 LinkedIn 页面 |
| `/uploadposts/pinterest/boards` | GET | 列出 Pinterest 画板 |
| `/uploadposts/reddit/detailed-posts` | GET | 获取含媒体的 Reddit 帖子 |
| `/ffmpeg` | POST | 使用 FFmpeg 处理媒体 |

## 上传视频

```bash
curl -X POST "https://api.upload-post.com/api/upload_videos" \
  -H "Authorization: Apikey YOUR_KEY" \
  -F "user=profile_name" \
  -F "platform[]=instagram" \
  -F "platform[]=tiktok" \
  -F "video=@video.mp4" \
  -F "title=My caption"
```

关键参数：
- `user`：Profile 用户名（必需）
- `platform[]`：目标平台（必需）
- `video`：视频文件或 URL（必需）
- `title`：标题/说明文字（必需）
- `description`：扩展描述
- `scheduled_date`：ISO-8601 格式定时时间
- `timezone`：IANA 时区（例如：“Europe/Madrid”）
- `async_upload`：设为 `true` 以启用后台处理
- `first_comment`：自动发布首条评论

## 上传图片

```bash
curl -X POST "https://api.upload-post.com/api/upload_photos" \
  -H "Authorization: Apikey YOUR_KEY" \
  -F "user=profile_name" \
  -F "platform[]=instagram" \
  -F "photos[]=@photo1.jpg" \
  -F "photos[]=@photo2.jpg" \
  -F "title=My caption"
```

Instagram 与 Threads 支持混合轮播（同一则帖子中同时包含图片与视频）。

## 上传文字

```bash
curl -X POST "https://api.upload-post.com/api/upload_text" \
  -H "Authorization: Apikey YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "user": "profile_name",
    "platform": ["x", "threads", "bluesky"],
    "title": "My text post"
  }'
```

支持平台：X、LinkedIn、Facebook、Threads、Reddit、Bluesky。

## 上传文档（仅限 LinkedIn）

将 PDF、PPT、DOC 文件作为原生 LinkedIn 文档帖上传（支持轮播查看器）。

```bash
curl -X POST "https://api.upload-post.com/api/upload_document" \
  -H "Authorization: Apikey YOUR_KEY" \
  -F "user=profile_name" \
  -F 'platform[]=linkedin' \
  -F "document=@presentation.pdf" \
  -F "title=Document Title" \
  -F "description=Post text above document"
```

参数：
- `document`：PDF、PPT、PPTX、DOC、DOCX（最大 100MB，最多 300 页）
- `title`：文档标题（必需）
- `description`：发帖评论
- `visibility`：PUBLIC、CONNECTIONS、LOGGED_IN、CONTAINER
- `target_linkedin_page_id`：发布至公司主页

## 支持的平台

| 平台 | 视频 | 图片 | 文字 | 文档 |
|------|------|------|------|------|
| TikTok | ✓ | ✓ | - | - |
| Instagram | ✓ | ✓ | - | - |
| YouTube | ✓ | - | - | - |
| LinkedIn | ✓ | ✓ | ✓ | ✓ |
| Facebook | ✓ | ✓ | ✓ | - |
| X（Twitter） | ✓ | ✓ | ✓ | - |
| Threads | ✓ | ✓ | ✓ | - |
| Pinterest | ✓ | ✓ | - | - |
| Reddit | - | ✓ | ✓ | - |
| Bluesky | ✓ | ✓ | ✓ | - |

## 上传历史记录

```bash
curl "https://api.upload-post.com/api/uploadposts/history?page=1&limit=20" \
  -H "Authorization: Apikey YOUR_KEY"
```

参数：
- `page`：页码（默认为 1）
- `limit`：每页条目数（10、20、50 或 100，默认为 10）

返回内容：上传时间戳、平台、成功状态、发布链接、错误信息。

## 定时发布

添加 `scheduled_date` 参数（ISO-8601 格式）：

```json
{
  "scheduled_date": "2026-02-01T10:00:00Z",
  "timezone": "Europe/Madrid"
}
```

响应中包含 `job_id`。可通过以下接口管理：
- `GET /uploadposts/schedule` —— 列出全部已定时帖子
- `DELETE /uploadposts/schedule/<job_id>` —— 取消定时
- `PATCH /uploadposts/schedule/<job_id>` —— 编辑（时间、标题、说明文字）

## 查询上传状态

针对异步上传或已定时发布的帖子：

```bash
curl "https://api.upload-post.com/api/uploadposts/status?request_id=XXX" \
  -H "Authorization: Apikey YOUR_KEY"
```

或对已定时帖子使用 `job_id`。

## 数据分析

```bash
curl "https://api.upload-post.com/api/analytics/profile_name?platforms=instagram,tiktok" \
  -H "Authorization: Apikey YOUR_KEY"
```

支持平台：Instagram、TikTok、LinkedIn、Facebook、X、YouTube、Threads、Pinterest、Reddit、Bluesky。

返回内容：关注者数、曝光量、覆盖人数、个人资料浏览量、时间序列数据。

## 获取页面/画板列表

```bash
# Facebook Pages
curl "https://api.upload-post.com/api/uploadposts/facebook/pages" \
  -H "Authorization: Apikey YOUR_KEY"

# LinkedIn Pages  
curl "https://api.upload-post.com/api/uploadposts/linkedin/pages" \
  -H "Authorization: Apikey YOUR_KEY"

# Pinterest Boards
curl "https://api.upload-post.com/api/uploadposts/pinterest/boards" \
  -H "Authorization: Apikey YOUR_KEY"
```

## Reddit 详细帖子

获取含完整媒体信息（图片、相册、视频）的帖子：

```bash
curl "https://api.upload-post.com/api/uploadposts/reddit/detailed-posts?profile_username=myprofile" \
  -H "Authorization: Apikey YOUR_KEY"
```

返回最多 2000 条含媒体 URL、尺寸、缩略图的帖子。

## FFmpeg 编辑器

使用自定义 FFmpeg 命令处理媒体：

```bash
curl -X POST "https://api.upload-post.com/api/ffmpeg" \
  -H "Authorization: Apikey YOUR_KEY" \
  -F "file=@input.mp4" \
  -F "full_command=ffmpeg -y -i {input} -c:v libx264 -crf 23 {output}" \
  -F "output_extension=mp4"
```

- 使用 `{input}` 和 `{output}` 占位符  
- 轮询作业状态直至 `FINISHED`  
- 从 `/ffmpeg/job/<job_id>/download` 下载处理结果  
- 支持多个输入：`{input0}`、`{input1}` 等  

配额：免费版每月 30 分钟，基础版 300 分钟，专业版 1000 分钟，高级版 3000 分钟，企业版 10000 分钟。

## 平台专属参数

详见 [references/platforms.md](references/platforms.md)

## 媒体要求

详见 [references/requirements.md](references/requirements.md)，含各平台格式规范。

## 错误代码

| 代码 | 含义 |
|------|------|
| 400 | 请求错误 / 缺少必要参数 |
| 401 | API 密钥无效 |
| 404 | 资源未找到 |
| 429 | 请求频率超限 / 配额耗尽 |
| 500 | 服务器内部错误 |

## 注意事项

- 若视频处理时间超过 59 秒，系统将自动转为异步模式  
- X 平台长文本默认生成线程，除非指定 `x_long_text_as_post=true`  
- Facebook 发布必须提供页面 ID（Meta API 不支持个人资料）  
- Instagram / Threads 支持混合轮播（图片 + 视频）