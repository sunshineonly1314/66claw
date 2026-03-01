---
name: bluesky
name_zh: Bluesky
description: 通过命令行界面（CLI）读取、发布和与 Bluesky（AT 协议）交互。当用户要求检查 Bluesky、向 Bluesky 发布内容、查看其 Bluesky 时间线、搜索 Bluesky 或检查 Bluesky 通知时使用。支持时间线浏览、内容发布、个人资料查询、搜索及通知功能。
description_zh: 通过命令行界面（CLI）读取、发布和与 Bluesky（AT 协议）交互。当用户要求检查 Bluesky、向 Bluesky 发布内容、查看其 Bluesky 时间线、搜索 Bluesky 或检查 Bluesky 通知时使用。支持时间线浏览、内容发布、个人资料查询、搜索及通知功能。
homepage: https://bsky.app
metadata:
  clawdbot:
    emoji: "🦋"
    requires:
      bins: ["python3"]
---
# Bluesky CLI

通过命令行与 Bluesky/AT 协议交互。

## 设置

首次设置需从 Bluesky 获取应用密码：
1. 访问 bsky.app → 设置 → 隐私与安全 → 应用密码
2. 创建一个新的应用密码
3. 运行：`bsky login --handle yourhandle.bsky.social --password xxxx-xxxx-xxxx-xxxx`

凭据将保存在 `~/.config/bsky/config.json` 中。

## 命令

```bash
# Authentication
bsky login --handle user.bsky.social --password xxxx-xxxx-xxxx-xxxx
bsky whoami

# Timeline
bsky timeline              # Show home feed (10 posts)
bsky timeline -n 20        # Show 20 posts
bsky tl                    # Alias

# Posting
bsky post "Hello world!"   # Create a post
bsky p "Short post"        # Alias

# Delete
bsky delete <post_id>      # Delete a post by ID or URL
bsky rm <url>              # Alias

# Profiles
bsky profile               # Your profile
bsky profile @someone.bsky.social

# Search
bsky search "query"        # Search posts
bsky search "offsec" -n 20

# Notifications
bsky notifications         # Likes, reposts, follows, mentions
bsky notif -n 30           # Alias with count
```

## 输出格式

时间线与搜索结果将显示：
```
@handle · Jan 25 14:30
  Post text (truncated to 200 chars)
  ❤️ likes  🔁 reposts  💬 replies
  🔗 https://bsky.app/profile/handle/post/id
```

## 安装

该 skill 使用 Python 虚拟环境。首次运行时：
```bash
cd {baseDir}/scripts
python3 -m venv venv
./venv/bin/pip install atproto
```

随后通过以下方式运行命令：
```bash
{baseDir}/scripts/venv/bin/python {baseDir}/scripts/bsky.py [command]
```

或使用封装脚本：
```bash
{baseDir}/scripts/bsky [command]
```