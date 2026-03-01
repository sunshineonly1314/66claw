---
name: plan2meal
description: 一款通过 Plan2Meal（一款基于 React Native 的食谱应用）管理食谱与购物清单的 ClawdHub skill。
description_zh: 一款通过 Plan2Meal（一款基于 React Native 的食谱应用）管理食谱与购物清单的 ClawdHub skill。
---
# Plan2Meal Skill

一款通过 Plan2Meal（一款基于 React Native 的食谱应用）管理食谱与购物清单的 ClawdHub skill。

## 功能特性

- **食谱管理**：支持从 URL 添加食谱，支持搜索、查看与删除你的食谱  
- **购物清单**：创建并管理购物清单，支持从食谱中自动填充食材  
- **后端认证**：通过 Plan2Meal 网页应用实现安全认证（skill 中不涉及任何密钥）  
- **食谱提取**：自动从 URL 抓取并解析食谱元数据  
- **Telegram 格式化输出**：适配 Telegram 的美观排版输出  

## 配置步骤

1. 通过 ClawdHub 安装：  
   ```bash
   clawdhub install plan2meal
   ```

2. 配置环境变量：  
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. 必需的环境变量：  
   - `PLAN2MEAL_API_URL`：你的 Plan2Meal 后端 API 地址（例如 `https://api.plan2meal.app`）  

   **可选：**  
   - `PLAN2MEAL_AUTH_URL`：自定义认证地址（默认为 `https://app.plan2meal.com/sign-in`）  

   **重要提示：**  
   - **公开 skill**：本 skill 已发布于 ClawdHub，其中不存储任何密钥。  
   - **认证方式**：用户通过你的 Plan2Meal 网页应用完成认证，再将会话令牌复制回 Telegram。  
   - **后端安全**：所有 OAuth 凭据（GitHub、Convex）仅配置于你的后端，绝不对外暴露。  

## 命令列表

### 食谱相关命令

| 命令 | 说明 |
|------|------|
| `plan2meal add <url>` | 从 URL 抓取食谱元数据并创建食谱 |
| `plan2meal list` | 列出你最近保存的食谱 |
| `plan2meal search <term>` | 搜索你的食谱 |
| `plan2meal show <id>` | 显示食谱详细信息 |
| `plan2meal delete <id>` | 删除某条食谱 |

### 购物清单相关命令

| 命令 | 说明 |
|------|------|
| `plan2meal lists` | 列出你全部的购物清单 |
| `plan2meal list-show <id>` | 显示某购物清单及其所含物品 |
| `plan2meal list-create <name>` | 创建新的购物清单 |
| `plan2meal list-add <listId> <recipeId>` | 将某食谱添加至购物清单 |

### 帮助命令

| 命令 | 说明 |
|------|------|
| `plan2meal help` | 显示全部可用命令 |

## 使用示例

### 添加食谱

```
plan2meal add https://www.allrecipes.com/recipe/12345/pasta
```

输出：  
```
✅ Recipe added successfully!

📖 Recipe Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: Classic Pasta
Source: allrecipes.com
Method: firecrawl-json (credit used)
Time: 15 min prep + 20 min cook

🥘 Ingredients (4 servings)
• 1 lb pasta
• 2 cups marinara sauce
• 1/2 cup parmesan

🔪 Steps
1. Boil water...
```

### 搜索食谱

```
plan2meal search pasta
```

### 创建购物清单

```
plan2meal list-create Weekly Shopping
```

### 将食谱添加至清单

```
plan2meal list-add <listId> <recipeId>
```

## 食谱数量限制

免费版最多支持 **5 个食谱**。接近此上限时，系统将发出警告。

## 认证架构说明

### 运作原理

**Skill 所有者配置**（一次性）：  
1. 在 skill 中配置你的 Plan2Meal 后端 API 地址  
2. 你的后端负责全部 OAuth 流程（GitHub 凭据配置于 Convex 环境变量中）  
3. 你的后端已配置 Convex URL（严格保密）

**终端用户流程**：  
1. 用户发送命令（例如 `plan2meal list`）  
2. skill 返回指向你的 Plan2Meal 登录页的链接（`app.plan2meal.com/sign-in`）  
3. 用户点击链接，在你的网页应用中使用 GitHub 完成认证  
4. 你的后端（使用 Convex Auth）处理 GitHub OAuth 流程  
5. 认证成功后，你的后端向用户展示一个会话令牌  
6. 用户复制该令牌并发送回 Telegram（或输入 `token: <token>`）  
7. skill 向你的后端验证该令牌，并安全存储

**后端处理流程**：  
- 你的 Plan2Meal 后端使用 Convex Auth 并启用 GitHub 提供方  
- GitHub OAuth 凭据存储于 Convex 环境变量中（绝不对外暴露）  
- GitHub 认证完成后，后端为用户生成会话令牌  
- skill 将会话令牌发送至你的后端 API，用于所有后续请求  
- 你的后端验证令牌有效性，并代表用户调用 Convex API  
- Convex URL 仅保留在你的后端内部，绝不暴露给用户或 skill  

### 关键要点

- **公开 skill**：skill 中不包含任何密钥，可安全发布于 ClawdHub  
- **后端 OAuth**：全部 OAuth 凭据（GitHub、Convex）均保留在你的后端  
- **用户识别**：你的后端在内部将会话令牌映射至对应的 Convex 用户  
- **隐私保障**：Convex URL 仅存在于你的后端，严格保密  
- **安全保障**：所有会话令牌均需经你的后端验证后方可使用  

## 许可协议

MIT