---
name: phone-calls
name_zh: Bland 电话
description: 通过 Bland AI 实现 AI 语音电话——预订餐厅、预约服务、咨询业务等。AI 代表你拨打电话，并返回通话文字记录。
description_zh: 通过 Bland AI 实现 AI 语音电话——预订餐厅、预约服务、咨询业务等。AI 代表你拨打电话，并返回通话文字记录。
metadata: {"clawdbot":{"emoji":"📞","requires":{"env":["BLAND_API_KEY"]}}}
---
# Phone Calls Skill

代表用户发起 AI 语音电话——用于预订餐厅、预约服务、业务咨询等场景。

## 服务商：Bland AI

**为何选用 Bland AI？**  
- 所有可选方案中（Vapi、Retell 等）API 最为简洁；  
- 仅需 `phone_number` 与 `task` 即可拨打电话；  
- 延迟低，语音自然逼真；  
- 按分钟计费，无平台附加费用；  
- 支持自托管（数据安全可控）。

## 必备设置

### 1. 创建 Bland AI 账户  
1. 访问 https://app.bland.ai；  
2. 使用邮箱注册；  
3. 添加付款方式（或使用免费试用额度）。

### 2. 获取 API 密钥  
1. 访问 https://app.bland.ai/dashboard；  
2. 点击头像 → API Keys；  
3. 复制你的 API 密钥。

### 3. 配置 Clawdbot  
添加至你的环境变量或 `.env`：  
```bash
BLAND_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```  

或存入 `~/.clawd/secrets.json`：  
```json
{
  "bland_api_key": "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
}
```  

## 使用方法

### 基础通话  
```bash
./phone-call.sh "+447123456789" "Call the restaurant and book a table for 2 at 7pm tonight under the name John"
```  

### 使用自定义语音  
```bash
./phone-call.sh "+447123456789" "Ask about their opening hours" --voice maya
```  

### 查询通话状态  
```bash
./check-call.sh <call_id>
```  

## 运行原理  

1. 你提供电话号码与任务目标；  
2. Bland AI 使用 AI agent 拨打该号码；  
3. AI 自然地遵循你的指令执行任务；  
4. 通话结束后，你将收到文字记录与摘要。

## 示例任务  

**餐厅预订：**  
```
Call this restaurant and book a table for 4 people on Saturday at 8pm. 
The booking should be under the name "Smith". If they ask for a phone 
number, give them +447123456789.
```  

**预约咨询：**  
```
Call this dental office and ask what appointments are available next 
week for a routine checkup. Get at least 3 options if possible.
```  

**业务咨询：**  
```
Call this plumber and ask if they can come out tomorrow to fix a 
leaking tap. Get a quote for the callout fee.
```  

## 定价（Bland AI）

- **外呼通话**：约 $0.09/分钟（美国境内）；  
- **各国费率不同** —— 请访问 https://app.bland.ai 查看最新资费；  
- 首次通话可能享有免费额度。

## 语音选项  

内置语音：  
- `josh` —— 男声，专业稳重（默认）；  
- `maya` —— 女声，亲切友好（默认）；  
- `florian` —— 男声，欧洲口音；  
- `derek` —— 男声，轻松随意；  
- `june` —— 女声，专业干练；  
- `nat` —— 男声，自然流畅；  
- `paige` —— 女声，积极 upbeat。

## 高级功能  

### 语音信箱处理  
AI 可检测语音信箱，并选择挂断、留言或忽略。

### 通话录音  
设置 `record: true` 参数，通话结束后将返回录音 URL。

### Webhook 通知  
通过设置 webhook URL，在通话完成时实时接收通知。

### 对话路径（Conversation Pathways）  
针对复杂流程（如 IVR 语音菜单、多步骤交互），可在 Bland 控制台中预先配置路径。

## 限制说明  

- **不可拨打紧急服务号码**（如 999、911 等）；  
- 部分号码可能被屏蔽（例如 DNC 注册号码）；  
- **频率限制**：同一号码每 10 秒最多发起 1 通电话；  
- **最长通话时长**：默认 30 分钟（可配置）。

## 故障排查  

**“无效电话号码”**  
- 请包含国家区号：`+44`（英国）、`+1`（美国）；  
- 请移除空格与括号。

**“余额不足”**  
- 请前往 https://app.bland.ai/dashboard/billing 充值。

**“超出速率限制”**  
- 同一号码两次呼叫间隔请至少等待数秒。

## 文件清单  

- `phone-call.sh` —— 发起电话呼叫；  
- `check-call.sh` —— 查询通话状态/文字记录；  
- `bland.sh` —— 底层 API 封装脚本。