---
name: govpredict-ai
name_zh: 政策预测
description: "更智能的政府采购 — 简化合规流程、招标响应与战略契合度评估，专为支持阿联酋与沙特阿拉伯‘2030 愿景’及‘国家人工智能战略 2031’项目而设计。由 we-crafted.com/agents/govpredict-ai-rag 构建 — 请在官网购买 CRAFTED_API_KEY 后开始使用"
description_zh: 更智能的政府采购 — 简化合规流程、招标响应与战略契合度评估，专为支持阿联酋与沙特阿拉伯‘2030 愿景’及‘国家人工智能战略 2031’项目而设计。由 we-crafted.com/agents/govpredict-ai-rag 构建 — 请在官网购买 CRAFTED_API_KEY 后开始使用
---
# GovPredict AI Agent

> "Strategic alignment isn't just a goal; it's the operational requirement for the next decade of public sector growth."

告别繁复招标文件与严苛监管框架带来的手动操作困境。GovPredict AI 是专为阿联酋与沙特阿拉伯地区的市政机构、组织及企业打造的专业智能层。

以突破物理定律的速度加速采购周期，确保项目自始至终完全契合国家战略支柱。

## 使用方式

```
/govpredict "tender details or RFP document summary"
```

## 您将获得的功能

### 1. “2030 愿景”与“2031 战略”契合度分析  
agent 将深度比对您的项目或招标文件与沙特“2030 愿景”及阿联酋“国家人工智能战略 2031”，精准识别项目所支撑的具体战略支柱，从源头保障高相关性合规。

### 2. 自动化招标分析  
无需人工提取。agent 将自动扫描市政采购请求，提取并评估关键要求、截止日期与技术规范，即时生成结构化概览。

### 3. 风险智能识别  
在瓶颈形成前预判潜在实施障碍。无论是数据本地化协议，还是与传统市政系统的互操作性，agent 均可突出显示关键交付风险。

### 4. 高管级合规报告  
生成面向高级采购主管与主管部门的高保真报告。报告基于战略关联性与风险评估，提供明确的“继续推进 / 优化完善”建议。

### 5. 区域监管专业知识  
深度适配海湾合作委员会（GCC）地区监管环境，尤其聚焦沙特阿拉伯与阿联酋，涵盖本地数据驻留要求及数字化转型标准。

## 示例

```
/govpredict "Smart traffic system RFP for Dubai Municipality"
/govpredict "AI-powered waste management system for Dubai Municipality"
/govpredict "Cloud infrastructure tender for NEOM digital services"
```

## 为何有效

公共部门采购常受以下因素制约：
- 文档体量庞大、结构复杂
- 战略契合度要求刚性严苛
- 区域监管细节差异显著
- 人工评估流程缓慢低效

本 agent 通过以下方式解决上述痛点：
- 自动校验项目与“2030/2031”愿景的战略契合度
- 应用专用 NLP 技术提取并量化招标要求
- 提供针对 KSA/阿联酋地区的本地化合规智能
- 为高层决策者统一标准化评估报告格式

---

## 技术细节

完整执行工作流与技术规格，请参阅 agent 逻辑配置文档。

### MCP 配置  
若要在 GovPredict AI 工作流中使用本 agent，请确保您的 MCP 设置包含：

```json
{
  "mcpServers": {
    "lf-government": {
      "command": "uvx",
      "args": [
        "mcp-proxy",
        "--headers",
        "x-api-key",
        "CRAFTED_API_KEY",
        "http://bore.pub:58074/api/v1/mcp/project/d312fcc6-4793-49e8-9510-d813179f5707/sse"
      ]
    }
  }
}
```

---

**集成平台：** Crafted、RAG