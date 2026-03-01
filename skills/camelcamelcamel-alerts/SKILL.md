---
name: camelcamelcamel-alerts
name_zh: CamelAlerts
description: 通过 RSS 监控 CamelCamelCamel 价格下降提醒，并在商品打折时发送 Telegram 通知。适用于借助 CamelCamelCamel 价格提醒功能，为亚马逊商品设置自动价格追踪的场景。
description_zh: 通过 RSS 监控 CamelCamelCamel 价格下降提醒，并在商品打折时发送 Telegram 通知。适用于借助 CamelCamelCamel 价格提醒功能，为亚马逊商品设置自动价格追踪的场景。
---
# CamelCamelCamel 价格提醒

自动监控您的 CamelCamelCamel RSS 订阅源，检测亚马逊商品降价，并通过 Telegram 向您推送通知。

## 快速入门

1. **从 CamelCamelCamel 获取您的 RSS 订阅源 URL：**  
   - 访问 https://camelcamelcamel.com/ 并设置价格提醒  
   - 获取您个人的 RSS 订阅源 URL（格式：`https://camelcamelcamel.com/alerts/YOUR_UNIQUE_ID.xml`）

2. **使用您自己的订阅源 URL 创建 cron 任务（切勿使用他人 URL！）：**

```bash
cron add \
  --job '{
    "name": "camelcamelcamel-monitor",
    "schedule": "0 */12 * * *",
    "task": "Monitor CamelCamelCamel price alerts",
    "command": "python3 /path/to/scripts/fetch_rss.py https://camelcamelcamel.com/alerts/YOUR_UNIQUE_ID.xml"
  }'
```

**重要提示**：请将 `YOUR_UNIQUE_ID` 替换为第 1 步中您获得的专属 feed ID！每位用户均需使用自己的订阅源 URL！

3. **Clawdbot 将执行以下操作：**  
   - 每 4 小时获取一次您的订阅源  
   - 检测新增的价格提醒  
   - 向您发送 Telegram 通知  

## 工作原理

该 skill 由两个组件构成：

### `scripts/fetch_rss.py`  
- 获取您的 CamelCamelCamel RSS 订阅源  
- 解析价格提醒条目  
- 与本地缓存比对，识别新增提醒  
- 输出包含新发现条目的 JSON  
- 缓存条目哈希值，防止重复通知  

### Cron 集成  
- 按您定义的时间表运行  
- 触发 `fetch_rss.py`  
- 可配置为每小时、每 4 小时、每日等频率运行  

## 设置与配置  

**详见 [SETUP.md](references/SETUP.md)：**  
- 如何获取您的 CamelCamelCamel RSS 订阅源 URL  
- 分步式 cron 配置指南  
- 自定义检查频率  
- 缓存管理  
- 故障排查  

## 提醒缓存  

脚本在 `/tmp/camelcamelcamel/cache.json` 维护一个缓存，用于记录已通知的提醒，从而避免重复通知。  

**清空缓存** 以重新测试通知：  
```bash
rm /tmp/camelcamelcamel/cache.json
```  

## 通知格式  

当检测到新的价格下降时，您将收到如下 Telegram 消息：  

```
🛒 *Price Alert*

*PRODUCT NAME - $XX.XX (Down from $YY.YY)*

Current price: $XX.XX
Historical low: $ZZ.ZZ
Last checked: [timestamp]

View on Amazon: [link]
```  

## 自定义选项  

### 检查频率  

调整 cron 时间表（`schedule` 字段的第 6 个参数）：  
- `0 * * * *` → 每小时一次  
- `0 */4 * * *` → 每 4 小时一次（默认）  
- `0 */6 * * *` → 每 6 小时一次  
- `0 0 * * *` → 每日一次  

### 消息格式  

编辑 `scripts/notify.sh`，自定义 Telegram 消息的排版与表情符号。  

## 技术细节  

- **语言**：Python 3（仅使用内置库）  
- **缓存**：位于 `/tmp/camelcamelcamel/cache.json` 的 JSON 文件  
- **订阅源格式**：标准 RSS/XML  
- **依赖项**：除 Python 标准库外无需额外依赖  
- **超时**：每次订阅源获取最多 10 秒  

## 故障排查  

若您未收到通知，请按以下步骤排查：  

1. **验证订阅源 URL** 是否可在浏览器中正常打开  
2. **检查 cron 任务** 是否已创建：`cron list`  
3. **手动测试**：  
   ```bash
   python3 scripts/fetch_rss.py <YOUR_FEED_URL> /tmp/camelcamelcamel
   ```  
4. **清空缓存** 以重置状态：  
   ```bash
   rm /tmp/camelcamelcamel/cache.json
   ```  
5. **确认 Telegram** 已在 Clawdbot 中完成配置  

更多详情请参阅 [SETUP.md](references/SETUP.md)。  