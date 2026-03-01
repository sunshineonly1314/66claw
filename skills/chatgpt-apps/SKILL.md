---
name: chatgpt-apps
name_zh: ChatGPT应用
description: 完整的 ChatGPT 应用构建器 —— 使用 MCP 服务器、小部件（widgets）、身份验证（auth）、数据库集成及自动化部署，完成 ChatGPT 应用的创建、设计、实现、测试与部署
description_zh: 完整的 ChatGPT 应用构建器 —— 使用 MCP 服务器、小部件（widgets）、身份验证（auth）、数据库集成及自动化部署，完成 ChatGPT 应用的创建、设计、实现、测试与部署
homepage: https://github.com/hollaugo/prompt-circle-claude-plugins
user-invocable: true
---
# ChatGPT 应用构建器

从概念构思到生产上线的完整工作流，用于构建、测试和部署 ChatGPT 应用。

## 命令

- `/chatgpt-apps new` - 创建一个新的 ChatGPT 应用  
- `/chatgpt-apps add-tool` - 为您的应用添加一个 MCP 工具  
- `/chatgpt-apps add-widget` - 为您的应用添加一个小部件（widget）  
- `/chatgpt-apps add-auth` - 配置身份验证（authentication）  
- `/chatgpt-apps add-database` - 设置数据库  
- `/chatgpt-apps validate` - 验证您的应用  
- `/chatgpt-apps test` - 运行测试  
- `/chatgpt-apps deploy` - 部署至生产环境  
- `/chatgpt-apps resume` - 恢复对某个应用的开发工作  

---

## 目录

1. [创建新应用](#1-create-new-app)  
2. [添加 MCP 工具](#2-add-mcp-tool)  
3. [添加小部件](#3-add-widget)  
4. [添加身份验证](#4-add-authentication)  
5. [添加数据库](#5-add-database)  
6. [生成黄金提示词（Golden Prompts）](#6-generate-golden-prompts)  
7. [验证应用](#7-validate-app)  
8. [测试应用](#8-test-app)  
9. [部署应用](#9-deploy-app)  
10. [恢复应用开发](#10-resume-app)  

---

## 1. 创建新应用

**目的：** 从概念构思出发，构建并生成可运行代码的全新 ChatGPT 应用。

### 工作流

#### 第一阶段：概念化（Conceptualization）

1. **获取应用构想**  
   “您希望构建哪一类 ChatGPT 应用？请描述其功能以及它所解决的问题。”

2. **依据用户体验（UX）原则进行分析**  
   - **对话式优势（Conversational Leverage）**：用户可通过自然语言完成哪些操作？  
   - **原生契合度（Native Fit）**：该应用如何融入 ChatGPT 的对话流程？  
   - **可组合性（Composability）**：各工具能否独立运行，并与其他应用协同组合？

3. **识别反模式（Anti-Patterns）**  
   - 展示静态网站内容  
   - 需要跳转至外部标签页的复杂多步骤工作流  
   - 重复实现 ChatGPT 原生已具备的功能  
   - 插入广告或推广销售内容  

4. **定义使用场景（Use Cases）**  
   编写 3–5 个核心使用场景，并附带用户故事（user stories）。

#### 第二阶段：设计（Design）

1. **工具拓扑结构（Tool Topology）**  
   - 查询类工具（readOnlyHint: true）  
   - 变更类工具（mutation tools，destructiveHint: false）  
   - 破坏类工具（destructive tools，destructiveHint: true）  
   - 小部件类工具（widget tools，返回含 `_meta` 字段的 UI）  
   - 外部 API 工具（openWorldHint: true）

2. **小部件设计（Widget Design）**  
   对每个小部件：  
   - `id` — 唯一标识符（kebab-case 格式）  
   - `name` — 显示名称  
   - `description` — 所展示的内容  
   - `mockData` — 用于预览的示例数据  

3. **数据模型（Data Model）**  
   设计实体及其关系。

4. **身份验证需求（Auth Requirements）**  
   - 单用户（无需身份验证）  
   - 多用户（使用 Auth0 或 Supabase Auth）

#### 第三阶段：实现（Implementation）

生成具备如下结构的完整应用：

```
{app-name}/
├── package.json
├── tsconfig.server.json
├── setup.sh
├── START.sh
├── .env.example
├── .gitignore
└── server/
    └── index.ts
```

**关键要求：**  
- 必须继承自 `@modelcontextprotocol/sdk/server/index.js` 的 `Server` 类  
- 使用 `StreamableHTTPServerTransport` 实现会话管理（session management）  
- 小部件 URI 格式：`ui://widget/{widget-id}.html`  
- 小部件 MIME 类型：`text/html+skybridge`  
- 工具响应中必须包含 `structuredContent`  
- 工具需标注 `_meta` 并设置 `openai/outputTemplate`  

#### 第四阶段：测试（Testing）  
- 运行初始化脚本：`./setup.sh`  
- 启动开发服务器：`./START.sh --dev`  
- 预览小部件：`http://localhost:3000/preview`  
- 测试 MCP 连接  

#### 第五阶段：部署（Deployment）  
- 生成 Dockerfile 和 render.yaml  
- 部署至 Render 平台  
- 配置 ChatGPT 连接器（connector）  

---

## 2. 添加 MCP 工具

**目的：** 为您的 ChatGPT 应用添加一个新的 MCP 工具。

### 工作流

1. **收集信息**  
   - 该工具的功能是什么？  
   - 它需要哪些输入参数？  
   - 它返回什么内容？

2. **工具类型分类**  
   - **查询类（Query）**（readOnlyHint: true）—— 获取数据  
   - **变更类（Mutation）**（destructiveHint: false）—— 创建/更新数据  
   - **破坏类（Destructive）**（destructiveHint: true）—— 删除数据  
   - **小部件类（Widget）**—— 返回 UI 内容  
   - **外部类（External）**（openWorldHint: true）—— 调用外部 API  

3. **设计输入 Schema**  
   使用合适的数据类型与描述，创建 Zod Schema。

4. **生成工具处理器（Tool Handler）**  
   使用 `chatgpt-mcp-generator` agent 创建以下内容：  
   - 存放于 `server/tools/` 的工具处理器  
   - Zod Schema 导出  
   - 类型（Type）导出  
   - 数据库查询（如需）

5. **注册工具**  
   在 `server/index.ts` 中更新元数据：  
   ```typescript
   {
     name: "my-tool",
     _meta: {
       "openai/toolInvocation/invoking": "Loading...",
       "openai/toolInvocation/invoked": "Done",
       "openai/outputTemplate": "ui://widget/my-widget.html", // if widget
     }
   }
   ```

6. **更新状态（State）**  
   将该工具添加至 `.chatgpt-app/state.json`。

### 工具命名规范  
采用 kebab-case 格式：`list-items`、`create-task`、`show-recipe-detail`

### 注解（Annotations）指南  

| 场景 | readOnlyHint | destructiveHint | openWorldHint |  
|------|--------------|-----------------|---------------|  
| 列表/获取（List/Get） | true | false | false |  
| 创建/更新（Create/Update） | false | false | false |  
| 删除（Delete） | false | true | false |  
| 外部 API（External API） | 视情况而定 | 视情况而定 | true |  

---

## 3. 添加小部件（Widget）

**目的：** 添加支持 HTML/CSS/JS 及 Apps SDK 集成的内联 HTML 小部件。

### 5 种小部件模式  

1. **卡片网格（Card Grid）** —— 多项内容以网格形式呈现  
2. **统计仪表盘（Stats Dashboard）** —— 关键指标展示  
3. **表格（Table）** —— 表格化数据  
4. **柱状图（Bar Chart）** —— 简单可视化图表  
5. **详情小部件（Detail Widget）** —— 单项内容详情  

### 工作流  

1. **收集信息**  
   - 小部件用途及所需数据  
   - 视觉设计（卡片、表格、图表等）  
   - 交互需求  

2. **定义数据结构（Data Shape）**  
   使用 TypeScript 接口明确预期的数据结构。

3. **添加小部件配置**  
   ```typescript
   const widgets: WidgetConfig[] = [
     {
       id: "my-widget",
       name: "My Widget",
       description: "Displays data",
       templateUri: "ui://widget/my-widget.html",
       invoking: "Loading...",
       invoked: "Ready",
       mockData: { /* sample */ },
     },
   ];
   ```

4. **添加小部件 HTML**  
   生成 HTML 时需包含：  
   - 支持预览模式（`window.PREVIEW_DATA`）  
   - OpenAI Apps SDK 集成（`window.openai.toolOutput`）  
   - 事件监听器（`openai:set_globals`）  
   - 轮询回退机制（polling fallback，100ms 间隔，10s 超时）  

5. **创建/更新工具**  
   通过 `widgetId` 将工具与小部件关联。

6. **测试小部件**  
   在 `/preview/{widget-id}` 使用模拟数据进行预览。

### 小部件 HTML 结构  

```javascript
(function() {
  let rendered = false;

  function render(data) {
    if (rendered || !data) return;
    rendered = true;
    // Render logic
  }

  function tryRender() {
    if (window.PREVIEW_DATA) { render(window.PREVIEW_DATA); return; }
    if (window.openai?.toolOutput) { render(window.openai.toolOutput); }
  }

  window.addEventListener('openai:set_globals', tryRender);

  const poll = setInterval(() => {
    if (window.openai?.toolOutput || window.PREVIEW_DATA) {
      tryRender();
      clearInterval(poll);
    }
  }, 100);
  setTimeout(() => clearInterval(poll), 10000);

  tryRender();
})();
```  

---

## 4. 添加身份验证（Authentication）

**目的：** 使用 Auth0 或 Supabase Auth 配置身份验证。

### 何时添加  
- 存在多个用户  
- 每个用户拥有持久化的私有数据  
- 用户拥有专属的 API 凭据  

### 身份验证提供方（Providers）

**Auth0：**  
- 企业级服务  
- 支持 OAuth 2.1 与 PKCE 流程  
- 支持社交登录（Google、GitHub 等）

**Supabase Auth：**  
- 配置更简单  
- 默认支持邮箱/密码登录  
- 与 Supabase 数据库深度集成  

### 工作流  

1. **选择提供方**  
   根据用户需求询问其偏好。

2. **引导配置**  
   - **Auth0：** 创建应用、配置回调 URL、获取凭据  
   - **Supabase：** 数据库已配置完毕，可直接启用  

3. **生成身份验证代码**  
   使用 `chatgpt-auth-generator` agent 创建：  
   - 会话管理中间件（middleware）  
   - 用户主体（subject）提取逻辑  
   - Token 验证逻辑  

4. **更新服务器**  
   添加身份验证中间件以保护路由。

5. **更新环境变量**  
   ```bash
   # Auth0
   AUTH0_DOMAIN=your-tenant.auth0.com
   AUTH0_CLIENT_ID=...
   AUTH0_CLIENT_SECRET=...
   
   # Supabase (from database setup)
   SUPABASE_URL=...
   SUPABASE_ANON_KEY=...
   ```

6. **测试**  
   验证登录流程及用户间数据隔离。

---

## 5. 添加数据库（Database）

**目的：** 使用 Supabase 配置 PostgreSQL 数据库。

### 何时添加  
- 需要持久化用户数据  
- 存在多实体间关系  
- 需要查询/过滤能力  

### 工作流  

1. **检查 Supabase 配置**  
   确认账户与项目已存在。

2. **获取凭据**  
   - 项目 URL  
   - Anon key（公开）  
   - Service role key（服务端专用）

3. **定义实体（Entities）**  
   对每个实体，明确指定：  
   - 字段及类型  
   - 关系（Relationships）  
   - 索引（Indexes）

4. **生成 Schema**  
   使用 `chatgpt-database-generator` agent 生成 SQL，包含：  
   - `id`（UUID 主键）  
   - `user_subject`（varchar 类型，已建立索引）  
   - `created_at`（timestamptz 类型）  
   - `updated_at`（timestamptz 类型）  
   - RLS（Row Level Security）策略以保障用户数据隔离  

5. **配置连接池（Connection Pool）**  
   ```typescript
   import { createClient } from '@supabase/supabase-js';
   
   const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_SERVICE_ROLE_KEY!
   );
   ```

6. **执行迁移（Apply Migrations）**  
   在 Supabase 控制台或通过迁移工具运行 SQL。

### 查询模式（Query Pattern）  

始终按 `user_subject` 过滤：

```typescript
const { data } = await supabase
  .from('tasks')
  .select('*')
  .eq('user_subject', userSubject);
```  

---

## 6. 生成黄金提示词（Golden Prompts）

**目的：** 生成测试提示词，以验证 ChatGPT 是否能正确调用工具。

### 为何重要  
- 衡量精确率（precision）与召回率（recall）  
- 支持迭代优化  
- 上线后持续监控  

### 三大类别  

1. **直接提示词（Direct Prompts）** —— 明确指示调用某工具  
   - “显示我的任务列表”  
   - “创建一个名为……的新任务”  

2. **间接提示词（Indirect Prompts）** —— 基于目标结果，由 ChatGPT 自行推断应调用的工具  
   - “我今天需要做些什么？”  
   - “帮我整理我的工作”  

3. **否定提示词（Negative Prompts）** —— 不应触发任何工具  
   - “什么是任务？”  
   - “给我讲讲项目管理”  

### 工作流  

1. **分析工具**  
   审查每个工具的功能与输入参数。

2. **生成提示词**  
   对每个工具，分别生成：  
   - ≥5 条直接提示词  
   - ≥5 条间接提示词  
   - ≥3 条否定提示词  
   - ≥2 条边界情况提示词  

3. **最佳实践**  
   - 工具描述以“当……时使用此工具”开头  
   - 明确说明限制条件  
   - 在描述中嵌入示例  

4. **保存输出**  
   写入 `.chatgpt-app/golden-prompts.json`：  
   ```json
   {
     "toolName": {
       "direct": ["prompt1", "prompt2"],
       "indirect": ["prompt1", "prompt2"],
       "negative": ["prompt1", "prompt2"],
       "edge": ["prompt1", "prompt2"]
     }
   }
   ```  

---

## 7. 验证应用（Validate App）

**目的：** 部署前的综合验证套件。

### 十大验证项  

1. **必需文件检查**  
   - package.json  
   - tsconfig.server.json  
   - setup.sh（需具备可执行权限）  
   - START.sh（需具备可执行权限）  
   - server/index.ts  
   - .env.example  

2. **服务端实现检查**  
   - 使用 MCP SDK 提供的 `Server`  
   - 包含 `StreamableHTTPServerTransport`  
   - 使用 Map 实现会话管理  
   - 请求处理器（request handlers）正确实现  

3. **小部件配置检查**  
   - `widgets` 数组存在  
   - 每项均包含 id、name、description、templateUri、mockData  
   - URI 符合 `ui://widget/{id}.html` 模式  

4. **工具响应格式检查**  
   - 返回 `structuredContent`（而非仅 `content`）  
   - 小部件类工具需在响应中包含 `_meta`，且其中含 `openai/outputTemplate`  

5. **资源处理器（Resource Handler）格式检查**  
   - MIME 类型：`text/html+skybridge`  
   - 返回 `_meta`，并完成序列化与 CSP（内容安全策略）设置  

6. **小部件 HTML 结构检查**  
   - 支持预览模式  
   - 包含 Apps SDK 事件监听器  
   - 具备轮询回退机制  
   - 含渲染防护（render guard）  

7. **端点存在性检查**  
   - `/health` —— 健康检查（health check）  
   - `/preview` —— 小部件索引（widget index）  
   - `/preview/:widgetId` —— 小部件预览（widget preview）  
   - `/mcp` —— MCP 端点（MCP endpoint）  

8. **package.json 脚本检查**  
   - 包含 `build:server`  
   - 包含 `start`（需设置 HTTP_MODE=true）  
   - 包含 `dev`（需启用 watch 模式）  
   - 不得包含 Web 构建脚本（如 web/、ui/、client/ 目录相关）  

9. **注解（Annotation）验证**  
   - readOnlyHint 设置正确  
   - 删除操作需设置 destructiveHint  
   - 外部 API 调用需设置 openWorldHint  

10. **数据库验证（若启用）**  
    - 表中包含必需字段  
    - user_subject 字段已建立索引  
    - RLS（行级安全）策略已启用  

### 常见错误  

| 错误 | 修复方式 |  
|------|----------|  
| 缺少 structuredContent | 在工具响应中添加 |  
| 小部件 URI 错误 | 使用 ui://widget/{id}.html 格式 |  
| 缺少会话管理 | 添加 Map<string, Transport> |  
| 缺少 _meta 字段 | 在工具定义及响应中补充 |  
| MIME 类型错误 | 使用 text/html+skybridge |  

**关键提醒：** 务必**首先检查文件是否存在**，再执行其余验证！

---

## 8. 测试应用（Test App）

**目的：** 使用 MCP Inspector 和黄金提示词运行自动化测试。

### 四类测试  

1. **MCP 协议测试**  
   - 服务端无报错启动  
   - 正确处理 initialize 请求  
   - 正确列出所有工具  
   - 正确列出所有资源  

2. **Schema 验证测试**  
   - 工具 Schema 符合 Zod 规范  
   - 必填字段已标记  
   - 类型与实际实现一致  

3. **小部件测试**  
   - 所有小部件可在预览模式下正常渲染  
   - 模拟数据加载成功  
   - 控制台无报错  

4. **黄金提示词测试**  
   - 直接提示词触发对应工具  
   - 间接提示词行为符合预期  
   - 否定提示词不触发任何工具  

### 工作流  

1. **以测试模式启动服务端**  
   ```bash
   HTTP_MODE=true NODE_ENV=test npm run dev
   ```  

2. **运行 MCP Inspector**  
   测试协议合规性：  
   - 初始化连接  
   - 列出工具  
   - 使用有效输入调用每个工具  
   - 检查响应  

3. **Schema 验证**  
   验证 Schema 可编译且与实现匹配。

4. **黄金提示词测试**  
   使用 ChatGPT 执行提示词测试：  
   - 记录被调用的工具  
   - 与预期工具比对  
   - 计算精确率与召回率  

5. **生成报告**  
   ```json
   {
     "passed": 42,
     "failed": 3,
     "categories": {
       "mcp": "✅",
       "schema": "✅",
       "widgets": "✅",
       "prompts": "⚠️ 3 failures"
     },
     "timing": "2.3s"
   }
   ```  

### 故障修复指南  

对每一项失败，需说明：  
- 何处失败  
- 失败原因  
- 如何修复（附带代码示例）  

---

## 9. 部署应用（Deploy App）

**目的：** 将 ChatGPT 应用部署至 Render 平台，集成 PostgreSQL 与健康检查。

### 前置条件  

- ✅ 验证已通过  
- ✅ 测试已通过  
- ✅ Git 仓库处于干净状态  
- ✅ 环境变量已就绪  

### 工作流  

1. **起飞前检查（Pre-flight Check）**  
   - 运行验证  
   - 运行测试  
   - （如启用）检查数据库连接  

2. **生成 render.yaml**  
   ```yaml
   services:
     - type: web
       name: {app-name}
       runtime: docker
       plan: free
       healthCheckPath: /health
       envVars:
         - key: PORT
           value: 3000
         - key: HTTP_MODE
           value: true
         - key: NODE_ENV
           value: production
         - key: WIDGET_DOMAIN
           generateValue: true
         # Add auth/database vars if needed
   ```  

3. **生成 Dockerfile**  
   ```dockerfile
   FROM node:20-slim
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY dist ./dist
   EXPOSE 3000
   CMD ["node", "dist/server/index.js"]
   ```  

4. **部署**  
   **选项 A：自动化部署（如 Render MCP 可用）**  
   使用 Render MCP agent 进行部署。  
   
   **选项 B：手动部署**  
   - 推送至 GitHub  
   - 在 Render 控制台中关联仓库  
   - 设置环境变量  
   - 执行部署  

5. **验证部署结果**  
   - 健康检查：`https://{app}.onrender.com/health`  
   - MCP 端点：`https://{app}.onrender.com/mcp`  
   - 工具发现（tool discovery）正常  
   - 小部件可正常渲染  

6. **配置 ChatGPT 连接器**  
   - URL：`https://{app}.onrender.com/mcp`  
   - 在 ChatGPT 中测试  

---

## 10. 恢复应用（Resume App）

**目的：** 继续开发一个正在进行中的 ChatGPT 应用。

### 工作流  

1. **加载状态（Load State）**  
   读取 `.chatgpt-app/state.json`：  
   ```json
   {
     "appName": "My Task Manager",
     "phase": "Implementation",
     "tools": ["list-tasks", "create-task"],
     "widgets": ["task-list"],
     "auth": false,
     "database": true,
     "validated": false,
     "deployed": false
   }
   ```  

2. **显示进度（Display Progress）**  
   展示当前状态：  
   - 应用名称  
   - 当前阶段  
   - 已完成项（工具、小部件等）  
   - 待办项（身份验证、验证、部署等）  

3. **推荐下一步（Offer Next Steps）**  
   根据当前阶段提供选项：  

   **概念阶段（Concept Phase）：**  
   - “我们来设计工具和小部件吧”  
   - “是否开始实现？”  

   **实现阶段（Implementation Phase）：**  
   - “再添加一个工具？”  
   - “添加一个小部件？”  
   - “配置身份验证？”  
   - “配置数据库？”  

   **测试阶段（Testing Phase）：**  
   - “生成黄金提示词？”  
   - “运行验证？”  
   - “运行测试？”  

   **部署阶段（Deployment Phase）：**  
   - “部署至 Render？”  
   - “配置 ChatGPT 连接器？”  

4. **继续工作（Continue Work）**  
   根据用户选择，调用对应的工作流章节。

---

## 最佳实践（Best Practices）

1. **每次重大步骤后务必保存状态**  
2. **推进前务必验证（尤其是部署前）**  
3. **使用 agents 生成代码**（如 chatgpt-mcp-generator、chatgpt-auth-generator 等）  
4. **每个阶段都需测试**（预览小部件、测试工具、运行黄金提示词）  
5. **保持对话式风格** —— 自然引导用户完成整个工作流  
6. **提供选择时说明权衡因素**（例如 Auth0 vs Supabase）  
7. **引入新概念时给出示例**  

---

## 状态管理（State Management）

`.chatgpt-app/state.json` 文件用于追踪进度：

```json
{
  "appName": "string",
  "description": "string",
  "phase": "Concept" | "Implementation" | "Testing" | "Deployment",
  "tools": ["tool-name"],
  "widgets": ["widget-id"],
  "auth": {
    "enabled": boolean,
    "provider": "auth0" | "supabase" | null
  },
  "database": {
    "enabled": boolean,
    "entities": ["entity-name"]
  },
  "validated": boolean,
  "tested": boolean,
  "deployed": boolean,
  "deploymentUrl": "string | null",
  "goldenPromptsGenerated": boolean,
  "lastUpdated": "ISO timestamp"
}
```  

---

## 命令参考（Command Reference）

```bash
# Setup
./setup.sh

# Development
./START.sh --dev          # Dev mode with watch
./START.sh --preview      # Open preview in browser
./START.sh --stdio        # STDIO mode (testing)
./START.sh                # Production mode

# Testing
npm run validate          # Type checking
curl http://localhost:3000/health

# Deployment
git push origin main      # Trigger Render deploy
```  

---

## 入门指南（Getting Started）

当用户调用任意 chatgpt-app 命令时：

1. 检查 `.chatgpt-app/state.json` 是否存在  
2. 若存在 → 启动 **恢复应用（Resume App）** 工作流  
3. 若不存在 → 启动 **创建新应用（Create New App）** 工作流  

始终引导用户遵循自然演进路径：  
**概念 → 实现 → 测试 → 部署**