---
name: unifi
name_zh: UniFi
description: 通过本地网关 API（Cloud Gateway Max / UniFi OS）查询和监控 UniFi 网络。当用户要求“检查 UniFi”、“列出 UniFi 设备”、“显示当前网络上的设备”、“UniFi 客户端”、“UniFi 健康状态”、“热门应用”、“网络告警”、“UniFi DPI”或提及 UniFi 监控/状态/仪表板时使用。
description_zh: 通过本地网关 API（Cloud Gateway Max / UniFi OS）查询和监控 UniFi 网络。当用户要求“检查 UniFi”、“列出 UniFi 设备”、“显示当前网络上的设备”、“UniFi 客户端”、“UniFi 健康状态”、“热门应用”、“网络告警”、“UniFi DPI”或提及 UniFi 监控/状态/仪表板时使用。
version: 1.0.1
metadata:
  clawdbot:
    emoji: "📡"
    requires:
      bins: ["curl", "jq"]
---
# UniFi 网络监控 skill

通过本地 UniFi OS 网关 API（已在 Cloud Gateway Max 上测试）监控并查询您的 UniFi 网络。

## 目的

本 skill 提供对 UniFi 网络运行数据的**只读**访问权限：
- 设备（AP、交换机、网关）状态与健康状况
- 活跃客户端（谁在何处连接）
- 网络健康概览
- 流量洞察（通过 DPI 统计的热门应用）
- 最近告警与事件

所有操作均为**仅 GET 请求**，适用于监控/报告场景，安全无风险。

## 配置

创建凭据文件：`~/.clawdbot/credentials/unifi/config.json`

```json
{
  "url": "https://10.1.0.1",
  "username": "api",
  "password": "YOUR_PASSWORD",
  "site": "default"
}
```

- `url`：您的 UniFi OS 网关 IP 地址/主机名（HTTPS）
- `username`：本地 UniFi OS 管理员用户名
- `password`：本地 UniFi OS 管理员密码
- `site`：站点名称（通常为 `default`）

## 命令

所有命令均支持可选的 `json` 参数以输出原始 JSON（默认为人类可读的表格格式）。

### 网络仪表板

全面展示所有网络统计信息（健康状态、设备、客户端、网络、DPI 等）：

```bash
bash scripts/dashboard.sh
bash scripts/dashboard.sh json  # Raw JSON for all sections
```

**输出：** 包含全部指标的完整 ASCII 仪表板。

### 列出设备

显示所有 UniFi 设备（AP、交换机、网关）：

```bash
bash scripts/devices.sh
bash scripts/devices.sh json  # Raw JSON
```

**输出：** 设备名称、型号、IP 地址、状态、运行时间、已连接客户端数

### 列出活跃客户端

显示当前已连接的设备：

```bash
bash scripts/clients.sh
bash scripts/clients.sh json  # Raw JSON
```

**输出：** 主机名、IP 地址、MAC 地址、接入点（AP）、信号强度、接收/发送速率

### 健康状态摘要

全站点范围的健康状态：

```bash
bash scripts/health.sh
bash scripts/health.sh json  # Raw JSON
```

**输出：** 子系统状态（WAN、LAN、WLAN），以及各状态设备数量（在线/已采用/断开）

### 热门应用（DPI）

按应用分类的带宽消耗排名：

```bash
bash scripts/top-apps.sh
bash scripts/top-apps.sh 15  # Show top 15 (default: 10)
```

**输出：** 应用名称、类别、接收/发送/总计流量（单位：GB）

### 最近告警

最近的告警与事件：

```bash
bash scripts/alerts.sh
bash scripts/alerts.sh 50  # Show last 50 (default: 20)
```

**输出：** 时间戳、告警键、消息内容、受影响设备

## 工作流

当用户询问 UniFi 相关问题时：

1. **“我的网络上有哪些设备？”** → 运行 `bash scripts/devices.sh` + `bash scripts/clients.sh`  
2. **“一切是否正常？”** → 运行 `bash scripts/health.sh`  
3. **“是否存在异常？”** → 运行 `bash scripts/alerts.sh`  
4. **“哪些应用正在占用带宽？”** → 运行 `bash scripts/top-apps.sh`  
5. **“显示仪表板”** 或常规健康检查 → 运行 `bash scripts/dashboard.sh`  

在向用户呈现结果前，请始终确认输出合理（检查认证失败、空数据等情况）。

## 注意事项

- 需要能访问您的 UniFi 网关的网络连通性
- 使用 UniFi OS 登录凭证 + `/proxy/network` API 路径
- 所有调用均为**只读 GET 请求**
- 已测试的端点详见 `references/unifi-readonly-endpoints.md`

## 参考资料

- [已测试端点](references/unifi-readonly-endpoints.md) —— Cloud Gateway Max 上经验证的全部只读 API 调用清单