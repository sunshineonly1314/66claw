---
name: roku
name_zh: Roku
description: 通过 CLI 控制 Roku 设备。支持设备发现、遥控操作、应用启动、内容搜索，以及 HTTP 桥接模式以实现实时控制。
description_zh: 通过 CLI 控制 Roku 设备。支持设备发现、遥控操作、应用启动、内容搜索，以及 HTTP 桥接模式以实现实时控制。
homepage: https://github.com/gumadeiras/roku-cli
repository: https://github.com/gumadeiras/roku-cli
metadata: {"clawdbot":{"emoji":"📺","requires":{"bins":["roku"]},"install":[{"id":"node","kind":"node","package":"roku-ts-cli","bins":["roku"],"label":"安装 Roku CLI（npm）"}]}}
---
# Roku CLI

一款基于 ECP API 的快速 TypeScript 命令行工具，用于控制 Roku 设备。

## 安装方式

```bash
npm install -g roku-ts-cli@latest
```

## 快速入门

```bash
# Discover devices and save an alias
roku discover --save livingroom --index 1

# Use the alias
roku --host livingroom device-info
roku --host livingroom apps
```

## 命令列表

| 命令 | 描述 |
|------|------|
| `roku discover` | 在本地网络中查找 Roku 设备 |
| `roku --host <ip> device-info` | 获取设备信息 |
| `roku --host <ip> apps` | 列出已安装的应用 |
| `roku --host <ip> command <key>` | 发送遥控按键指令 |
| `roku --host <ip> literal <text>` | 输入文本 |
| `roku --host <ip> search --title <query>` | 搜索内容 |
| `roku --host <ip> launch <app>` | 启动应用 |
| `roku --host <ip> interactive` | 进入交互式遥控模式 |

## 交互模式

```bash
roku livingroom                    # interactive control
roku --host livingroom interactive # same thing
```

使用方向键、Enter 键和 Esc 键模拟遥控器操作。

## 桥接服务（Bridge Service）

将 HTTP 桥接服务作为原生操作系统服务长期运行：

```bash
# Install and start the service
roku bridge install-service --port 19839 --token secret --host livingroom --user
roku bridge start --user

# Service management
roku bridge status --user
roku bridge stop --user
roku bridge uninstall --user
```

通过 HTTP 接口发送控制命令：

```bash
# Send key
curl -X POST http://127.0.0.1:19839/key \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret" \
  -d '{"key":"home"}'

# Type text
curl -X POST http://127.0.0.1:19839/text \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret" \
  -d '{"text":"hello"}'

# Launch app
curl -X POST http://127.0.0.1:19839/launch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer secret" \
  -d '{"app":"plex"}'

# Health check
curl http://127.0.0.1:19839/health -H "Authorization: Bearer secret"
```

### 桥接服务端点（Bridge Endpoints）

| 端点 | 请求体（Body） |
|------|----------------|
| `POST /key` | `{"key": "home"}` |
| `POST /text` | `{"text": "hello"}` |
| `POST /search` | `{"title": "Stargate"}` |
| `POST /launch` | `{"app": "plex"}` |
| `GET /health` | — |
| `GET /health?deep=1` | 深度健康检查（探测 Roku 设备） |

## 别名（Aliases）

```bash
# Save device alias
roku discover --save livingroom --index 1
roku alias set office 192.168.1.20

# Save app alias  
roku alias set plex 13535

# List aliases
roku alias list

# Use aliases
roku --host livingroom launch plex
```

## 遥控按键列表

home（主页）、back（返回）、select（确认）、up（上）、down（下）、left（左）、right（右）、play（播放）、pause（暂停）、rev（倒带）、fwd（快进）、replay（重播）、info（信息）、power（电源）、volume_up（音量+）、volume_down（音量−）、mute（静音）

## 注意事项

- Roku 设备必须与运行 CLI 的主机处于同一局域网内  
- 桥接服务将以原生 launchd（macOS）或 systemd（Linux）服务形式运行  
- 使用 `--user` 标志可启用用户空间服务（无需 sudo 权限）  
- 在桥接模式下，使用 `--token` 参数进行身份验证  

## 源码地址

https://github.com/gumadeiras/roku-cli