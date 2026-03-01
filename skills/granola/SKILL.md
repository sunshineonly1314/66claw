---
name: granola
name_zh: Granola
description: 访问 Granola 会议转录文本与笔记。
description_zh: 访问 Granola 会议转录文本与笔记。
homepage: https://granola.ai
metadata: {"clawdbot":{"emoji":"🥣","requires":{"bins":["python3"]}}}
---
# granola

访问 Granola 的会议转录文本、摘要与笔记。

## 设置

Granola 将会议数据存储在云端。如需本地访问，请执行以下步骤：

1. **安装依赖项：**  
```bash
pip install requests
```

2. **运行首次同步：**  
```bash
python ~/path/to/clawdbot/skills/granola/scripts/sync.py ~/granola-meetings
```

3. **通过 clawdbot cron 设置自动同步：**  
```javascript
clawdbot_cron({
  action: "add",
  job: {
    name: "Granola Sync",
    description: "Sync Granola meetings to local disk",
    schedule: { kind: "cron", expr: "0 */6 * * *", tz: "America/New_York" },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: {
      kind: "agentTurn",
      message: "Run the Granola sync: python {skillsDir}/granola/scripts/sync.py ~/granola-meetings",
      deliver: false
    }
  }
})
```

同步脚本从 `~/Library/Application Support/Granola/supabase.json` 中读取认证信息（该文件在 macOS 上登录 Granola 时自动生成）。

## 数据结构

同步完成后，每次会议对应一个独立文件夹：  
```
~/granola-meetings/
  {meeting-id}/
    metadata.json   - title, date, attendees
    transcript.md   - formatted transcript  
    transcript.json - raw transcript data
    document.json   - full API response
    notes.md        - AI summary (if available)
```

## 快捷命令

**列出最近的会议：**  
```bash
for d in $(ls -t ~/granola-meetings | head -10); do
  jq -r '"\(.created_at[0:10]) | \(.title)"' ~/granola-meetings/$d/metadata.json 2>/dev/null
done
```

**按标题搜索：**  
```bash
grep -l "client name" ~/granola-meetings/*/metadata.json | while read f; do
  jq -r '.title' "$f"
done
```

**搜索转录文本内容：**  
```bash
grep -ri "keyword" ~/granola-meetings/*/transcript.md
```

**查询某特定日期的会议：**  
```bash
for d in ~/granola-meetings/*/metadata.json; do
  if jq -e '.created_at | startswith("2026-01-03")' "$d" > /dev/null 2>&1; then
    jq -r '.title' "$d"
  fi
done
```

## 注意事项

- 同步需 Granola 桌面应用已登录（以获取认证令牌）；
- 认证令牌约 6 小时后过期；请打开 Granola 应用刷新令牌；
- 仅支持 macOS（认证文件路径为 macOS 特有）；
- 多设备场景下，建议仅在一台机器上执行同步，再通过 rsync 将文件夹同步至其他设备。