---
name: alexa-cli
name_zh: Alexa CLI
description: 通过 `alexacli` CLI 控制 Amazon Alexa 设备及智能家居。当用户要求在 Echo 设备上语音播报/广播、控制灯光/恒温器/门锁、发送语音指令，或向 Alexa 发起查询时使用。
description_zh: 通过 `alexacli` CLI 控制 Amazon Alexa 设备及智能家居。当用户要求在 Echo 设备上语音播报/广播、控制灯光/恒温器/门锁、发送语音指令，或向 Alexa 发起查询时使用。
homepage: https://github.com/buddyh/alexa-cli
metadata: {"clawdbot":{"emoji":"🔊","requires":{"bins":["alexacli"]},"install":[{"id":"brew","kind":"brew","formula":"buddyh/tap/alexacli","bins":["alexacli"],"label":"Install alexacli (brew)"},{"id":"go","kind":"go","module":"github.com/buddyh/alexa-cli/cmd/alexa@latest","bins":["alexacli"],"label":"Install alexa-cli (go)"}]}}
---
# Alexa CLI

使用 `alexacli` 通过非官方 Alexa API 控制 Amazon Echo 设备及智能家居。

## 设备列表

```bash
alexacli devices
alexacli devices --json
```

## 文本转语音（TTS）

```bash
# Speak on a specific device
alexacli speak "Hello world" -d "Kitchen Echo"

# Announce to ALL devices
alexacli speak "Dinner is ready!" --announce

# Device name matching is flexible
alexacli speak "Build complete" -d Kitchen
```

## 语音指令（智能家居控制）

发送任意指令，如同您亲口对 Alexa 下达命令：

```bash
# Lights
alexacli command "turn off the living room lights" -d Kitchen
alexacli command "dim the bedroom lights to 50 percent" -d Bedroom

# Thermostat
alexacli command "set thermostat to 72 degrees" -d Bedroom

# Locks
alexacli command "lock the front door" -d Kitchen

# Music
alexacli command "play jazz music" -d "Living Room"

# Timers
alexacli command "set a timer for 10 minutes" -d Kitchen
```

`-d` 标志用于指定由哪台 Echo 设备执行该指令。

## 提问（获取 Alexa 返回文本响应）

发送指令并捕获 Alexa 返回的文本响应：

```bash
alexacli ask "what's the thermostat set to" -d Kitchen
# Output: The thermostat is set to 68 degrees.

alexacli ask "what's on my calendar today" -d Kitchen --json
```

适用于查询设备状态或获取 Alexa 特定信息。

## 历史记录

```bash
alexacli history
alexacli history --limit 5 --json
```

## 命令参考

| 命令 | 描述 |
|------|------|
| `alexacli devices` | 列出所有 Echo 设备 |
| `alexacli speak <text> -d <device>` | 在指定设备上执行文本转语音 |
| `alexacli speak <text> --announce` | 向所有设备广播通知 |
| `alexacli command <text> -d <device>` | 执行语音指令（智能家居、音乐等） |
| `alexacli ask <text> -d <device>` | 发送指令并返回 Alexa 的文本响应 |
| `alexacli history` | 查看近期语音活动记录 |
| `alexacli auth` | 配置身份认证 |

## 注意事项

- 使用 Amazon 的非官方 API（与 Alexa App 相同）  
- 刷新令牌有效期约 14 天；若过期，请重新运行 `alexacli auth`  
- 设备名称支持模糊匹配与大小写不敏感匹配  
- 在 AI/agent 场景下，推荐使用 `alexacli command` 并以自然语言表达指令  