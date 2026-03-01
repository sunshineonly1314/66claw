---
name: healthkit-sync
name_zh: HealthKit同步
description: iOS HealthKit 数据同步的 CLI 命令与模式。适用于使用 healthsync CLI、获取 Apple 健康数据（步数、心率、睡眠、训练）、通过本地网络配对 iOS 设备，或理解 iOS 健康同步项目架构（包括 mTLS 证书固定、Keychain 存储及审计日志）等场景。
description_zh: iOS HealthKit 数据同步的 CLI 命令与模式。适用于使用 healthsync CLI、获取 Apple 健康数据（步数、心率、睡眠、训练）、通过本地网络配对 iOS 设备，或理解 iOS 健康同步项目架构（包括 mTLS 证书固定、Keychain 存储及审计日志）等场景。
license: Apache-2.0
compatibility: macOS（需已安装 healthsync CLI，配置文件路径为 ~/.healthsync/config.json）
metadata:
  category: development
  platforms: ios,macos
  author: mneves
---
# HealthKit Sync CLI

使用 mTLS，安全地通过本地网络将 Apple HealthKit 数据从 iPhone 同步至 Mac。

## 何时使用该 skill

- 用户询问如何从 iPhone 同步健康数据  
- 用户提及 `healthsync` CLI 命令  
- 用户希望获取步数、心率、睡眠或训练数据  
- 用户需要将 Mac 与 iOS 设备配对  
- 用户询问 iOS 健康同步项目的架构  
- 用户提及证书固定或 mTLS 模式  

## CLI 快速参考

### 配对流程（首次使用）

```bash
# 1. Discover devices on local network
healthsync discover

# 2. On iOS app: tap "Share" to generate QR code, then "Copy"
# 3. Scan QR from clipboard (Universal Clipboard)
healthsync scan

# Alternative: scan from image file
healthsync scan --file ~/Desktop/qr.png
```

### 获取健康数据

```bash
# Check connection status
healthsync status

# List enabled data types
healthsync types

# Fetch data as CSV (default)
healthsync fetch --start 2026-01-01T00:00:00Z --end 2026-12-31T23:59:59Z --types steps

# Fetch multiple types as JSON
healthsync fetch --start 2026-01-01T00:00:00Z --end 2026-12-31T23:59:59Z \
  --types steps,heartRate,sleepAnalysis --format json | jq

# Pipe to file
healthsync fetch --start 2026-01-01T00:00:00Z --end 2026-12-31T23:59:59Z \
  --types steps > steps.csv
```

### 支持的健康数据类型

**活动（Activity）**: steps（步数）、distanceWalkingRunning（步行/跑步距离）、distanceCycling（骑行距离）、activeEnergyBurned（活跃能量消耗）、basalEnergyBurned（基础能量消耗）、exerciseTime（运动时长）、standHours（站立小时数）、flightsClimbed（爬楼层数）、workouts（训练记录）

**心脏（Heart）**: heartRate（心率）、restingHeartRate（静息心率）、walkingHeartRateAverage（步行平均心率）、heartRateVariability（心率变异性）

**生命体征（Vitals）**: bloodPressureSystolic（收缩压）、bloodPressureDiastolic（舒张压）、bloodOxygen（血氧饱和度）、respiratoryRate（呼吸频率）、bodyTemperature（体温）、vo2Max（最大摄氧量）

**睡眠（Sleep）**: sleepAnalysis（睡眠分析）、sleepInBed（卧床时间）、sleepAsleep（实际入睡时间）、sleepAwake（清醒时间）、sleepREM（REM 睡眠）、sleepCore（核心睡眠）、sleepDeep（深度睡眠）

**身体（Body）**: weight（体重）、height（身高）、bodyMassIndex（BMI）、bodyFatPercentage（体脂率）、leanBodyMass（瘦体重）

## 配置

配置文件存储于 `~/.healthsync/config.json`（权限：0600）：  
```json
{
  "host": "192.168.1.x",
  "port": 8443,
  "fingerprint": "sha256-certificate-fingerprint"
}
```

Token 存储于 macOS Keychain 中，服务名称为 `org.mvneves.healthsync.cli`。

## 安全架构

### 证书固定（Certificate Pinning）

CLI 通过 SHA256 指纹验证服务器证书（TOFU 模型）：  
1. 首次配对时，从二维码中保存指纹  
2. 后续连接均校验指纹是否匹配  
3. 不匹配则拒绝连接（防范中间人攻击）

### 仅限本地网络

主机验证将连接限制在以下范围内：  
- `localhost`、`*.local` 域名  
- 私有 IPv4 地址段：`192.168.*`、`10.*`、`172.16-31.*`  
- IPv6 回环地址：`::1`；链路本地地址：`fe80::`

### Keychain 存储

Token 绝不存于配置文件中，始终存于 Keychain，且具备：  
- `kSecAttrAccessibleWhenUnlocked` 保护类  
- 服务名：`org.mvneves.healthsync.cli`  
- 账户名：`token-{host}`

## 项目结构

```
ai-health-sync-ios-clawdbot/
├── iOS Health Sync App/          # Swift 6 iOS app
│   ├── Services/Security/        # CertificateService, KeychainStore, PairingService
│   ├── Services/HealthKit/       # HealthKitService, HealthSampleMapper
│   ├── Services/Network/         # NetworkServer (TLS), HTTPTypes
│   └── Services/Audit/           # AuditService (SwiftData)
└── macOS/HealthSyncCLI/          # Swift Package CLI
```

## 故障排查

**“未找到设备”**：  
- 确保 iOS 应用正在运行且已启用共享功能  
- 两台设备必须连接同一 Wi-Fi 网络  
- 检查防火墙是否阻止了 mDNS（端口 5353）

**“配对码已过期”**：  
- 在 iOS 应用中生成新的二维码（配对码 5 分钟后过期）

**“证书不匹配”**：  
- 删除 `~/.healthsync/config.json` 并重新配对  
- 服务器证书可能已被重新生成

**“连接被拒绝”**：  
- iOS 应用的服务端可能未运行  
- 运行 `healthsync status --dry-run` 进行无连接测试

## 参见

- [CLI 参考](references/CLI-REFERENCE.md) —— 详细命令文档  
- [安全模式](references/SECURITY.md) —— mTLS 与证书固定模式  
- [架构](references/ARCHITECTURE.md) —— iOS 应用架构详情