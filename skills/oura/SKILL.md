---
name: oura
description: 该工具可通过命令行界面（CLI）从 Oura Ring API（V2 版本）获取健康与生物特征数据。可用于回答有关用户睡眠、活动量、准备度（readiness）及生理指标等方面的问题。
description_zh: 该工具可通过命令行界面（CLI）从 Oura Ring API（V2 版本）获取健康与生物特征数据。可用于回答有关用户睡眠、活动量、准备度（readiness）及生理指标等方面的问题。
---
# Oura Ring CLI Skill

## 描述
该工具可通过命令行界面（CLI）从 Oura Ring API（V2 版本）获取健康与生物特征数据。可用于回答有关用户睡眠、活动量、准备度（readiness）及生理指标等方面的问题。

代码仓库：[https://github.com/ruhrpotter/oura-cli](https://github.com/ruhrpotter/oura-cli)

## 安装

### 1. 构建 CLI
```bash
cd ~
git clone https://github.com/ruhrpotter/oura-cli.git
cd oura-cli
go build -o oura ./cmd/oura
```

### 2. 创建 Oura OAuth 应用
1. 访问 [Oura 开发者门户](https://cloud.ouraring.com/oauth/developer)
2. 创建一个新应用
3. 将重定向 URI（Redirect URI）设为：`http://localhost:8080/callback`
4. 记下您的 **Client ID** 和 **Client Secret**

### 3. 认证
```bash
export OURA_CLIENT_ID="your_client_id"
export OURA_CLIENT_SECRET="your_client_secret"
./oura auth login
```

系统将自动打开浏览器进行 OAuth 授权。令牌将保存在 `~/.config/oura-cli/config.json` 中。

## 前置条件
CLI 必须已完成认证。若某条命令因认证失败而报错，请提示用户运行 `./oura auth login`。

## 语法
`./oura get <category> [flags]`

## 类别
- `personal`：用户档案（年龄、体重、身高、邮箱）。
- `sleep`：每日睡眠得分与效率。
- `activity`：每日活动得分、步数及运动量。
- `readiness`：每日准备度（readiness）得分，反映恢复状态。
- `heartrate`：心率时间序列数据。
- `workout`：详细锻炼会话记录。
- `spo2`：血氧饱和度（SpO₂）水平。
- `sleep-details`：详细睡眠会话记录（含睡眠周期图 hypnogram）。
- `sessions`：活动会话（例如小睡、休息）。
- `sleep-times`：最佳就寝时间建议。
- `stress`：每日压力水平。
- `resilience`：每日韧性（resilience）得分与恢复状态。
- `cv-age`：心血管年龄估算值。
- `vo2-max`：最大摄氧量（VO₂ Max）测量值。
- `ring-config`：戒指硬件配置（颜色、尺寸等）。
- `rest-mode`：休息模式时段。
- `tags`：增强型标签（备注、生活方式选择等）。

## 参数
- `--start <YYYY-MM-DD>`：大多数时间序列数据所必需。指定日期范围的起始日期。
- `--end <YYYY-MM-DD>`：可选。指定日期范围的结束日期。若省略，可能默认为起始日期，或根据上下文返回单日数据。

## Agent 指令
1.  **日期解析**：您**必须**将所有相对日期表述（例如“今天”、“昨天”、“上周”、“本月”）基于当前操作日期，解析为绝对的 `YYYY-MM-DD` 字符串格式。
2.  **日期范围**：
    - 对于“今天”：将 `--start` 设为今日日期。
    - 对于“昨天”：将 `--start` 设为昨日日期。
    - 对于“过去 7 天”：将 `--start` 设为 7 天前的日期，`--end` 设为今日日期。
3.  **路径**：除非用户另行指定，否则默认二进制文件位于当前工作目录下的 `./oura`。
4.  **输出**：CLI 返回 JSON 格式数据。请解析 JSON 中的 `data` 数组，并据此生成自然语言响应。

## 示例

**用户请求**：“我昨晚的睡眠情况如何？”  
**上下文**：今天是 2024-03-15。“昨晚”通常指结束于今日清晨的睡眠会话，或取决于 Oura 的日期标记方式（Oura 按睡眠结束的早晨日期来标记睡眠）。  
**推理**：3 月 14 日至 15 日晚上的睡眠被记录为 `2024-03-15`。  
**命令**：  
```bash
./oura get sleep --start 2024-03-15
```

**用户请求**：“我今天的准备度（readiness）得分是多少？”  
**上下文**：今天是 2024-03-15。  
**命令**：  
```bash
./oura get readiness --start 2024-03-15
```

**用户请求**：“显示我 2024 年 1 月第一周的心率数据。”  
**命令**：  
```bash
./oura get heartrate --start 2024-01-01 --end 2024-01-07
```

**用户请求**：“我是谁？”  
**命令**：  
```bash
./oura get personal
```