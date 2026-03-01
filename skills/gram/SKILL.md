---
name: gram
name_zh: Gram
description: 一款用于通过 Cookie 查看 Instagram 动态、帖子、个人资料及互动数据的命令行工具。
description_zh: 一款用于通过 Cookie 查看 Instagram 动态、帖子、个人资料及互动数据的命令行工具。
homepage: https://github.com/arein/gram
metadata: {"clawdbot":{"emoji":"📸","requires":{"bins":["gram"]},"install":[{"id":"npm","kind":"node","package":"@cyberdrk/gram","bins":["gram"],"label":"安装 gram（npm）"}]}}
---
# gram 📸

基于 REST/GraphQL API 并采用 Cookie 认证的 Instagram 命令行工具。

## 安装

```bash
# npm/pnpm/bun
npm install -g @cyberdrk/gram

# One-shot (no install)
bunx @cyberdrk/gram whoami
```

## 认证

`gram` 使用您 Instagram 网页端会话的 Cookie 认证。

可通过 `--session-id`、`--csrf-token` 和 `--ds-user-id` 直接传入 Cookie，或使用 `--cookie-source` 读取浏览器中的 Cookie。

运行 `gram check` 可查看当前启用的 Cookie 来源。对于 Arc 或 Brave 浏览器，请使用 `--chrome-profile-dir <path>`。

## 命令

### 账户与认证

```bash
gram whoami                    # Show logged-in account
gram check                     # Show credential sources
gram query-ids --refresh       # Refresh GraphQL query ID cache
```

### 查看帖子

```bash
gram post <shortcode-or-url>   # View a post
gram <shortcode-or-url>        # Shorthand for post
gram comments <shortcode> -n 20 # View comments on a post
gram likers <shortcode>        # View users who liked a post
```

### 动态（Feeds）

```bash
gram feed -n 20                # Home feed
gram explore -n 20             # Explore/discover feed
```

### 用户个人资料

```bash
gram user <username>           # View user profile
gram user @instagram --json    # JSON output
gram posts <username> -n 20    # User's posts
gram following [username]      # Users someone follows (defaults to you)
gram followers [username]      # Someone's followers (defaults to you)
```

### 搜索

```bash
gram search "query"            # Search users, hashtags, places
gram search "coffee" --type users
gram search "nyc" --type places
gram search "#photography" --type hashtags
```

### 互动操作（Engagement Actions）

```bash
gram like <shortcode>          # Like a post
gram unlike <shortcode>        # Unlike a post
gram save <shortcode>          # Save/bookmark a post
gram unsave <shortcode>        # Unsave a post
gram comment <shortcode> "nice!" # Comment on a post
gram follow <username>         # Follow a user
gram unfollow <username>       # Unfollow a user
```

## 输出选项

```bash
--json          # JSON output
--json-full     # JSON with raw API response in _raw field
--plain         # No emoji, no color (script-friendly)
--no-emoji      # Disable emoji
--no-color      # Disable ANSI colors (or set NO_COLOR=1)
```

## 全局选项

```bash
--session-id <token>           # Instagram sessionid cookie
--csrf-token <token>           # Instagram csrftoken cookie
--ds-user-id <id>              # Instagram ds_user_id cookie
--cookie-source <source>       # Cookie source for browser cookies (repeatable)
--chrome-profile <name>        # Chrome profile name
--chrome-profile-dir <path>    # Chrome/Chromium profile dir or cookie DB path
--firefox-profile <name>       # Firefox profile
--timeout <ms>                 # Request timeout
--cookie-timeout <ms>          # Cookie extraction timeout
```

## 配置文件

`~/.config/gram/config.json5`（全局）或 `./.gramrc.json5`（项目级）：

```json5
{
  cookieSource: ["safari", "chrome"],
  chromeProfile: "Profile 1",
  timeoutMs: 60000
}
```

环境变量：`GRAM_TIMEOUT_MS`、`GRAM_COOKIE_TIMEOUT_MS`

## 故障排查

### 查询 ID 过期（返回 404 错误）
```bash
gram query-ids --refresh
```

### Cookie 提取失败
- 确认浏览器已登录 Instagram；
- 尝试不同的 `--cookie-source`；
- 对于 Arc/Brave 浏览器：使用 `--chrome-profile-dir`；
- 手动提供 Cookie：`--session-id`、`--csrf-token`、`--ds-user-id`。

### 用户-agent 不匹配错误
- CLI 默认使用桌面端用户-agent；
- 若您的会话是在移动端创建的，则可能失败；
- 请通过桌面浏览器重新登录，创建新的会话。

---

**一句话总结**：通过命令行查看动态、个人资料、执行搜索及互动操作。📸