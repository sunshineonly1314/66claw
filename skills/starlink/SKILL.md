---
name: starlink
name_zh: Starlink
version: 1.0.0
description: 通过本地 gRPC API 控制 Starlink 卫星天线。可获取状态、列出 WiFi 客户端、运行测速、收起/展开天线、重启设备及获取 GPS 位置。适用于用户询问 Starlink、网络状态、已连接设备或卫星连接性等场景。
description_zh: 通过本地 gRPC API 控制 Starlink 卫星天线。可获取状态、列出 WiFi 客户端、运行测速、收起/展开天线、重启设备及获取 GPS 位置。适用于用户询问 Starlink、网络状态、已连接设备或卫星连接性等场景。
homepage: https://github.com/danfedick/starlink-cli
metadata: {"clawdbot":{"emoji":"📡","requires":{"bins":["starlink"]},"install":[{"id":"cargo","kind":"download","git":"https://github.com/danfedick/starlink-cli","bins":["starlink"],"label":"Install starlink-cli (cargo)"}]}}
---
# Starlink CLI

通过其位于 `192.168.100.1:9200` 的本地 gRPC API，从命令行控制您的 Starlink 天线。

## 安装

```bash
cargo install --git https://github.com/danfedick/starlink-cli
```

需预先安装 Rust 及 `protoc`（Protocol Buffers 编译器）。

## 命令

### 状态查询  
获取天线状态、运行时长、信噪比（SNR）、延迟、吞吐量及遮挡情况：  
```bash
starlink status
starlink status --json
```

### WiFi 客户端列表  
列出连接至 Starlink 路由器的所有设备：  
```bash
starlink clients
starlink clients --json
```  

输出字段包括：设备名称、MAC 地址、IP 地址、信号强度、接口类型（2.4GHz / 5GHz / ETH）、连接时间。

### 测速  
通过天线运行网络速度测试：  
```bash
starlink speedtest
starlink speedtest --json
```  

返回下载/上传速率（Mbps）及延迟。

### 收起 / 展开天线  
为运输或存放将天线收平：  
```bash
starlink stow           # stow
starlink stow --unstow  # unstow and resume
```

### 重启  
重启天线设备：  
```bash
starlink reboot
```

### 位置信息  
获取 GPS 坐标（需在 Starlink App → 设置 → 高级 → 调试数据 → “允许本地网络访问” 中启用）：  
```bash
starlink location
starlink location --json
```

## 输出格式

- **默认格式**：带颜色的人类可读输出  
- **--json**：JSON 格式，适用于脚本调用或解析  

JSON 解析示例：  
```bash
starlink status --json | jq '.latency_ms'
starlink clients --json | jq '.[] | .name'
```

## 系统要求

- 已接入 Starlink 网络  
- 天线可通过 `192.168.100.1:9200` 访问  
- 如需获取位置信息：请先在 Starlink App 中启用对应功能  

## 故障排除

**“无法连接到 Starlink 天线”**  
- 确认您已连接 Starlink WiFi 或通过网线直连路由器  
- 检查：`ping 192.168.100.1`  
- 若使用旁路模式（bypass mode）搭配自有路由器，请确保 192.168.100.1 仍可路由  

**位置信息返回为空**  
- 在 Starlink App 中启用：设置 → 高级 → 调试数据 → “允许本地网络访问”

## 限制说明

- 设备暂停/恢复功能暂不可用（此为 Starlink App 云端专属功能）  
- 仅支持本地网络访问，不支持远程控制  

## 源码

https://github.com/danfedick/starlink-cli