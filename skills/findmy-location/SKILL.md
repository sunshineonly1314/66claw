---
name: findmy-location
name_zh: 定位查询
description: 通过 Apple Find My 以街道级精度追踪共享联系人的位置。通过读取地图地标返回地址、城市及上下文（家/公司/外出）。支持配置已知地点，并对未知地点启用视觉（vision）回退机制。
description_zh: 通过 Apple Find My 以街道级精度追踪共享联系人的位置。通过读取地图地标返回地址、城市及上下文（家/公司/外出）。支持配置已知地点，并对未知地点启用视觉（vision）回退机制。
---
# Find My 位置追踪

通过 Apple Find My 以街道拐角级精度追踪共享联系人。

## 要求

- **macOS** 13+（需安装 Find My 应用）  
- **Python** 3.9+  
- **iCloud 账户** 已登录您的 Mac（用于访问 Find My）  
- **位置共享** 已从您希望追踪的联系人处启用  
- **peekaboo** — 屏幕读取命令行工具（[GitHub](https://github.com/steipete/peekaboo)）  
- **Hammerspoon**（可选）— 提供可靠的 UI 点击支持（[hammerspoon.org](https://www.hammerspoon.org/)）  

## 前置条件

### 1. iCloud 与 Find My 设置

您的 Mac 必须使用已启用 Find My 的 iCloud 账户登录：  
- 系统设置 → Apple ID → iCloud → “查找我的 Mac”（已启用）  
- 您希望追踪的人必须通过 Find My 将其位置共享给该 iCloud 账户  

### 2. 安装 peekaboo

```bash
brew install steipete/tap/peekaboo
```

安装时按提示授予 **辅助功能（Accessibility）** 与 **屏幕录制（Screen Recording）** 权限（系统设置 → 隐私与安全性）。

### 3. 安装 Hammerspoon（可选但推荐）

Hammerspoon 提供跨所有应用的可靠点击支持。若未安装，点击偶尔可能作用于错误窗口。

```bash
brew install hammerspoon
open -a Hammerspoon
```

添加至 `~/.hammerspoon/init.lua`：  
```lua
local server = hs.httpserver.new(false, false)
server:setPort(9090)
server:setCallback(function(method, path, headers, body)
    local data = body and hs.json.decode(body) or {}
    if path == "/click" then
        hs.eventtap.leftClick({x=data.x, y=data.y})
        return hs.json.encode({status="clicked", x=data.x, y=data.y}), 200, {}
    end
    return hs.json.encode({error="not found"}), 404, {}
end)
server:start()
```

重新加载配置（Hammerspoon 菜单 → 重新加载配置），然后创建 `~/.local/bin/hsclick`：  
```bash
#!/bin/bash
curl -s -X POST localhost:9090/click -d "{\"x\":$2,\"y\":$3}"
chmod +x ~/.local/bin/hsclick
```

## 安装

```bash
git clone https://github.com/poiley/findmy-location.git
cd findmy-location
./install.sh
```

或通过 ClawdHub 安装：  
```bash
clawdhub install findmy-location
```

## 配置

创建 `~/.config/findmy-location/config.json`：  
```json
{
  "target": "John",
  "known_locations": [
    {
      "name": "home",
      "address": "123 Main St, City, ST",
      "markers": ["landmark near home"]
    },
    {
      "name": "work",
      "address": "456 Office Blvd, City, ST",
      "markers": ["landmark near work"]
    }
  ]
}
```

| 字段 | 描述 |
|------|------|
| `target` | 待追踪的联系人姓名（可选，默认为首个共享联系人） |
| `known_locations` | 您希望标注地址的地点数组 |
| `markers` | 在 Find My 地图上该地点可见的地标 |

## 使用方法

```bash
findmy-location          # Human-readable output
findmy-location --json   # JSON output
```

### 示例输出

```
123 Main St, City, ST (home) - Now
```

```json
{
  "person": "contact@email.com",
  "address": "Main St & 1st Ave",
  "city": "Anytown",
  "state": "WA",
  "status": "Now",
  "context": "out",
  "screenshot": "/tmp/findmy-12345.png",
  "needs_vision": false
}
```

| 字段 | 描述 |
|------|------|
| `context` | `home`、`work`、`out` 或 `unknown` |
| `needs_vision` | 若 `true`，则对截图启用 AI 视觉分析以识别街道名称 |
| `screenshot` | 截获的地图图像路径 |

## 工作原理

1. 打开 Find My 应用并选择目标联系人  
2. 截取地图并读取辅助功能（accessibility）数据  
3. 将可见地标与已配置的已知地点进行匹配  
4. 返回地址与上下文，或标记为需视觉分析  

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| 点击作用于错误窗口 | 安装 Hammerspoon（参见前置条件） |
| “未找到人员” | 确保 Find My 中已启用位置共享 |
| 始终显示 `needs_vision: true` | 为常去地点添加地标标记 |
| 权限错误 | 为 peekaboo 授予辅助功能 + 屏幕录制权限 |

## 许可证

MIT  