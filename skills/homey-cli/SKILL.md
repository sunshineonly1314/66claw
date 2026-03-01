---
name: homey-cli
name_zh: Homey CLI
description: 通过 CLI 控制 Homey 家庭自动化中枢。适用于需要控制智能家居设备（如灯具、恒温器、插座等）、检查设备状态、列出区域（zones）、触发自动化流程（flows），或执行任意 Homey 自动化任务的场景。支持开关控制、调光、颜色变更、温度调节及设备检测。仅允许经 capability 白名单验证的安全操作。
description_zh: 通过 CLI 控制 Homey 家庭自动化中枢。适用于需要控制智能家居设备（如灯具、恒温器、插座等）、检查设备状态、列出区域（zones）、触发自动化流程（flows），或执行任意 Homey 自动化任务的场景。支持开关控制、调光、颜色变更、温度调节及设备检测。仅允许经 capability 白名单验证的安全操作。
---
# Homey CLI

安全、agent 友好的命令行工具，用于控制 Homey 家庭自动化中枢。

## 本 skill 提供的功能

- **设备控制**：开关设备、调节灯光亮度、更改颜色、设定温度  
- **设备检测**：列出设备、检查状态、读取 capability  
- **区域（zone）管理**：列出区域及各区域内设备  
- **流程（flow）控制**：列出并触发自动化流程（flows）  
- **设备总览**：获取中枢（hub）完整信息  

## 设置

### 1. 安装依赖项

```bash
cd skills/homey-cli
npm install
```

### 2. 创建 Homey 应用凭据

1. 访问 https://tools.developer.homey.app/tools/app  
2. 创建新应用，配置如下：  
   - **回调 URL（Callback URL）**：`http://localhost:8787/callback`  
   - 记下您的 **Client ID** 和 **Client Secret**  

### 3. 配置环境

创建 `.env` 文件：

```bash
export HOMEY_CLIENT_ID="your-client-id"
export HOMEY_CLIENT_SECRET="your-client-secret"
export HOMEY_REDIRECT_URL="http://localhost:8787/callback"
```

### 4. 登录

```bash
bash run.sh auth login
```

按浏览器中的 OAuth 流程操作。令牌将保存于 `~/.config/homey-cli/`。

## 使用方法

### 列出所有 Homey 设备

```bash
bash run.sh homey list
```

### 选择当前活跃的 Homey 设备

```bash
bash run.sh homey use <homeyId>
```

### 设备操作

```bash
# List all devices
bash run.sh devices list

# List devices as JSON
bash run.sh devices list --json

# Get specific device
bash run.sh devices get <deviceId>

# Read capability value
bash run.sh devices read <deviceId> onoff

# Control devices
bash run.sh devices on <deviceId>
bash run.sh devices off <deviceId>
bash run.sh devices dim <deviceId> 0.4
bash run.sh devices color <deviceId> #FF8800
bash run.sh devices temperature <deviceId> 21.5
```

### 流程（flow）操作

```bash
# List flows
bash run.sh flows list

# Trigger flow
bash run.sh flows trigger <flowId>
```

### 完整设备总览

```bash
bash run.sh inventory --json
```

## 安全模型

写入类操作采用 **capability 白名单机制** 保障安全性：

- 默认允许的 capability：`onoff`、`dim`、`light_hue`、`light_saturation`、`light_temperature`、`target_temperature`  
- 可通过 `export HOMEY_CLI_ALLOWED_CAPABILITIES=onoff,dim,target_temperature` 覆盖默认设置  

破坏性操作（如删除设备、修改流程、更改应用设置）**不予支持**。

## 常见用户查询示例

当用户提出以下请求时：
- “打开厨房的灯” → 列出设备、查找匹配项、调用 `devices on <deviceId>`  
- “将客厅灯光调至 50% 亮度” → 查找设备、调用 `devices dim <deviceId> 0.5`  
- “卧室当前温度是多少？” → 查找设备、调用 `devices read <deviceId> measure_temperature`  
- “列出我所有的灯” → 使用 `devices list --json` 并按类别（class）或 capability 过滤  

## 配置存储位置

- **令牌（Tokens）**：`~/.config/homey-cli/credentials.json`  
- **当前活跃的 Homey 设备**：`~/.config/homey-cli/config.json`  

## 故障排查

- **认证错误**：重新运行 `bash run.sh auth login`  
- **设备未找到**：使用 `bash run.sh devices list` 核对设备名称/ID  
- **capability 未获授权**：将其添加至 `HOMEY_CLI_ALLOWED_CAPABILITIES`，或确认其是否为只读 capability  