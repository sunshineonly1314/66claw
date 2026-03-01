---
name: enzoldhazam
name_zh: Enzoldhazam
description: 控制 NGBS iCON 智能家居恒温器。当用户询问家庭温度、供暖、恒温器控制，或希望调节房间温度时使用。
description_zh: 控制 NGBS iCON 智能家居恒温器。当用户询问家庭温度、供暖、恒温器控制，或希望调节房间温度时使用。
---
# enzoldhazam

通过 enzoldhazam.hu 控制 NGBS iCON 智能家居恒温器。

## 设置

1. 安装 CLI：
```bash
git clone https://github.com/daniel-laszlo/enzoldhazam.git
cd enzoldhazam
go build -o enzoldhazam ./cmd/enzoldhazam
sudo mv enzoldhazam /usr/local/bin/
```

2. 登录（凭据将保存至 macOS 钥匙串）：
```bash
enzoldhazam login
```

或设置环境变量：
```bash
export ENZOLDHAZAM_USER="your-email"
export ENZOLDHAZAM_PASS="your-password"
```

## 命令

| 命令 | 描述 |
|---------|-------------|
| `enzoldhazam status` | 显示所有房间及其当前温度 |
| `enzoldhazam status --json` | 输出 JSON 格式，便于解析 |
| `enzoldhazam get <room>` | 获取指定房间的详细信息 |
| `enzoldhazam set <room> <temp>` | 设置目标温度 |
| `enzoldhazam login` | 将凭据保存至钥匙串 |
| `enzoldhazam logout` | 清除已保存的凭据 |

## 示例

```bash
# Check current temperatures
enzoldhazam status

# Set a room to 22°C
enzoldhazam set "Living Room" 22

# Get room info as JSON
enzoldhazam get "Bedroom" --json
```

## 操作说明

当用户询问家庭温度、供暖或恒温器相关问题时：

1. 使用 `enzoldhazam status` 检查当前状态  
2. 使用 `enzoldhazam set <room> <temp>` 更改温度  
3. 当需要处理数据时，解析 `--json` 的输出  

在执行任何温度调整操作前，务必先向用户确认。