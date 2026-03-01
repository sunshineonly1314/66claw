---
name: standard-agentic-commerce-engine
name_zh: 商业引擎
version: 1.2.4
description: 一个面向生产环境的通用 Agentic Commerce 引擎。该工具使 autonomous agents 能够通过标准化协议与任意兼容的无头（headless）电商后端进行交互。它开箱即用地支持商品发现、购物车操作及安全的用户管理。
description_zh: 一个面向生产环境的通用 Agentic Commerce 引擎。该工具使 autonomous agents 能够通过标准化协议与任意兼容的无头（headless）电商后端进行交互。它开箱即用地支持商品发现、购物车操作及安全的用户管理。
tags: [ecommerce, shopping-agent, commerce-engine, standard-protocol, headless-commerce, agentic-web]
---
# 标准 Agentic Commerce 引擎

**标准 Agentic Commerce 引擎** 是一座面向生产环境的桥梁，用于连接 autonomous agents 与现代电商后端。通过提供统一且高精度的接口，它可让任意数字 storefront 瞬间变为“Agent-Native”。

GitHub 仓库：https://github.com/NowLoadY/agent-commerce-engine

## 参考案例：Lafeitu

如需了解本引擎在生产环境中的实际应用示例，请参阅 [Lafeitu 美食技能](https://clawdhub.com/NowLoadY/agentic-spicy-food)。该案例展示了引擎如何针对真实世界的 artisanal 食品品牌进行专业化定制。

---

## 🛠 工具优先级与回退策略

为提供最准确、高效的体验，请遵循以下优先级顺序：

1.  **API 优先（主路径）**：始终优先尝试使用 `commerce.py` 脚本。它提供结构化、高精度的数据。请通过环境变量 `COMMERCE_URL` 进行配置。
2.  **无状态请求头**：依赖引擎内置的请求头管理机制（`x-user-account`、`x-visitor-id`），在不使用 Cookie 的前提下维持会话完整性。
3.  **自校正机制**：若 API 对浏览器发现的某个 slug 返回 404 错误，则应以 API 的 `search` 结果为准，将其视为后端事实来源。

---

## 🧠 Agent 运行逻辑

请遵循以下逻辑流程，以确保高质量的用户体验：

### 1. 商品发现与验证  
**目标**：确认商品存在，并在执行操作前获取其准确规格。  
- **操作**：添加至购物车前，务必先运行 `search` 或 `list`。  
- **逻辑**：利用 API 发现正确的 `slug` 及有效的 `gram`/变体（variant）取值。  
- **细化处理**：若返回多个结果，应基于返回的属性向用户发起明确询问，由其指定具体选项。

### 2. 认证与用户档案流程  
**目标**：保障用户隐私及会话数据管理。  
- **逻辑**：API 为无状态设计。需身份认证的操作若未保存凭据，将返回 `401 Unauthorized`。  
- **命令**：  
    1. 查看用户档案：`python3 scripts/commerce.py get-profile`  
    2. 更新用户信息：`python3 scripts/commerce.py update-profile --name "Name" --address "..."`  
- **所需数据**：须严格遵循特定品牌后端所定义的数据结构（schema）。

### 3. 注册流程  
**目标**：处理新用户场景。  
- **触发条件**：当某项操作返回 “User Not Found”（用户未找到）时。  
- **操作指引**：引导用户前往该品牌的注册 URL（通常可在品牌元数据中查得）。

### 4. 购物车管理  
**目标**：对用户的购物会话进行精确修改。  
- **逻辑**：引擎支持数量递增或设置绝对数值两种方式。  
- **命令**：  
    - **添加**：`python3 scripts/commerce.py add-cart <slug> --gram <G> --quantity <Q>`  
    - **更新**：`python3 scripts/commerce.py update-cart <slug> --gram <G> --quantity <Q>`  
    - **移除**：`python3 scripts/commerce.py remove-cart <slug> --gram <G>`  
- **校验要求**：克重（gram）或变体（variant）等取值，必须严格限定于该商品可用选项列表范围内。

### 5. 品牌信息与叙事呈现  
**目标**：获取品牌身份标识及相关支持信息。  
- **逻辑**：使用 `brand-info` 接口检索叙事性内容。  
- **工具能力**：  
    - `python3 scripts/commerce.py brand-story`：获取品牌叙事/使命陈述。  
    - `python3 scripts/commerce.py company-info`：获取正式信息（如公司注册信息、法律条款等）。  
    - `python3 scripts/commerce.py contact-info`：获取客户服务渠道（如客服邮箱、热线、在线聊天入口等）。

---

## 🚀 能力概览

- **`search` / `list`**：商品发现与库存扫描。  
- **`get`**：深入解析商品规格、变体及定价信息。  
- **`promotions`**：当前业务规则、运费门槛及有效促销活动。  
- **`cart`**：完整会话摘要，含 VIP 折扣、税费及运费预估。  
- **`add-cart` / `update-cart` / `remove-cart`**：原子级购物车控制能力。  
- **`get-profile` / `update-profile`**：个性化配置与履约（fulfillment）数据。  
- **`brand-story` / `company-info` / `contact-info`**：品牌背景信息与支持资源。  
- **`orders`**：实时物流追踪及购买历史记录。

---

## 💻 CLI 配置与示例

```bash
# Setup
export COMMERCE_URL="https://api.yourbrand.com/v1"
export COMMERCE_BRAND_ID="brand_slug"

# Actions
python3 scripts/commerce.py list
python3 scripts/commerce.py search "item"
python3 scripts/commerce.py get <slug>
python3 scripts/commerce.py add-cart <slug> --gram <variant>
```

---

## 🤖 故障排查与调试

- **状态码 401**：凭据缺失或已过期。建议执行 `login`。  
- **状态码 404**：资源未找到。请通过 `search` 验证 `slug` 是否正确。  
- **连接错误**：请确认 `COMMERCE_URL` 环境变量配置无误，且对应端点可达。