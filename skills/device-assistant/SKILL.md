---
name: device-assistant
name_zh: 设备助手
version: 1.0.0
description: "个人设备与家电管家，支持错误代码查询与故障排查。集中管理所有设备（家电、电子设备、软件），记录型号、说明书、保修信息等。设备报错时，只需告知错误代码，即可即时获取解决方案。适用场景：设备显示错误、需查阅说明书、保修状态查询、新增设备登记、维护提醒。触发词：/device、/geräte、'我的洗碗机'、'错误 E24'、'错误提示'、设备问题、家电故障。"
description_zh: 个人设备与家电管家，支持错误代码查询与故障排查。集中管理所有设备（家电、电子设备、软件），记录型号、说明书、保修信息等。设备报错时，只需告知错误代码，即可即时获取解决方案。适用场景：设备显示错误、需查阅说明书、保修状态查询、新增设备登记、维护提醒。触发词：/device、/geräte、'我的洗碗机'、'错误 E24'、'错误提示'、设备问题、家电故障。
author: clawdbot
license: MIT
metadata:
  clawdbot:
    emoji: "🔧"
    triggers: ["/device", "/geräte"]
    requires:
      bins: ["jq", "curl"]
  tags: ["devices", "appliances", "troubleshooting", "maintenance", "home", "warranty"]
---
# 设备助手 🔧

集错误代码查询、故障排查与维护追踪于一体的个人设备管理工具。

## 功能特性

- **设备注册表**：统一记录各设备的型号、序列号、购买信息  
- **错误代码查询**：即时解析常见错误代码含义  
- **故障排查指南**：提供分步式解决方案  
- **说明书链接**：一键直达官方文档  
- **保修追踪**：实时掌握各设备保修到期时间  
- **维护提醒**：滤网更换、系统更新等关键节点提醒  

## 命令列表

| 命令 | 功能 |
|------|------|
| `/device` | 列出全部设备或显示当前状态 |
| `/device add` | 交互式添加新设备 |
| `/device list [category]` | 按类别列出设备 |
| `/device info <name>` | 显示指定设备详情 |
| `/device error <name> <code>` | 查询错误代码含义 |
| `/device help <name> <problem>` | 针对具体问题进行故障排查 |
| `/device manual <name>` | 获取说明书或技术文档 |
| `/device warranty` | 显示保修状态 |
| `/device maintenance` | 显示维护日程安排 |
| `/device remove <name>` | 删除某台设备 |

## 自然语言支持

本 skill 支持理解以下自然语言查询：

- *"我的洗碗机显示 E24"*
- *"洗衣机发出奇怪噪音"*
- *"哪里能找到 Thermomix 的说明书？"*
- *"电视的保修期什么时候到期？"*

## 设备分类

| 类别 | 示例设备 |
|------|----------|
| `kitchen` | 洗碗机、冰箱、烤箱、Thermomix |
| `laundry` | 洗衣机、烘干机 |
| `electronics` | 电视机、路由器、NAS、电脑 |
| `climate` | 暖气系统、空调、空气净化器 |
| `smart-home` | Hue、Homematic、各类传感器 |
| `software` | 应用程序、操作系统、软件许可证 |
| `other` | 其他未归类设备 |

## 处理器命令

```bash
handler.sh status $WORKSPACE                     # Overview
handler.sh list [category] $WORKSPACE            # List devices
handler.sh add <json> $WORKSPACE                 # Add device
handler.sh info <device-id> $WORKSPACE           # Device details
handler.sh error <device-id> <code> $WORKSPACE   # Error lookup
handler.sh troubleshoot <device-id> <problem> $WS # Get help
handler.sh manual <device-id> $WORKSPACE         # Manual link
handler.sh warranty $WORKSPACE                   # Warranty overview
handler.sh maintenance $WORKSPACE                # Maintenance due
handler.sh update <device-id> <json> $WORKSPACE  # Update device
handler.sh remove <device-id> $WORKSPACE         # Remove device
handler.sh search <query> $WORKSPACE             # Search devices
handler.sh log <device-id> <note> $WORKSPACE     # Add maintenance log
```

## 数据结构

### 设备条目格式

```json
{
  "id": "dishwasher-1",
  "name": "Geschirrspüler",
  "nickname": "Spüli",
  "category": "kitchen",
  "manufacturer": "Siemens",
  "model": "SN658X06TE",
  "serialNumber": "ABC123456",
  "purchaseDate": "2022-03-15",
  "purchasePrice": 899,
  "warranty": {
    "expires": "2025-03-15",
    "type": "manufacturer",
    "notes": "3 Jahre Siemens"
  },
  "manualUrl": "https://...",
  "supportUrl": "https://...",
  "location": "Küche",
  "notes": "Salz alle 2 Monate nachfüllen",
  "maintenance": [
    {"task": "Filter reinigen", "interval": "monthly", "lastDone": "2026-01-01"}
  ],
  "errorHistory": [],
  "addedAt": "2024-01-01"
}
```

## 错误代码查询机制

本 skill 通过以下三种方式查找错误代码：

1. **内置数据库**：覆盖主流厂商常见错误码  
2. **网络搜索**：结合具体型号与错误代码进行检索  
3. **手册提取**：若已存有说明书 URL，则直接从中提取信息  

### 常见错误代码格式

| 厂商 | 格式 | 示例 |
|------|------|------|
| Siemens/Bosch | E + 数字 | E24、E15 |
| Miele | F + 数字 | F11、F53 |
| AEG | E + 数字 | E10、E20 |
| Samsung | 字母 + 数字 | UE、OE、LE |
| LG | 字母组合 | OE、IE、PE |

## 示例会话

```
User: Ich habe einen neuen Geschirrspüler

Bot: 🔧 Neues Gerät hinzufügen:
     
     Welche Infos hast du?
     • Hersteller?
     • Modell?
     • Seriennummer? (optional)
     • Kaufdatum?

User: Siemens SN658X06TE, gekauft am 15.3.2022

Bot: ✅ Gespeichert!
     
     📦 Geschirrspüler (Siemens SN658X06TE)
     📅 Gekauft: 15.03.2022
     🛡️ Garantie: bis 15.03.2025 (ABGELAUFEN)
     📄 Anleitung: [Link gefunden]
     
     Spitzname vergeben? (z.B. "Spüli")
```

```
User: Mein Geschirrspüler zeigt E24

Bot: 🔧 Siemens SN658X06TE — Fehler E24
     
     ⚠️ Bedeutung: Abpumpproblem
     Das Wasser wird nicht richtig abgepumpt.
     
     🔨 Lösung:
     1. Gerät ausschalten
     2. Sieb am Boden prüfen und reinigen
     3. Abflussschlauch auf Knicke prüfen
     4. Siphon-Anschluss kontrollieren
     5. Gerät neu starten
     
     📄 Details: Anleitung S. 45
     
     [Problem gelöst] [Weitere Hilfe]
```

## 数据文件存储位置

所有数据文件均存于 `$WORKSPACE/memory/device-assistant/` 目录下：

| 文件 | 用途 |
|------|------|
| `devices.json` | 所有已注册设备信息 |
| `error-history.json` | 历史错误记录及对应解决方案 |
| `maintenance-log.json` | 维护历史记录 |
| `error-codes/` | 缓存的错误代码信息 |

## 保修到期提醒

本 skill 可在保修即将到期前主动提醒你：

```
⚠️ Garantie-Warnung:

Diese Geräte laufen bald ab:
• TV Samsung (noch 30 Tage)
• Waschmaschine (noch 45 Tage)

Tipp: Jetzt prüfen ob alles funktioniert!
```

## 系统要求

- `jq`（用于 JSON 数据处理）  
- `curl`（用于网络查询）  
- 网络连接（用于在线错误代码检索）