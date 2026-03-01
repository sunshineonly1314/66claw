---
name: caldav-calendar
name_zh: CalDAV日历
description: 使用 vdirsyncer + khal 同步和查询 CalDAV 日历（iCloud、Google、Fastmail、Nextcloud 等）。适用于 Linux。
description_zh: 使用 vdirsyncer + khal 同步和查询 CalDAV 日历（iCloud、Google、Fastmail、Nextcloud 等）。适用于 Linux。
metadata: {"clawdbot":{"emoji":"📅","os":["linux"],"requires":{"bins":["vdirsyncer","khal"]},"install":[{"id":"apt","kind":"download","packages":["vdirsyncer","khal"],"bins":["vdirsyncer","khal"],"label":"通过 apt 安装 vdirsyncer + khal"}]}}
---
# CalDAV 日历（vdirsyncer + khal）

**vdirsyncer** 将 CalDAV 日历同步至本地 `.ics` 文件。**khal** 读取并写入这些文件。

## 首先执行同步

在查询或修改日历后，务必先执行同步：
```bash
vdirsyncer sync
```

## 查看事件

```bash
khal list                        # Today
khal list today 7d               # Next 7 days
khal list tomorrow               # Tomorrow
khal list 2026-01-15 2026-01-20  # Date range
khal list -a Work today          # Specific calendar
```

## 搜索

```bash
khal search "meeting"
khal search "dentist" --format "{start-date} {title}"
```

## 创建事件

```bash
khal new 2026-01-15 10:00 11:00 "Meeting title"
khal new 2026-01-15 "All day event"
khal new tomorrow 14:00 15:30 "Call" -a Work
khal new 2026-01-15 10:00 11:00 "With notes" :: Description goes here
```

创建完成后，执行同步以推送更改：
```bash
vdirsyncer sync
```

## 编辑事件（交互式）

`khal edit` 是交互式命令——需运行于 TTY 环境。若用于自动化，请搭配 tmux 使用：

```bash
khal edit "search term"
khal edit -a CalendarName "search term"
khal edit --show-past "old event"
```

菜单选项：
- `s` → 编辑摘要（summary）
- `d` → 编辑描述（description）
- `t` → 编辑时间范围（datetime range）
- `l` → 编辑地点（location）
- `D` → 删除事件
- `n` → 跳过（保存当前更改，进入下一个匹配项）
- `q` → 退出

编辑完成后，执行同步：
```bash
vdirsyncer sync
```

## 删除事件

使用 `khal edit`，然后按 `D` 确认删除。

## 输出格式

适用于脚本调用：
```bash
khal list --format "{start-date} {start-time}-{end-time} {title}" today 7d
khal list --format "{uid} | {title} | {calendar}" today
```

占位符：`{title}`, `{description}`, `{start}`, `{end}`, `{start-date}`, `{start-time}`, `{end-date}`, `{end-time}`, `{location}`, `{calendar}`, `{uid}`

## 缓存

khal 将事件缓存于 `~/.local/share/khal/khal.db`。若同步后数据仍显示陈旧，请执行：
```bash
rm ~/.local/share/khal/khal.db
```

## 初始配置

### 1. 配置 vdirsyncer（`~/.config/vdirsyncer/config`）

iCloud 示例配置：
```ini
[general]
status_path = "~/.local/share/vdirsyncer/status/"

[pair icloud_calendar]
a = "icloud_remote"
b = "icloud_local"
collections = ["from a", "from b"]
conflict_resolution = "a wins"

[storage icloud_remote]
type = "caldav"
url = "https://caldav.icloud.com/"
username = "your@icloud.com"
password.fetch = ["command", "cat", "~/.config/vdirsyncer/icloud_password"]

[storage icloud_local]
type = "filesystem"
path = "~/.local/share/vdirsyncer/calendars/"
fileext = ".ics"
```

服务提供商 URL：
- iCloud：`https://caldav.icloud.com/`
- Google：使用 `google_calendar` 存储类型
- Fastmail：`https://caldav.fastmail.com/dav/calendars/user/EMAIL/`
- Nextcloud：`https://YOUR.CLOUD/remote.php/dav/calendars/USERNAME/`

### 2. 配置 khal（`~/.config/khal/config`）

```ini
[calendars]
[[my_calendars]]
path = ~/.local/share/vdirsyncer/calendars/*
type = discover

[default]
default_calendar = Home
highlight_event_days = True

[locale]
timeformat = %H:%M
dateformat = %Y-%m-%d
```

### 3. 发现日历并同步

```bash
vdirsyncer discover   # First time only
vdirsyncer sync
```