---
name: strava-cycling-coach
name_zh: Strava 骑行教练
description: 从 Strava 跟踪并分析骑行表现。适用于分析骑行数据、回顾体能趋势、评估训练效果或提供骑行训练洞察。自动监控新骑行记录，并提供表现分析。
description_zh: 从 Strava 跟踪并分析骑行表现。适用于分析骑行数据、回顾体能趋势、评估训练效果或提供骑行训练洞察。自动监控新骑行记录，并提供表现分析。
---
# Strava 骑行教练（Strava Cycling Coach）

利用 Strava API 跟踪骑行表现、分析骑行记录，并监测体能进展。

## 设置步骤

### 1. 创建 Strava API 应用

访问 https://www.strava.com/settings/api 创建应用：  
- 应用名称：Clawdbot（或您自定义的名称）  
- 类别：Data Importer（数据导入器）  
- 所属俱乐部：（留空）  
- 网站：http://localhost  
- 授权回调域名：localhost  

请妥善保存您的 **Client ID** 和 **Client Secret**。

### 2. 运行设置脚本

```bash
cd skills/strava
./scripts/setup.sh
```

系统将提示您输入以下信息：  
1. Client ID  
2. Client Secret  
3. 访问 OAuth URL 完成授权  
4. 复制授权码，并运行以下命令完成设置：  

```bash
./scripts/complete_auth.py YOUR_CODE_HERE
```

### 3. 配置自动监控（可选）

如需在每次训练后自动获得骑行分析结果，请执行：

```bash
# Set your Telegram chat ID
export STRAVA_TELEGRAM_CHAT_ID="your_telegram_chat_id"

# Add to your shell profile for persistence
echo 'export STRAVA_TELEGRAM_CHAT_ID="your_telegram_chat_id"' >> ~/.bashrc

# Set up cron job (checks every 30 minutes)
crontab -l > /tmp/cron_backup.txt
echo "*/30 * * * * $(pwd)/scripts/auto_analyze_new_rides.sh" >> /tmp/cron_backup.txt
crontab /tmp/cron_backup.txt
```

### 4. 测试设置

分析您最近的骑行记录：  
```bash
./scripts/analyze_rides.py --days 90 --ftp YOUR_FTP
```

## 使用方法

获取最新一次骑行记录：  
```bash
scripts/get_latest_ride.py
```

分析指定骑行记录：  
```bash
scripts/analyze_ride.py <activity-id>
```

后台持续监控新骑行记录（常驻运行）：  
```bash
scripts/monitor_rides.sh
```

## 自动监控功能

该 agent 可自动执行以下操作：  
1. 每 30 分钟检查一次是否有新骑行记录  
2. 分析功率、心率及训练负荷  
3. 发送关于表现与体能趋势的洞察  
4. 与近期训练历史进行对比  

## 分析指标

- **功率（Power）**：平均功率、标准化功率、最大功率、变异性指数（Variability Index）  
- **心率（Heart rate）**：平均心率、最高心率、各心率区间耗时  
- **训练负荷（Training load）**：TSS 估算值、强度因子（Intensity Factor）  
- **体能进展（Fitness progression）**：随时间变化的趋势  
- **分段（Segments）**：个人最佳（PR）达成情况与分段努力数据  
- **对比分析（Comparative）**：与近期骑行记录或个人最佳成绩对比  

## 配置方式

编辑 `~/.config/strava/config.json` 文件以自定义以下设置：  
- 监控频率  
- 分析偏好  
- 通知设置  

## API 参考文档

完整 Strava API 文档详见 [references/api.md](references/api.md)。