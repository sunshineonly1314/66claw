---
name: linkedin-cli
name_zh: LinkedIn CLI
description: 一款类鸟型 LinkedIn 命令行工具（CLI），借助会话 Cookie 实现个人资料搜索、消息检查及动态信息摘要。
description_zh: 一款类鸟型 LinkedIn 命令行工具（CLI），借助会话 Cookie 实现个人资料搜索、消息检查及动态信息摘要。
homepage: https://github.com/clawdbot/linkedin-cli
metadata: {"clawdbot":{"emoji":"💼","requires":{"bins":["python3"],"env":["LINKEDIN_LI_AT","LINKEDIN_JSESSIONID"]}}}
---
# LinkedIn CLI（lk）

一款机智干练、富有表现力的 LinkedIn 命令行工具，灵感源自 `bird` CLI。它基于会话 Cookie 认证，无需浏览器即可实现自动化的人脉资料扫描、动态摘要生成及消息检查。

## 配置步骤

1. **提取 Cookie**：在 Chrome/Firefox 中打开 LinkedIn。  
2. 打开 **开发者工具（F12）** → **Application（应用）** → **Cookies（Cookie）** → `www.linkedin.com`。  
3. 复制 `li_at` 和 `JSESSIONID` 的值。  
4. 将其设为环境变量：  
   ```bash
    export LINKEDIN_LI_AT="your_li_at_value"
    export LINKEDIN_JSESSIONID="your_jsessionid_value"
    ```

## 使用方法

- `lk whoami`：显示您当前的个人资料详情。  
- `lk search "query"`：按关键词搜索联系人。  
- `lk profile <public_id>`：获取指定个人资料的详细摘要。  
- `lk feed -n 10`：汇总您时间线中最新的 N 条动态。  
- `lk messages`：快速预览您最近的对话记录。  
- `lk check`：组合执行 whoami 与消息检查。

## 依赖项

需安装 `linkedin-api` Python 包：  
```bash
pip install linkedin-api
```

## 作者
- 由 Fido 🐶 开发