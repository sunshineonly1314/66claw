---
name: dexcom
name_zh: Dexcom
description: 通过 Dexcom G7/G6 CGM 实时监测血糖
description_zh: 通过 Dexcom G7/G6 CGM 实时监测血糖
homepage: https://www.dexcom.com
metadata: {"clawdbot":{"emoji":"🩸","requires":{"bins":["uv"],"env":["DEXCOM_USER","DEXCOM_PASSWORD"]},"primaryEnv":"DEXCOM_USER","install":[{"id":"uv-brew","kind":"brew","formula":"uv","bins":["uv"],"label":"Install uv (brew)"}]}}
---
# Dexcom CGM

通过 Dexcom G6/G7 连续血糖监测仪（CGM）实现血糖实时监测。

## 初始化配置

设置环境变量：
```bash
export DEXCOM_USER="your@email.com"
export DEXCOM_PASSWORD="your-password"
export DEXCOM_REGION="ous"  # or "us" (optional, defaults to "ous")
```

或在 `~/.clawdbot/clawdbot.json` 中配置：
```json5
{
  skills: {
    "dexcom": {
      env: {
        DEXCOM_USER: "your@email.com",
        DEXCOM_PASSWORD: "your-password",
        DEXCOM_REGION: "ous"
      }
    }
  }
}
```

## 使用方式

**格式化报告：**
```bash
uv run {baseDir}/scripts/glucose.py now
```

**原始 JSON 输出：**
```bash
uv run {baseDir}/scripts/glucose.py json
```

## 示例输出

```
🩸 Glucose: 100 mg/dL (5.6 mmol/L)
📈 Trend: steady ➡️
🎯 Status: 🟢 In range
⏰ 2026-01-18 09:30:00
```

## 系统要求

- 已启用 Share 功能的 Dexcom G6 或 G7 设备  
- uv（Python 包管理器）  
- 有效的 Dexcom Share 账户凭证  