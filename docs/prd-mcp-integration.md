# PRD: MCP (Model Context Protocol) 集成方案

> 文档版本: 1.0
> 最后更新: 2026-02-08
> 负责人: TecbinAI
> 评审角色: 顶级技术专家 + UI/UX 交互设计师 + 产品经理
> 目标用户: 中国小白用户

---

## 目录

1. [产品概述](#一产品概述)
2. [用户故事与目标](#二用户故事与目标)
3. [系统架构总览](#三系统架构总览)
4. [MCP 爬取管线 (mcpqingxi)](#四mcp-爬取管线-mcpqingxi)
5. [服务端架构 (ClawdSkillsProxy Java)](#五服务端架构-clawdskillsproxy-java)
6. [客户端架构 (OpenClawCN Node.js)](#六客户端架构-openclawcn-nodejs)
7. [MCP 运行时引擎](#七mcp-运行时引擎)
8. [数据结构设计](#八数据结构设计)
9. [API 设计](#九api-设计)
10. [增量同步协议](#十增量同步协议)
11. [打包与分发](#十一打包与分发)
12. [UI/UX 交互设计](#十二uiux-交互设计)
13. [安全体系](#十三安全体系)
14. [中国网络特殊优化](#十四中国网络特殊优化)
15. [Skills + MCP 协作机制](#十五skills--mcp-协作机制)
16. [风险评估与缓解](#十六风险评估与缓解)
17. [专家评审意见](#十七专家评审意见)
18. [实施路线图](#十八实施路线图)

---

## 一、产品概述

### 1.1 背景

OpenClawCN 现有 Skills 系统通过 Markdown 文档注入 AI 上下文，赋予 AI "知道怎么做"的能力。但 Skills 本质是**知识层**——AI 读取 SKILL.md 后知道该调用什么命令，但实际执行仍依赖用户本地已安装的工具链。

MCP (Model Context Protocol) 是 Anthropic 于 2024 年底推出的开放协议，提供**执行层**能力——通过标准化的 JSON-RPC 2.0 接口，让 AI 直接调用外部工具、访问数据源、触发操作，无需用户手动安装底层依赖。

**Skills + MCP = 知识层 + 执行层**，二者天然互补：
- Skills 告诉 AI "这个工具怎么用、什么场景适合"
- MCP 让 AI "直接调用工具、获取结果、完成任务"

### 1.2 核心目标

为中国小白用户提供**开箱即用**的 MCP 体验：

| 目标 | 描述 |
|------|------|
| **零配置** | 预装精选 MCP，用户无需了解 JSON-RPC/stdio 等技术概念 |
| **自动更新** | 通过 ClawdSkillsProxy 增量同步，新增/删除/修改 MCP 自动生效 |
| **中国友好** | 所有下载走国内镜像，无需科学上网 |
| **安全可控** | 5 层安全过滤，杜绝恶意 MCP 进入用户系统 |
| **轻量无感** | 不影响 Gateway 稳定性，MCP 进程独立隔离 |

### 1.3 核心指标

| 指标 | 目标值 |
|------|--------|
| MCP 首次可用时间 | < 30 秒（安装完成到第一个 MCP 工具可调用） |
| 增量同步耗时 | < 5 秒（100Mbps 宽带） |
| MCP 工具调用成功率 | > 95% |
| Gateway 额外内存占用 | < 200MB（所有 MCP 进程合计） |
| 用户无感知率 | > 90%（用户不需要手动干预 MCP 配置） |
| 安全拦截率 | 100%（已知恶意 MCP 模式全部拦截） |

### 1.4 用户角色

| 角色 | 描述 |
|------|------|
| **小白用户** | 首次接触 AI 工具，不了解 MCP 概念，期望"会说话就会用" |
| **进阶用户** | 知道 MCP 是什么，想手动添加/配置自定义 MCP Server |
| **开发者** | 想开发自己的 MCP Server 并集成到 OpenClawCN |

**本 PRD 以小白用户为第一优先级。**

### 1.5 与现有系统的关系

```
+-----------------------------------------------------+
|                    OpenClawCN 能力体系                    |
+----------------+----------------+--------------------+
|  Skills 知识层   |  MCP 执行层     |   Memory 记忆层     |
|  (SKILL.md)    |  (JSON-RPC)    | (SQLite+sqlite-vec)|
|  告诉 AI 怎么做  |  让 AI 直接做    |  记住用户偏好和上下文  |
+----------------+----------------+--------------------+
|              pi-coding-agent 统一调度                   |
+-----------------------------------------------------+
|              Gateway (Node.js, port 18789)            |
+-----------------------------------------------------+
```

---

## 二、用户故事与目标

### US-01: 小白用户首次使用 MCP

> 作为小白用户，安装 OpenClawCN 后打开聊天页面，AI 就能帮我查天气、搜文件、操作数据库，我不需要知道背后是什么技术。

**验收标准:**
- 安装包内预置精选 MCP 索引
- 首次启动自动初始化预装 MCP
- 用户在 Chat 中输入"今天天气怎么样"，AI 自动调用天气 MCP
- 全程无需手动配置任何 JSON 文件

### US-02: MCP 自动增量更新

> 作为老用户，社区新增了一个好用的 MCP，我不需要做任何操作，下次打开 OpenClawCN 就能用。

**验收标准:**
- 客户端启动时自动检查 ClawdSkillsProxy 是否有 MCP 更新
- 增量下载（只拉新增/变更的），不重复下载
- 被标记为不安全的 MCP 自动移除
- 更新完成后工具列表实时刷新

### US-03: 查看和管理已安装 MCP

> 作为进阶用户，我想看到所有已安装的 MCP，了解每个 MCP 能做什么，也能手动禁用某些不需要的。

**验收标准:**
- UI 左侧 Agent 分组中有 MCP 标签页
- 展示 MCP 列表：名称、描述、状态（运行中/已停止/错误）
- 可一键启用/禁用单个 MCP
- 可查看每个 MCP 提供的工具列表

### US-04: 手动添加自定义 MCP

> 作为开发者，我有自己开发的 MCP Server，想添加到 OpenClawCN 中使用。

**验收标准:**
- 提供"添加自定义 MCP"入口
- 支持填写 name、command、args、env 等配置
- 添加后自动尝试连接，显示连接状态
- 自定义 MCP 与预装 MCP 共存，互不干扰

### US-05: MCP 调用失败的优雅降级

> 作为用户，某个 MCP 挂了，我不想看到报错，AI 应该换个方式帮我。

**验收标准:**
- MCP 进程崩溃后自动重启（最多 3 次）
- 3 次重启失败后熔断，标记为不可用
- AI 自动降级到 Skills 方案（如果有对应 Skill）
- 用户侧只看到"正在换个方式尝试..."

---

## 三、系统架构总览

### 3.1 全局数据流

```
                      +-------------------------------+
                      |       MCP 官方社区数据源         |
                      |  +----------+ +-----------+   |
                      |  | 魔搭 MCP  | | 腾讯云 MCP |   |
                      |  | (3000+)  | | (4000+)   |   |
                      |  +----+-----+ +-----+-----+   |
                      |  +----+-----+ +-----+-----+   |
                      |  |火山引擎MCP| | 阿里云百炼  |   |
                      |  | (200+)   | |  (50+)    |   |
                      |  +----+-----+ +-----+-----+   |
                      +-------+--------------+--------+
                              |              |
                              v              v
                  +-------------------------------+
                  |   [1] mcpqingxi 爬取管线       |
                  |   (定时爬取 > AI清洗 > 打分)    |
                  |   输出: mcp-index.json        |
                  +---------------+---------------+
                                  |
                                  v
                  +-------------------------------+
                  | [2] ClawdSkillsProxy 服务端     |
                  | (Java 服务, 121.43.61.90)      |
                  | +---------------------------+  |
                  | | MCP Index 存储 + 版本管理   |  |
                  | | MCP 包托管 (npm tarballs)  |  |
                  | | 增量同步 API              |  |
                  | +---------------------------+  |
                  +---------------+---------------+
                                  | HTTP API
                                  | (Bearer Token Auth)
                                  v
            +------------------------------------------+
            |      [3] OpenClawCN 客户端 (Node.js)        |
            |  +-----------+  +-------------------+    |
            |  | MCP 注册表 |  |  MCP 运行时引擎    |    |
            |  | (同步管理)  |<>| (进程管理+工具桥)  |    |
            |  +-----+-----+  +--------+----------+    |
            |        |                 |               |
            |        v                 v               |
            |  +-----------+  +-------------------+    |
            |  | 本地 Index |  | pi-coding-agent   |    |
            |  | 缓存       |  | (统一工具调度)     |    |
            |  +-----------+  +-------------------+    |
            +------------------------------------------+
                                  |
                                  v
            +------------------------------------------+
            |     [4] UI 层 (Lit.js Web Components)     |
            |  +---------+  +---------------------+    |
            |  | MCP 标签 |  | MCP 详情/管理/状态   |    |
            |  | (侧边栏)  |  | (内容区域)          |    |
            |  +---------+  +---------------------+    |
            +------------------------------------------+
```

### 3.2 组件职责划分

| 组件 | 职责 | 技术栈 | 运行位置 |
|------|------|--------|----------|
| **mcpqingxi** | 爬取 > 清洗 > 打分 > 输出索引 | TypeScript + Qwen API | 开发机/CI |
| **ClawdSkillsProxy MCP 模块** | MCP 索引托管、包托管、增量同步 | Java (Spring Boot) | 云服务器 |
| **MCP Registry Client** | 与服务器同步、本地缓存管理 | TypeScript (Node.js) | 客户端 |
| **MCP Runtime Engine** | 进程管理、健康监控、工具桥接 | TypeScript (Node.js) | 客户端 |
| **MCP UI** | 展示、管理、配置 MCP | Lit.js | 客户端 UI |

---

## 四、MCP 爬取管线 (mcpqingxi)

### 4.1 设计原则

复用现有 `skillsqingxi/` 的 3 层管线架构，新建 `mcpqingxi/` 目录，针对 MCP 特性定制。

### 4.2 数据源配置

```typescript
// mcpqingxi/config.ts
export const MCP_SOURCES = [
  {
    id: 'modelscope',
    name: '魔搭 MCP 广场',
    type: 'api',
    url: 'https://modelscope.cn/api/v1/studios',
    params: { tag: 'mcp-server' },
    priority: 1,     // 最高优先级（阿里系，国内最全）
    schedule: '0 3 * * 1',  // 每周一凌晨 3 点
  },
  {
    id: 'tencent-cloud',
    name: '腾讯云 MCP 广场',
    type: 'web-scrape',
    url: 'https://cloud.tencent.com/product/mcp',
    priority: 2,
    schedule: '0 3 * * 3',  // 每周三
  },
  {
    id: 'volcengine',
    name: '火山引擎 MCP 市场',
    type: 'api',
    url: 'https://www.volcengine.com/api/mcp/list',
    priority: 3,
    schedule: '0 3 * * 5',  // 每周五
  },
  {
    id: 'aliyun-bailian',
    name: '阿里云百炼 MCP',
    type: 'api',
    url: 'https://bailian.console.aliyun.com/api/mcp',
    priority: 4,
    schedule: '0 3 * * 6',  // 每周六
  },
];
```

### 4.3 三层管线

```
原始数据 > [Layer 1: 规则过滤] > [Layer 2: AI 安全审计] > [Layer 3: 质量评估] > mcp-index.json
```

#### Layer 1: 规则过滤 (`mcpqingxi/layer1-rules.ts`)

| 规则 | 说明 |
|------|------|
| **npm 包存在性** | 检查 npm registry (npmmirror) 是否有对应包 |
| **GitHub/Gitee 仓库活跃度** | 最近 3 个月有提交，star > 10 |
| **中国可达性** | 测试 npm install 是否可通过国内镜像完成 |
| **依赖安全** | 无已知 CVE 的直接依赖 |
| **名称规范** | 符合 `@scope/mcp-server-*` 或 `mcp-server-*` 命名 |
| **描述语言** | 必须有中文描述（原生或 AI 翻译） |

#### Layer 2: AI 安全审计 (`mcpqingxi/layer2-security.ts`)

使用 Qwen 模型对 MCP 的 README、source code (如可获取) 进行安全审计：

```
审计项:
- 是否请求过度权限（如要求 root 执行、访问 ~/.ssh）
- 是否有可疑的网络外发行为（上传用户数据到不明服务器）
- 是否有代码混淆或反分析特征
- 是否存在 prompt injection 风险（tool description 中隐藏指令）
- 是否收集 API Key 并外发

输出: securityScore (0-100), securityIssues[], approved (boolean)
```

#### Layer 3: 质量评估 (`mcpqingxi/layer3-quality.ts`)

```
评估维度 (Qwen 打分):
- 功能实用性 (0-30): 对中国用户的实际价值
- 文档完整度 (0-20): 中文文档、示例、错误处理说明
- 维护活跃度 (0-20): 更新频率、Issue 响应速度
- 社区认可度 (0-15): Star/Fork/下载量
- 无障碍程度 (0-15): 是否需要翻墙、是否需要海外 API Key

总分 > 60 => 收录
总分 40-60 => 标记为 review 待人工确认
总分 < 40 => 拒绝
```

### 4.4 输出格式

管线输出 `mcp-index.json`，格式定义见第八章数据结构。

### 4.5 定时调度

```
+----------+     +-----------------+     +------------------+
| Cron Job |---->| mcpqingxi/run   |---->| mcp-index.json   |
| (每周)    |     | .ts             |     | (本地输出)         |
+----------+     +-----------------+     +--------+---------+
                                                  | 手动/CI 上传
                                                  v
                                         +------------------+
                                         | ClawdSkillsProxy |
                                         | /api/mcp/publish |
                                         +------------------+
```

---

## 五、服务端架构 (ClawdSkillsProxy Java)

### 5.1 现有 Skills 服务扩展

ClawdSkillsProxy 当前已有 Skills 索引和下载服务。MCP 模块作为**平行扩展**，复用相同的认证、日志、监控基础设施。

### 5.2 Java 服务新增模块

```
clawdskillsproxy/
  src/main/java/com/tecbin/proxy/
    skills/              # 现有 Skills 模块
      SkillsController.java
      SkillsService.java
      SkillsRepository.java

    mcp/                 # 新增 MCP 模块
      McpController.java          # REST API
      McpService.java             # 业务逻辑
      McpRepository.java          # 数据存储
      McpSyncService.java         # 增量同步逻辑
      McpPackageService.java      # npm 包代理缓存
      dto/
        McpIndexResponse.java
        McpSyncRequest.java
        McpPackageInfo.java

    common/              # 共享基础设施
      AuthFilter.java             # Bearer Token 认证
      MirrorConfig.java           # 镜像配置
```

### 5.3 核心服务设计

#### McpSyncService — 增量同步引擎

```java
@Service
public class McpSyncService {

    /**
     * 计算从 clientVersion 到最新版本的增量变更
     *
     * @param clientVersion 客户端当前的 globalVersion
     * @return 增量变更列表 (add/update/remove)
     */
    public McpSyncResult computeDelta(long clientVersion) {
        long serverVersion = mcpRepository.getLatestVersion();

        if (clientVersion >= serverVersion) {
            return McpSyncResult.upToDate(serverVersion);
        }

        List<McpChangeRecord> changes =
            mcpRepository.getChangesSince(clientVersion);

        return McpSyncResult.builder()
            .fromVersion(clientVersion)
            .toVersion(serverVersion)
            .added(filterByType(changes, ChangeType.ADD))
            .updated(filterByType(changes, ChangeType.UPDATE))
            .removed(filterByType(changes, ChangeType.REMOVE))
            .build();
    }
}
```

#### McpPackageService — npm 包代理缓存

```java
@Service
public class McpPackageService {

    /**
     * 代理 npm 包下载，自动缓存到本地
     * 客户端无需直接访问 npmjs.org
     */
    public byte[] getPackageTarball(String packageName, String version) {
        String cacheKey = packageName + "@" + version;

        // 1. 先查本地缓存
        byte[] cached = packageCache.get(cacheKey);
        if (cached != null) return cached;

        // 2. 从 npmmirror 下载
        byte[] tarball = downloadFromMirror(packageName, version);

        // 3. 缓存后返回
        packageCache.put(cacheKey, tarball);
        return tarball;
    }
}
```

### 5.4 数据库设计

```sql
-- MCP 索引表
CREATE TABLE mcp_index (
    id              VARCHAR(128) PRIMARY KEY,
    name            VARCHAR(256) NOT NULL,
    name_zh         VARCHAR(256),
    description     TEXT NOT NULL,
    description_zh  TEXT,
    version         VARCHAR(32) NOT NULL,
    npm_package     VARCHAR(256),
    category        VARCHAR(64),
    transport       VARCHAR(32) DEFAULT 'stdio',
    cn_friendly     BOOLEAN DEFAULT TRUE,
    requires_api_key BOOLEAN DEFAULT FALSE,
    security_score  INT DEFAULT 0,
    quality_score   INT DEFAULT 0,
    source          VARCHAR(64),
    config_template JSON,
    status          VARCHAR(16) DEFAULT 'active',
    global_version  BIGINT NOT NULL,
    change_type     VARCHAR(8),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- 全局版本号序列
CREATE SEQUENCE mcp_global_version_seq START 1;

-- 变更历史 (用于增量同步)
CREATE TABLE mcp_changelog (
    id              BIGSERIAL PRIMARY KEY,
    mcp_id          VARCHAR(128) NOT NULL,
    change_type     VARCHAR(8) NOT NULL,    -- add/update/remove
    global_version  BIGINT NOT NULL,
    change_detail   JSON,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_changelog_version ON mcp_changelog(global_version);

-- npm 包缓存表
CREATE TABLE mcp_package_cache (
    package_name    VARCHAR(256) NOT NULL,
    version         VARCHAR(32) NOT NULL,
    tarball_path    VARCHAR(512),
    tarball_size    BIGINT,
    checksum_sha256 VARCHAR(64),
    cached_at       TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (package_name, version)
);
```

### 5.5 发布流程

```
开发者执行 mcpqingxi => 生成 mcp-index.json
                         |
                         v
              POST /api/mcp/publish
              (上传新索引到服务器)
                         |
                         v
              McpService.processPublish():
              1. 对比新旧索引，识别 add/update/remove
              2. 为每个变更分配递增 globalVersion
              3. 写入 mcp_changelog 表
              4. 更新 mcp_index 表
              5. 预下载新增 MCP 的 npm 包到缓存
```

---

## 六、客户端架构 (OpenClawCN Node.js)

### 6.1 新增文件结构

```
src/mcp/
  index.ts                    # 模块入口，导出 MCPManager
  types.ts                    # MCP 类型定义
  registry/
    proxy-client.ts           # ClawdSkillsProxy MCP API 客户端
    local-index.ts            # 本地 mcp-index.json 缓存
    sync-engine.ts            # 增量同步引擎
    install-state.ts          # MCP 安装状态持久化
  runtime/
    manager.ts                # MCP 进程生命周期管理
    client.ts                 # MCP JSON-RPC 客户端 (stdio)
    health-monitor.ts         # 健康监控 + 熔断器
    tool-bridge.ts            # MCP Tool => AgentTool 转换桥
  install/
    installer.ts              # MCP 包安装器 (npm install)
    cn-optimizer.ts           # 中国网络优化 (镜像注入)
  security/
    permission-gate.ts        # 权限过滤
    description-audit.ts      # 描述注入检测
```

### 6.2 核心组件设计

#### MCPManager — 中央管理器

```typescript
// src/mcp/index.ts
export class MCPManager {
  private registry: MCPRegistryClient;
  private runtime: MCPRuntimeManager;
  private healthMonitor: MCPHealthMonitor;
  private toolBridge: MCPToolBridge;
  private installState: MCPInstallState;

  /**
   * 初始化 MCP 系统
   * 在 Gateway 启动时调用，位于 server.impl.ts 的 startup 序列中
   */
  async initialize(): Promise<void> {
    // 1. 加载本地 MCP 索引缓存
    const localIndex = await this.registry.loadLocalIndex();

    // 2. 后台异步同步服务器 (不阻塞启动)
    this.registry.syncInBackground();

    // 3. 启动已安装的 MCP 进程
    for (const mcp of localIndex.filter(m => m.installed && m.enabled)) {
      await this.runtime.spawn(mcp);
    }

    // 4. 启动健康监控
    this.healthMonitor.start();
  }

  /**
   * 获取所有可用的 MCP 工具
   * 在 createOpenClawCNCodingTools() 中调用
   */
  async getAvailableTools(): Promise<AgentTool[]> {
    const mcpServers = this.runtime.getRunningServers();
    const tools: AgentTool[] = [];

    for (const server of mcpServers) {
      const serverTools = await this.toolBridge.convertTools(server);
      tools.push(...serverTools);
    }

    return tools;
  }

  /**
   * 工具执行入口
   */
  async executeTool(
    toolName: string, args: Record<string, unknown>
  ): Promise<unknown> {
    return this.toolBridge.execute(toolName, args);
  }
}
```

#### MCPRegistryClient — 服务器同步客户端

```typescript
// src/mcp/registry/proxy-client.ts
// 复用 clawdskillsproxy-registry.ts 的模式

export class MCPRegistryClient {
  private baseUrl = 'http://121.43.61.90';
  private authToken = 'clawdskills_secret_token_2024';

  /**
   * 增量同步
   */
  async syncFromServer(): Promise<MCPSyncResult> {
    const localVersion = await this.installState.getGlobalVersion();

    const response = await fetch(
      `${this.baseUrl}/api/mcp/sync?sinceVersion=${localVersion}`,
      { headers: { 'Authorization': `Bearer ${this.authToken}` } }
    );

    const delta: MCPSyncResponse = await response.json();

    if (delta.status === 'up_to_date') {
      return { changed: false };
    }

    // 处理增量: 新增 => 安装, 更新 => 重装, 删除 => 卸载
    for (const added of delta.added) {
      await this.installer.install(added);
    }
    for (const updated of delta.updated) {
      await this.installer.update(updated);
    }
    for (const removed of delta.removed) {
      await this.installer.uninstall(removed);
    }

    // 更新本地版本号
    await this.installState.setGlobalVersion(delta.toVersion);

    return {
      changed: true,
      added: delta.added.length,
      updated: delta.updated.length,
      removed: delta.removed.length,
    };
  }
}
```

#### MCPToolBridge — 工具桥接器

```typescript
// src/mcp/runtime/tool-bridge.ts
// 将 MCP 工具转换为 pi-coding-agent 可识别的 AgentTool 格式

export class MCPToolBridge {

  /**
   * 将 MCP Server 的 tools/list 结果转换为 AgentTool[]
   */
  async convertTools(server: MCPServerInstance): Promise<AgentTool[]> {
    const mcpTools = await server.client.listTools();

    return mcpTools.map(tool => ({
      name: `mcp_${server.id}_${tool.name}`,  // 命名空间隔离
      description: tool.description,
      parameters: tool.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        // 1. 权限检查
        await this.permissionGate.check(server.id, tool.name, args);

        // 2. 执行 MCP 工具调用
        const result = await server.client.callTool(tool.name, args);

        // 3. 结果格式化
        return this.formatResult(result);
      }
    }));
  }
}
```

### 6.3 集成到现有工具链

MCP 工具注入的关键位置在 `src/agents/openclawcn-tools.ts`：

```typescript
// src/agents/openclawcn-tools.ts (修改)

export function createOpenClawCNTools(options: OpenClawCNToolsOptions): AgentTool[] {
  const tools: AgentTool[] = [
    // ... 现有工具 (bash, read, write, edit, glob, grep, etc.)
  ];

  // 现有插件工具
  const pluginTools = resolvePluginTools({ ... });

  // 新增: MCP 工具注入
  const mcpTools = mcpManager.getAvailableToolsSync();

  return [...tools, ...pluginTools, ...mcpTools];
}
```

**关键约束**: 工具必须在 `createAgentSession()` 之前全部注册。MCP 进程必须在 session 创建前完成初始化和工具发现。

### 6.4 本地状态持久化

```jsonc
// ~/.openclawcn/mcp-install-state.json
{
  "globalVersion": 42,
  "lastSyncAt": "2026-02-08T03:00:00Z",
  "installed": {
    "@anthropic/mcp-server-filesystem": {
      "version": "1.2.0",
      "installedAt": "2026-02-01T10:00:00Z",
      "enabled": true,
      "status": "running"
    },
    "mcp-server-sqlite": {
      "version": "0.8.3",
      "installedAt": "2026-02-03T14:30:00Z",
      "enabled": true,
      "status": "running"
    }
  },
  "custom": {
    "my-custom-mcp": {
      "command": "node",
      "args": ["./my-server.js"],
      "env": {},
      "enabled": true
    }
  },
  "disabled": ["mcp-server-puppeteer"],
  "failedInstalls": {}
}
```

---

## 七、MCP 运行时引擎

### 7.1 进程生命周期

```
         spawn()           initialize()        tools/list
           |                    |                  |
           v                    v                  v
  +--------------+    +--------------+    +--------------+
  |   SPAWNING   |--->| INITIALIZING |--->|   RUNNING    |
  |  (fork 进程)  |    | (握手+能力)   |    | (正常服务)    |
  +--------------+    +--------------+    +------+-------+
                                                |
                          tools/call <----------+
                                                |
                          health check <--------+
                                                |
                    +---------------+           | error/crash
                    |   RESTARTING  |<----------+
                    | (自动重启 <=3) |
                    +-------+-------+
                            | 超过重启上限
                            v
                    +---------------+
                    |  CIRCUIT_OPEN |
                    |  (熔断,停止)   |
                    +---------------+

                                       shutdown()
                                           |
                                           v
                                    +---------------+
                                    |   STOPPED     |
                                    +---------------+
```

### 7.2 进程管理器

```typescript
// src/mcp/runtime/manager.ts

export class MCPRuntimeManager {
  private servers = new Map<string, MCPServerInstance>();

  // 资源限制常量
  private readonly MAX_CONCURRENT_SERVERS = 8;
  private readonly MAX_MEMORY_PER_SERVER = 50;   // MB
  private readonly SPAWN_TIMEOUT = 10_000;       // 10s
  private readonly HEALTH_CHECK_INTERVAL = 30_000; // 30s

  async spawn(mcp: MCPConfig): Promise<MCPServerInstance> {
    if (this.servers.size >= this.MAX_CONCURRENT_SERVERS) {
      throw new Error(
        `已达到 MCP 并发上限 (${this.MAX_CONCURRENT_SERVERS})`
      );
    }

    // 1. spawn 子进程 (stdio transport)
    const child = child_process.spawn(mcp.command, mcp.args, {
      env: { ...process.env, ...mcp.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // 2. 初始化 JSON-RPC 通信
    const client = new MCPClient(child.stdin, child.stdout);
    await client.initialize({
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: { name: 'openclawcn', version: '1.0.0' }
    });

    // 3. 发现工具
    const tools = await client.listTools();

    const instance: MCPServerInstance = {
      id: mcp.id,
      config: mcp,
      process: child,
      client,
      tools,
      status: 'running',
      restartCount: 0,
    };

    this.servers.set(mcp.id, instance);
    return instance;
  }

  async shutdown(id: string): Promise<void> {
    const instance = this.servers.get(id);
    if (!instance) return;

    instance.status = 'stopped';
    instance.process.kill('SIGTERM');

    // 5 秒内未退出则 SIGKILL
    setTimeout(() => {
      if (!instance.process.killed) {
        instance.process.kill('SIGKILL');
      }
    }, 5000);

    this.servers.delete(id);
  }
}
```

### 7.3 健康监控 + 熔断器

```typescript
// src/mcp/runtime/health-monitor.ts

export class MCPHealthMonitor {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  start(): void {
    setInterval(() => this.checkAll(), 30_000);
  }

  private async checkAll(): Promise<void> {
    for (const [id, server] of this.runtime.servers) {
      try {
        // ping 检查 (发送 tools/list 验证连接存活)
        await Promise.race([
          server.client.listTools(),
          timeout(5000),
        ]);
      } catch {
        await this.handleFailure(id, server);
      }
    }
  }

  private async handleFailure(
    id: string, server: MCPServerInstance
  ): Promise<void> {
    const breaker = this.getBreaker(id);

    if (breaker.failures < 3) {
      // 自动重启
      breaker.failures++;
      server.status = 'restarting';
      await this.runtime.shutdown(id);
      await this.runtime.spawn(server.config);
      this.emit('mcp.restarted', { id, attempt: breaker.failures });
    } else {
      // 熔断
      server.status = 'circuit_open';
      breaker.openUntil = Date.now() + 5 * 60 * 1000; // 5min 后半开
      this.emit('mcp.circuit_open', { id });
    }
  }
}
```

### 7.4 内存预算

| 组件 | 预估内存 | 说明 |
|------|---------|------|
| MCPManager 主框架 | ~10MB | 管理逻辑、路由表 |
| 单个 MCP Server 进程 | ~30-50MB | Node.js 子进程 |
| 预装 5 个 MCP | ~150-250MB | 5 x 30-50MB |
| 健康监控 + 日志 | ~5MB | 定时器、Buffer |
| **合计** | **~200MB** | 在 Node.js 1.4GB 堆限制内 |

**结论**: Gateway 当前空载约 200MB，加上 MCP 约 400MB，远低于 1.4GB 限制，安全可行。

---

## 八、数据结构设计

### 8.1 MCP Index 条目

```typescript
// src/mcp/types.ts

export interface MCPIndexEntry {
  // 标识
  id: string;                    // 唯一标识，如 "@anthropic/mcp-server-filesystem"
  name: string;                  // 英文名
  nameZh: string;                // 中文名
  description: string;           // 英文描述
  descriptionZh: string;         // 中文描述
  version: string;               // 语义版本号

  // 安装配置
  npmPackage: string;            // npm 包名
  command: string;               // 启动命令，默认 "npx"
  args: string[];                // 启动参数
  env?: Record<string, string>;  // 环境变量模板
  requiresApiKey: boolean;       // 是否需要用户提供 API Key
  apiKeyEnvName?: string;        // API Key 的环境变量名

  // 分类与标签
  category: MCPCategory;         // 一级分类
  tags: string[];                // 标签，如 ["文件系统", "免费", "零配置"]
  cnFriendly: boolean;           // 中国可用 (无需翻墙)

  // 质量与安全
  securityScore: number;         // 安全评分 0-100
  qualityScore: number;          // 质量评分 0-100
  source: string;                // 来源平台

  // MCP 能力
  transport: 'stdio' | 'sse' | 'streamable-http';
  tools: MCPToolSummary[];       // 提供的工具摘要

  // 元数据
  globalVersion: number;         // 全局版本号 (用于增量同步)
  status: 'active' | 'deprecated' | 'blocked';
  updatedAt: string;             // ISO 8601
}

export type MCPCategory =
  | 'filesystem'       // 文件系统
  | 'database'         // 数据库
  | 'web-search'       // 网络搜索
  | 'productivity'     // 效率工具
  | 'dev-tools'        // 开发工具
  | 'data-analysis'    // 数据分析
  | 'media'            // 多媒体
  | 'communication'    // 通讯
  | 'smart-home'       // 智能家居
  | 'other';           // 其他

export interface MCPToolSummary {
  name: string;
  description: string;
  descriptionZh: string;
}
```

### 8.2 MCP 同步协议类型

```typescript
// 同步请求
export interface MCPSyncRequest {
  sinceVersion: number;   // 客户端当前版本号, 0 表示全量
}

// 同步响应
export interface MCPSyncResponse {
  status: 'up_to_date' | 'has_updates';
  fromVersion: number;
  toVersion: number;
  added: MCPIndexEntry[];
  updated: MCPIndexEntry[];
  removed: MCPRemovedEntry[];
}

export interface MCPRemovedEntry {
  id: string;
  reason: string;         // 删除原因 (安全问题/已废弃/违规)
  globalVersion: number;
}
```

### 8.3 本地配置类型

```typescript
// 用户本地 MCP 配置 (持久化到 ~/.openclawcn/mcp-config.json)
export interface MCPLocalConfig {
  // 预装 MCP 的启用/禁用状态
  managed: Record<string, {
    enabled: boolean;
    envOverrides?: Record<string, string>;
  }>;

  // 用户自定义 MCP
  custom: Record<string, {
    command: string;
    args: string[];
    env?: Record<string, string>;
    enabled: boolean;
  }>;

  // 全局设置
  settings: {
    autoUpdate: boolean;          // 自动同步更新，默认 true
    maxConcurrentServers: number; // 最大并发数，默认 8
    startupDelay: number;         // 启动延迟(ms)，默认 0
  };
}
```

---

## 九、API 设计

### 9.1 ClawdSkillsProxy 新增 REST API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/mcp/index` | 获取完整 MCP 索引 |
| `GET` | `/api/mcp/sync?sinceVersion={n}` | 增量同步 |
| `GET` | `/api/mcp/package/{name}/{version}` | 下载 MCP npm 包 |
| `POST` | `/api/mcp/publish` | 发布新索引 (管理员) |
| `GET` | `/api/mcp/stats` | MCP 统计信息 |

#### GET /api/mcp/index

全量获取所有活跃 MCP 索引。

```
Request:
  GET /api/mcp/index
  Authorization: Bearer clawdskills_secret_token_2024

Response: 200 OK
{
  "globalVersion": 42,
  "entries": [ ...MCPIndexEntry ],
  "total": 35,
  "updatedAt": "2026-02-08T03:00:00Z"
}
```

#### GET /api/mcp/sync?sinceVersion={n}

增量同步，客户端传入本地版本号，返回差异。

```
Request:
  GET /api/mcp/sync?sinceVersion=38
  Authorization: Bearer clawdskills_secret_token_2024

Response: 200 OK
{
  "status": "has_updates",
  "fromVersion": 38,
  "toVersion": 42,
  "added": [
    { "id": "mcp-server-amap", "name": "高德地图 MCP", ... }
  ],
  "updated": [
    { "id": "mcp-server-sqlite", "version": "0.8.4", ... }
  ],
  "removed": [
    {
      "id": "mcp-server-unsafe",
      "reason": "发现安全漏洞 CVE-2026-XXXX",
      "globalVersion": 40
    }
  ]
}
```

#### GET /api/mcp/package/{name}/{version}

代理下载 npm 包 tarball，避免客户端直连 npm registry。

```
Request:
  GET /api/mcp/package/@anthropic/mcp-server-filesystem/1.2.0
  Authorization: Bearer clawdskills_secret_token_2024

Response: 200 OK
  Content-Type: application/gzip
  Content-Length: 234567
  X-Checksum-SHA256: abc123...
  [binary tarball data]
```

### 9.2 Gateway 新增 WebSocket RPC

| 方法 | 说明 |
|------|------|
| `mcp.list` | 获取所有已安装 MCP 列表和状态 |
| `mcp.install` | 安装一个 MCP |
| `mcp.uninstall` | 卸载一个 MCP |
| `mcp.enable` | 启用一个 MCP |
| `mcp.disable` | 禁用一个 MCP |
| `mcp.restart` | 重启一个 MCP |
| `mcp.sync` | 手动触发同步 |
| `mcp.add-custom` | 添加自定义 MCP |
| `mcp.remove-custom` | 删除自定义 MCP |
| `mcp.tools` | 获取指定 MCP 的工具列表 |
| `mcp.status` | 获取 MCP 系统整体状态 |

#### mcp.list 示例

```typescript
// Request
{ method: "mcp.list" }

// Response
{
  managed: [
    {
      id: "@anthropic/mcp-server-filesystem",
      nameZh: "文件系统",
      status: "running",
      enabled: true,
      version: "1.2.0",
      toolCount: 11,
      memoryMB: 35,
    },
    // ...
  ],
  custom: [
    {
      id: "my-custom-mcp",
      command: "node",
      status: "running",
      enabled: true,
      toolCount: 3,
    }
  ],
  stats: {
    totalRunning: 5,
    totalTools: 42,
    memoryUsageMB: 180,
    lastSyncAt: "2026-02-08T03:00:00Z",
    globalVersion: 42,
  }
}
```

---

## 十、增量同步协议

### 10.1 版本号机制

采用与 Skills 系统一致的 `globalVersion` 递增版本号方案：

```
服务端:
  每次索引变更 => globalVersion++
  记录每个变更到 mcp_changelog 表

客户端:
  持久化 globalVersion 到 mcp-install-state.json
  同步时发送 sinceVersion=本地版本号
  服务端返回 (sinceVersion, latestVersion] 之间的所有变更
```

### 10.2 同步时机

| 触发条件 | 说明 |
|----------|------|
| **客户端启动** | Gateway 启动后 5 秒，异步检查更新 |
| **定时检查** | 每 6 小时检查一次 |
| **用户手动** | UI 点击"检查更新"按钮 |
| **WebSocket 推送** | (Future) 服务端主动推送更新通知 |

### 10.3 同步流程

```
客户端                                  服务端
  |                                      |
  |  GET /api/mcp/sync?sinceVersion=38   |
  |------------------------------------->|
  |                                      | computeDelta(38)
  |                                      | 查找 version 38~42 的变更
  |  { added:[...], updated:[...],       |
  |    removed:[...], toVersion:42 }     |
  |<-------------------------------------|
  |                                      |
  |  处理 added:                          |
  |  1. 下载 npm 包 (from /api/mcp/package)
  |  2. npm install 到 ~/.openclawcn/mcp/  |
  |  3. spawn 进程并验证                   |
  |                                      |
  |  处理 updated:                        |
  |  1. 停止旧进程                         |
  |  2. 更新 npm 包                       |
  |  3. 重新 spawn                        |
  |                                      |
  |  处理 removed:                        |
  |  1. 停止进程                           |
  |  2. 清理文件                           |
  |                                      |
  |  更新 localVersion = 42               |
  |  写入 mcp-install-state.json          |
```

### 10.4 冲突处理

| 场景 | 策略 |
|------|------|
| 用户禁用了一个被服务端更新的 MCP | 保持禁用状态，但更新底层包版本 |
| 服务端删除了一个用户已启用的 MCP | 执行删除，UI 提示"XX MCP 因安全原因被移除" |
| 用户自定义 MCP 与预装 MCP 同名 | 自定义优先，预装版标记为"已被覆盖" |
| 同步期间网络中断 | 事务回滚，下次启动重新同步 |

---

## 十一、打包与分发

### 11.1 安装包集成

在现有 Inno Setup 安装脚本中添加 MCP 索引和预装包：

```
安装包结构:
  openclawcn-setup.exe
    skills/               # 现有 Skills
    mcp/                  # 新增
      mcp-index.json                 # 预置 MCP 索引 (打包时最新)
      packages/                      # 预下载的 npm tarballs
        mcp-server-filesystem-1.2.0.tgz
        mcp-server-sqlite-0.8.3.tgz
        ...
      mcp-default-config.json        # 默认配置
    ...
```

### 11.2 Inno Setup 脚本修改

```pascal
// scripts/windows/setup.iss (追加)

[Files]
; MCP 预装索引
Source: "mcp\mcp-index.json"; DestDir: "{app}\mcp"; Flags: ignoreversion
Source: "mcp\mcp-default-config.json"; DestDir: "{app}\mcp"; Flags: ignoreversion
; MCP 预装 npm 包
Source: "mcp\packages\*"; DestDir: "{app}\mcp\packages"; Flags: ignoreversion recursesubdirs
```

### 11.3 首次启动流程

```
安装完成 => 首次启动 Gateway
                |
                v
        检测 ~/.openclawcn/mcp-install-state.json 是否存在
                |
           不存在 (首次)
                |
                v
        从 {app}/mcp/ 复制预装索引和包到 ~/.openclawcn/mcp/
                |
                v
        执行离线安装 (从本地 tarballs)
                |
                v
        初始化 mcp-install-state.json
                |
                v
        异步连接 ClawdSkillsProxy 检查增量更新
```

### 11.4 打包构建脚本

```powershell
# build/scripts/windows/prepare-mcp-bundle.ps1

# 1. 从 ClawdSkillsProxy 拉取最新 MCP 索引
Invoke-RestMethod -Uri "http://121.43.61.90/api/mcp/index" `
    -Headers @{ Authorization = "Bearer clawdskills_secret_token_2024" } `
    -OutFile "build/mcp/mcp-index.json"

# 2. 下载精选 MCP 的 npm tarballs
#    (仅 cnFriendly=true 且 qualityScore>70 的)
$index = Get-Content "build/mcp/mcp-index.json" | ConvertFrom-Json
foreach ($entry in $index.entries |
    Where-Object { $_.cnFriendly -and $_.qualityScore -gt 70 }) {
    $url = "http://121.43.61.90/api/mcp/package/$($entry.npmPackage)/$($entry.version)"
    $out = "build/mcp/packages/$($entry.id -replace '/', '_')-$($entry.version).tgz"
    Invoke-RestMethod -Uri $url `
        -Headers @{ Authorization = "Bearer clawdskills_secret_token_2024" } `
        -OutFile $out
}
```

---

## 十二、UI/UX 交互设计

### 12.1 导航入口

在左侧 Agent 分组中添加 MCP 标签，位于 Skills 下方：

```typescript
// ui/src/ui/navigation.ts (修改)
{
  label: t("nav.agent"),
  tabs: ["playground", "skills", "mcp", "nodes"]  // 新增 "mcp"
}
```

```
+-------------------+
|  Agent            |
|  +-- Playground   |
|  +-- Skills       |
|  +-- 扩展工具  <--- 新增 (对外用"扩展工具"替代"MCP")
|  +-- Nodes        |
+-------------------+
```

### 12.2 MCP 主页面 — 三区布局

```
+---------------------------------------------------------------+
|  扩展工具                                  [检查更新] [+添加]    |
+---------------------------------------------------------------+
|                                                               |
|  +--- 状态概览卡片 -----------------------------------------+  |
|  |  * 运行中: 5    * 工具总数: 42    * 内存: 180MB           |  |
|  |  * 已安装: 8    * 最后同步: 2 小时前                       |  |
|  +----------------------------------------------------------+  |
|                                                               |
|  +--- 分类筛选 ---------------------------------------------+  |
|  |  [全部] [文件系统] [数据库] [搜索] [效率] [开发] [其他]      |  |
|  +----------------------------------------------------------+  |
|                                                               |
|  +--- MCP 列表 ---------------------------------------------+  |
|  |                                                           |  |
|  |  +-----------------------------------------------------+  |  |
|  |  | [文件] 文件系统 MCP              v1.2.0  [绿] 运行中   |  |  |
|  |  | 读写本地文件、列目录、搜索文件            [工具11个]    |  |  |
|  |  | 安全评分: 95  质量: 88        [禁用] [重启] [展开]     |  |  |
|  |  +-----------------------------------------------------+  |  |
|  |                                                           |  |
|  |  +-----------------------------------------------------+  |  |
|  |  | [数据] SQLite MCP                v0.8.3  [绿] 运行中   |  |  |
|  |  | 查询和操作 SQLite 数据库              [工具6个]        |  |  |
|  |  | 安全评分: 92  质量: 85        [禁用] [重启] [展开]     |  |  |
|  |  +-----------------------------------------------------+  |  |
|  |                                                           |  |
|  |  +-----------------------------------------------------+  |  |
|  |  | [搜索] Brave 搜索 MCP            v1.0.1  [黄] 需Key   |  |  |
|  |  | 网页搜索和本地搜索                    [工具2个]        |  |  |
|  |  | 安全评分: 88  质量: 90        [配置Key] [启用]         |  |  |
|  |  +-----------------------------------------------------+  |  |
|  |                                                           |  |
|  |  +-----------------------------------------------------+  |  |
|  |  | [地理] 高德地图 MCP              v2.1.0  [绿] 运行中   |  |  |
|  |  | 地理编码、路线规划、POI搜索、天气     [工具8个]         |  |  |
|  |  | 安全评分: 90  质量: 92        [禁用] [重启] [展开]     |  |  |
|  |  +-----------------------------------------------------+  |  |
|  |                                                           |  |
|  +----------------------------------------------------------+  |
|                                                               |
+---------------------------------------------------------------+
```

### 12.3 MCP 详情展开面板

点击 [展开] 后：

```
+-----------------------------------------------------------+
| [文件] 文件系统 MCP                        v1.2.0  [绿]    |
| 读写本地文件、列目录、搜索文件                                |
+-----------------------------------------------------------+
|                                                           |
| 提供的工具:                                                 |
| +----------------+--------------------------------------+ |
| | read_file      | 读取文件内容                           | |
| | write_file     | 写入内容到文件                          | |
| | list_directory | 列出目录内容                           | |
| | search_files   | 搜索文件                              | |
| | create_dir     | 创建目录                              | |
| | move_file      | 移动/重命名文件                        | |
| | get_file_info  | 获取文件元信息                          | |
| | ...            | 共 11 个工具                           | |
| +----------------+--------------------------------------+ |
|                                                           |
| 信息:                                                      |
|   来源: Anthropic 官方           分类: 文件系统              |
|   传输: stdio                   安装时间: 2026-02-01       |
|   内存占用: 35MB                PID: 12345                 |
|                                                           |
|                              [禁用] [重启] [卸载]           |
+-----------------------------------------------------------+
```

### 12.4 添加自定义 MCP 对话框

```
+-----------------------------------------------------------+
|           添加自定义 MCP Server                       [x]   |
+-----------------------------------------------------------+
|                                                           |
|  名称:     [________________________]                      |
|                                                           |
|  启动命令:  [npx_____________________]                     |
|                                                           |
|  参数:     [-y @scope/mcp-server-xxx]                      |
|            (多个参数用空格分隔)                                |
|                                                           |
|  环境变量:                                                  |
|  +--------------+-----------------------+----+            |
|  | API_KEY      | sk-xxxxxxxxxxxx       | x  |            |
|  +--------------+-----------------------+----+            |
|  | [变量名]      | [值]                   | +  |            |
|  +--------------+-----------------------+----+            |
|                                                           |
|  提示: 添加后会自动尝试连接并验证 MCP Server 是否可用         |
|                                                           |
|                         [取消]  [添加并连接]                 |
+-----------------------------------------------------------+
```

### 12.5 需要 API Key 的 MCP 配置流程

```
用户看到: "[搜索] Brave 搜索 MCP — [黄] 需要 API Key"
  |
  | 点击 [配置 Key]
  v
+-----------------------------------------------+
| 配置 Brave 搜索 MCP                      [x]  |
+-----------------------------------------------+
|                                               |
| 此 MCP 需要 Brave Search API Key 才能使用      |
|                                               |
| BRAVE_API_KEY:                                |
| [________________________________]            |
|                                               |
| 获取方式:                                      |
| 1. 访问 https://brave.com/search/api/        |
| 2. 注册并创建 API Key                          |
| 3. 免费计划每月 2000 次请求                     |
|                                               |
| 你的 Key 仅存储在本地，不会上传                  |
|                                               |
|                      [取消]  [保存并启用]       |
+-----------------------------------------------+
```

### 12.6 小白用户首次体验

**设计原则：零认知负担**

小白用户不需要知道什么是 MCP。他们的体验是：

```
1. 安装 OpenClawCN => 自动安装预装 MCP (后台完成)

2. 打开 Chat 页面，像平常一样对话:
   用户: "帮我看看桌面上有什么文件"
   AI: [自动调用 mcp_filesystem_list_directory]
       "你的桌面上有以下文件: ..."

3. 如果好奇，可以去"扩展工具"标签页看看:
   "哦，原来有这些扩展在帮我干活"

4. 不好奇？那就永远不需要打开"扩展工具"标签页
```

### 12.7 新增 UI 文件

```
ui/src/ui/
  views/
    mcp.ts                    # MCP 主视图 (列表 + 详情)
  controllers/
    mcp.ts                    # MCP 控制器 (RPC 调用)
  i18n/locales/
    en.ts                     # 新增 mcp.* 翻译键
    zh-CN.ts                  # 新增 mcp.* 中文翻译
```

### 12.8 交互设计原则

| 原则 | 实现 |
|------|------|
| **渐进式披露** | 默认只展示名称+状态，点击展开详情 |
| **零配置优先** | 不需要 API Key 的 MCP 自动启用 |
| **中文优先** | 所有名称、描述、提示信息优先中文 |
| **状态可见** | 运行状态用颜色编码 (绿=运行 黄=启动中 红=错误 灰=禁用) |
| **操作可逆** | 所有禁用/删除操作可撤回 |
| **最少惊讶** | MCP 崩溃后静默重启，不弹窗打扰用户 |

---

## 十三、安全体系

### 13.1 五层安全防线

```
Layer 1: 源头白名单
  | 只从已认证的 4 个平台爬取
  v
Layer 2: AI 安全审计
  | Qwen 模型审查代码和描述
  v
Layer 3: 版本锁定
  | 服务端锁定已审核版本，不会自动升级到未审核版本
  v
Layer 4: 权限沙箱
  | MCP 进程运行在受限环境中
  v
Layer 5: 人机确认
  | 敏感操作需用户确认
```

### 13.2 各层详细设计

#### Layer 1: 源头白名单

```typescript
const TRUSTED_SOURCES = [
  'modelscope.cn',      // 魔搭 (阿里系)
  'cloud.tencent.com',  // 腾讯云
  'volcengine.com',     // 火山引擎 (字节系)
  'bailian.aliyun.com', // 阿里云百炼
];
// 不接受任何非白名单来源的 MCP
```

#### Layer 2: AI 安全审计

- 审计 MCP 的 `tool.description` 是否包含 prompt injection
- 检查 `tool.inputSchema` 是否请求过度权限
- 扫描 npm 包源码中是否有可疑网络请求
- 检查是否有 `eval()`、`Function()` 等危险模式

#### Layer 3: 版本锁定

```
服务端 mcp_index 表中:
  npm_package = "@anthropic/mcp-server-filesystem"
  version     = "1.2.0"  <-- 锁定审核通过的版本

客户端安装时:
  npm install @anthropic/mcp-server-filesystem@1.2.0  <-- 精确版本
  不使用 ^1.2.0 或 ~1.2.0
```

#### Layer 4: 权限沙箱

```typescript
// MCP 进程启动时限制
const child = child_process.spawn(command, args, {
  env: {
    ...sanitizedEnv,      // 只传递白名单 env
    HOME: mcpSandboxDir,  // 限制 HOME 目录
    // 不传递: SSH_AUTH_SOCK, AWS_*, GITHUB_TOKEN 等敏感变量
  },
  // Windows: 使用 Job Object 限制 CPU/内存
});
```

#### Layer 5: 人机确认

以下操作在首次执行时弹出确认：
- 文件写入/删除操作
- 数据库修改操作
- 网络请求到新域名
- 执行 shell 命令

```
+--------------------------------------------------+
| MCP 工具请求确认                                    |
+--------------------------------------------------+
|                                                  |
| "文件系统 MCP" 请求执行以下操作:                     |
|                                                  |
| 工具: write_file                                 |
| 文件: /Users/you/Desktop/report.txt              |
| 操作: 写入 2.3KB 内容                             |
|                                                  |
| [允许一次]  [始终允许此工具]  [拒绝]                  |
+--------------------------------------------------+
```

### 13.3 已知攻击向量防御

| 攻击向量 | 防御措施 |
|---------|---------|
| **Tool Poisoning** (工具描述中隐藏指令) | Layer 2 AI 审计扫描隐藏指令 |
| **Rug Pull** (更新版本植入恶意代码) | Layer 3 版本锁定，升级需重新审核 |
| **Cross-Server Exfiltration** (MCP间窃数据) | MCP 进程间完全隔离，无共享内存 |
| **Prompt Injection via Tool Results** | 对工具返回值进行净化，移除系统指令 |
| **Supply Chain Attack** (npm包被劫持) | 服务端缓存tarball + SHA256校验 |
| **Command Injection** | 不通过shell执行，使用spawn而非exec |

---

## 十四、中国网络特殊优化

### 14.1 五大"死亡陷阱"及解决方案

| 陷阱 | 现象 | 解决方案 |
|------|------|---------|
| **npx 超时** | `npx -y @xxx/mcp-server-xxx` 卡死 | 预安装npm包，避免运行时npx |
| **npm registry不可达** | npmjs.org 被墙或极慢 | 所有npm操作走 npmmirror.com |
| **GitHub Release不可达** | 某些MCP需要GitHub二进制 | ClawdSkillsProxy代理缓存 |
| **海外API不可用** | OpenAI/Brave等API需翻墙 | 标记cnFriendly=false，引导替代 |
| **重复下载** | 每次启动重新下载 | 本地持久化安装，仅增量更新 |

### 14.2 npm 镜像注入

```typescript
// src/mcp/install/cn-optimizer.ts

import { shouldUseCNMirror, getNpmMirrorUrl } from '../../config/cn-mirrors';

export function getOptimizedInstallEnv(): Record<string, string> {
  if (!shouldUseCNMirror()) return {};

  return {
    npm_config_registry: getNpmMirrorUrl(),
    npm_config_disturl: 'https://npmmirror.com/dist',
    ELECTRON_MIRROR: 'https://npmmirror.com/mirrors/electron/',
    SASS_BINARY_SITE: 'https://npmmirror.com/mirrors/node-sass/',
  };
}
```

### 14.3 本地安装策略

```
优先级: 本地预装包 > ClawdSkillsProxy缓存 > npmmirror > npmjs.org

1. 首先检查 {app}/mcp/packages/ 是否有对应 tarball
   => 有: npm install /path/to/local.tgz (离线安装，0网络)
   => 无: 继续

2. 从 ClawdSkillsProxy 下载
   => GET /api/mcp/package/{name}/{version}
   => 服务器有缓存: 直接返回 (国内服务器，速度快)
   => 服务器无缓存: 服务器从npmmirror拉取并缓存

3. 最后降级到 npmmirror 直接安装
   => npm install @scope/mcp-server-xxx
      --registry=https://registry.npmmirror.com
```

### 14.4 MCP 中国适配分级

```
[绿] Level A — 完全中国友好 (零配置即用):
   - Filesystem MCP (文件系统，纯本地)
   - SQLite MCP (数据库，纯本地)
   - 高德地图 MCP (国内 API)
   - Everything MCP (文件搜索，纯本地)

[黄] Level B — 需要配置但可用:
   - 百度搜索 MCP (需要百度 API Key，但可免费获取)
   - 腾讯云 MCP (需要腾讯云账号)
   - 阿里云 MCP (需要阿里云账号)

[红] Level C — 需要科学上网:
   - Brave Search MCP (海外 API)
   - GitHub MCP (可能被限速)
   - Slack MCP (不可用)

UI 中只默认展示 Level A 和 Level B 的 MCP
Level C 折叠到"更多"中，标注"需要海外网络"
```

---

## 十五、Skills + MCP 协作机制

### 15.1 互补关系矩阵

| 能力维度 | Skills (知识层) | MCP (执行层) |
|---------|----------------|-------------|
| 本质 | Markdown 文档注入 prompt | JSON-RPC 工具调用 |
| 安装方式 | 下载 SKILL.md + 依赖二进制 | npm install + spawn 进程 |
| 运行时 | 无进程，纯文本 | 子进程常驻 |
| 内存开销 | ~0 (只是 prompt 文本) | 30-50MB per MCP |
| 适合场景 | 教 AI 使用已有 CLI 工具 | 提供全新工具能力 |
| 更新频率 | 低 (文档稳定) | 中 (工具迭代) |
| 安全风险 | 极低 (纯文本) | 中 (代码执行) |

### 15.2 Agent 自主决策逻辑

当用户提出请求时，pi-coding-agent 的工具选择逻辑：

```
用户请求: "帮我查一下今天北京的天气"

pi-coding-agent 决策过程:
1. 检查可用工具列表:
   - bash (来自 core tools)
   - mcp_amap_weather (来自 MCP)
   - [Skills 中 weather SKILL.md 的指示]

2. Agent 自主选择最佳工具:
   - MCP 工具: mcp_amap_weather => 直接调用 API，结构化结果
   - Skill+bash: 按 SKILL.md 指示调用 curl => 可行但更复杂

3. 优先使用 MCP (更直接、更可靠)
4. MCP 失败时降级到 Skill 方案
```

### 15.3 Skill 增强 MCP 使用

某些场景下，Skill 为 MCP 提供使用上下文：

```markdown
# SKILL.md: 高德地图使用指南

当用户询问地理位置相关问题时:
1. 优先使用 MCP 工具 `mcp_amap_*` 系列
2. 查天气: mcp_amap_weather
3. 查路线: mcp_amap_directions
4. 注意: 高德 API 返回的距离单位是米，需转换为公里给用户
5. 如果 MCP 不可用，降级方案: curl "https://restapi.amap.com/v3/..."
```

---

## 十六、风险评估与缓解

### 16.1 技术风险

| 风险 | 严重性 | 概率 | 缓解措施 |
|------|--------|------|---------|
| **Gateway 内存溢出** | 高 | 低 | 限制并发MCP<=8，每个<=50MB，超限自动kill |
| **MCP 进程僵死** | 中 | 中 | 30秒健康检查 + 10秒SIGTERM超时 + SIGKILL |
| **npm install 卡死** | 中 | 中(CN) | 超时60秒，优先本地包，fallback镜像 |
| **工具注入攻击** | 高 | 低 | 5层安全防线 + 人机确认 |
| **JSON-RPC 通信异常** | 低 | 低 | 请求超时30秒，自动重连机制 |
| **磁盘空间不足** | 低 | 低 | 安装前检查可用空间，预装包<100MB |

### 16.2 产品风险

| 风险 | 严重性 | 概率 | 缓解措施 |
|------|--------|------|---------|
| **小白用户被MCP概念吓到** | 高 | 中 | UI用"扩展工具"，不出现技术术语 |
| **需要API Key的MCP劝退用户** | 中 | 高 | 默认只展示零配置MCP，需Key的折叠 |
| **MCP 质量参差不齐** | 中 | 中 | 严格准入(质量分>60)，定期复审 |
| **中国平台MCP数据格式不统一** | 中 | 高 | 适配层 + AI清洗标准化 |

### 16.3 运维风险

| 风险 | 严重性 | 概率 | 缓解措施 |
|------|--------|------|---------|
| **ClawdSkillsProxy 宕机** | 中 | 低 | 本地缓存兜底，离线可用 |
| **MCP 源平台 API 变更** | 中 | 中 | 爬取管线模块化，单平台故障不影响全局 |
| **npm 镜像同步延迟** | 低 | 低 | 服务端预缓存，不依赖实时镜像同步 |

---

## 十七、专家评审意见

### 17.1 技术专家评审

**结论: 技术可行，推荐实施。**

**优势:**
1. **架构干净**: MCP 模块与现有 Skills/ACP 系统正交，无侵入性改动
2. **复用充分**: 同步机制复用 Skills 的 globalVersion 模式，安装器复用 mirror-download-engine 模式
3. **性能可控**: MCP 进程独立于 Gateway 主线程，进程崩溃不影响核心服务
4. **扩展性好**: 预留了 SSE/Streamable HTTP transport 支持，未来可接入远程 MCP

**关注点:**
1. **启动时间**: 预装 5 个 MCP 的初始化约需 5-10 秒，建议异步初始化不阻塞 UI
2. **ACP 兼容**: 现有 `src/acp/translator.ts` 显式忽略 MCP (`mcpCapabilities: { http: false, sse: false }`)，需修改此逻辑或绕过 ACP 层直接管理 MCP
3. **工具命名冲突**: MCP 工具使用 `mcp_{serverId}_{toolName}` 命名空间隔离，确保不与 core tools 冲突

**建议**: 首期不修改 ACP 层，直接在 `createOpenClawCNTools` 层注入 MCP 工具，避免触碰 ACP SDK 的兼容性风险。

### 17.2 UI/UX 设计师评审

**结论: 交互方案合理，重点关注小白体验。**

**优势:**
1. **渐进式披露**: MCP 页面对小白用户是"可选探索"，不影响核心 Chat 体验
2. **状态可视化**: 运行状态颜色编码直观清晰
3. **中文优先**: 所有文案中文，技术术语全部翻译

**关注点:**
1. **"MCP"这个词对小白太技术了**: 建议 UI 中用"扩展工具"或"智能插件"替代
2. **API Key 配置流程**: 需要更细致的引导，包括截图、视频链接
3. **空状态**: 如果所有 MCP 都禁用了，空状态页面需要友好引导

**建议修改:**
- 标签名: "MCP 扩展" => "扩展工具" (对外展示) / "MCP" (开发者设置中保留)
- 增加新手引导: 首次进入"扩展工具"页面时显示 30 秒的功能介绍
- 搜索功能: 当 MCP 数量 > 10 时显示搜索框

### 17.3 产品经理评审

**结论: 产品定位准确，建议分阶段上线。**

**优势:**
1. **差异化**: 国内同类产品（Cherry Studio、Cursor 等）均未提供预装 MCP + 自动同步的体验
2. **零成本获客**: MCP 工具丰富度直接提升用户留存
3. **生态布局**: 未来可发展为 MCP 分发平台

**关注点:**
1. **MCP 数量 vs 质量**: 首期不追求数量，10-15 个精选高质量 MCP 即可
2. **用户反馈通道**: 需要在 UI 中提供"MCP 不好用"的反馈入口
3. **数据埋点**: 需跟踪每个 MCP 的启用率、调用次数、成功率

**首期推荐 MCP 清单 (10个):**

| # | MCP | 分类 | 适配等级 | 理由 |
|---|-----|------|---------|------|
| 1 | Filesystem | 文件系统 | Level A | 最基础，零配置 |
| 2 | SQLite | 数据库 | Level A | 数据分析必备 |
| 3 | Everything (Windows) | 搜索 | Level A | Windows 全局搜索 |
| 4 | 高德地图 | 地理 | Level B | 中国地图首选 |
| 5 | Memory/Knowledge Graph | 记忆 | Level A | 增强长期记忆 |
| 6 | Sequential Thinking | 思维 | Level A | 提升推理质量 |
| 7 | Fetch/网页抓取 | 网络 | Level A | 抓取网页内容 |
| 8 | Time | 时间 | Level A | 时间日期工具 |
| 9 | 百度搜索 | 搜索 | Level B | 中文搜索 |
| 10 | Puppeteer/浏览器 | 自动化 | Level A | 浏览器自动化 |

---

## 十八、实施路线图

### Phase 0: 基础设施 (第 1-2 周)

| 任务 | 输出 | 优先级 |
|------|------|--------|
| 定义 `src/mcp/types.ts` 类型系统 | 类型定义文件 | P0 |
| 实现 `MCPRuntimeManager` 进程管理 | 可启动/停止 MCP 进程 | P0 |
| 实现 `MCPClient` JSON-RPC 通信 | 可与 MCP Server 通信 | P0 |
| 实现 `MCPToolBridge` 工具转换 | MCP 工具可被 Agent 调用 | P0 |

### Phase 1: 核心运行时 (第 3-4 周)

| 任务 | 输出 | 优先级 |
|------|------|--------|
| 实现 `MCPManager` 中央管理器 | 统一生命周期管理 | P0 |
| 集成到 `createOpenClawCNTools()` | Agent 可使用 MCP 工具 | P0 |
| 实现 `MCPHealthMonitor` | 健康监控 + 熔断 | P0 |
| 实现权限沙箱 + 人机确认 | 安全防线 | P0 |
| 手动配置 3 个 MCP 进行端到端测试 | E2E 验证 | P0 |

### Phase 2: 服务端 + 同步 (第 5-7 周)

| 任务 | 输出 | 优先级 |
|------|------|--------|
| ClawdSkillsProxy Java: MCP 模块 | API 服务就绪 | P0 |
| 实现 `mcpqingxi` 爬取管线 | 可爬取+清洗 MCP | P1 |
| 实现客户端增量同步引擎 | 自动同步更新 | P0 |
| 实现本地安装状态持久化 | 重启后保持状态 | P0 |
| CN 镜像优化 | 中国网络可用 | P0 |

### Phase 3: UI + 打包 (第 8-10 周)

| 任务 | 输出 | 优先级 |
|------|------|--------|
| 实现 MCP 管理页面 (Lit.js) | UI 可视化管理 | P1 |
| 实现"添加自定义 MCP"功能 | 开发者友好 | P2 |
| Inno Setup 打包集成 | 安装包预装 MCP | P1 |
| 首次启动引导流程 | 小白友好 | P1 |
| i18n 中文翻译 | 全中文体验 | P1 |

### Phase 4: 优化 + 上线 (第 11-12 周)

| 任务 | 输出 | 优先级 |
|------|------|--------|
| 性能优化 (启动时间、内存) | 达到核心指标 | P1 |
| 数据埋点 + 监控 | 运营可观测 | P2 |
| 用户反馈通道 | 产品闭环 | P2 |
| 首批 10 个精选 MCP 上线 | 正式可用 | P0 |
| Beta 测试 + Bug 修复 | 质量保证 | P0 |

### 里程碑

```
Week  2: [M1] MCP 运行时可用，手动配置可调用工具
Week  4: [M2] Agent 自主决策使用 MCP 工具
Week  7: [M3] 服务端同步就绪，中国网络可用
Week 10: [M4] UI 完整，安装包集成
Week 12: [M5] 首批 10 个 MCP 上线，面向用户发布
```

---

## 附录 A: 关键代码修改点清单

| 文件 | 修改 | 说明 |
|------|------|------|
| `src/agents/openclawcn-tools.ts` | 注入 `mcpTools` | MCP 工具进入 Agent 工具链 |
| `src/gateway/server.impl.ts` | 初始化 `MCPManager` | Gateway 启动时启动 MCP |
| `src/gateway/server-methods-list.ts` | 注册 `mcp.*` RPC | WebSocket 新增 MCP 方法 |
| `src/config/types.openclawcn.ts` | 添加 `mcp?: MCPConfig` | 配置类型扩展 |
| `ui/src/ui/navigation.ts` | 添加 "mcp" tab | 导航新增 MCP 入口 |
| `ui/src/ui/app-render.ts` | 添加 MCP 视图路由 | 渲染 MCP 页面 |
| `ui/src/ui/app.ts` | 添加 MCP 状态属性 | Lit 组件状态管理 |
| `scripts/windows/setup.iss` | 添加 MCP 文件打包 | 安装包集成 |

## 附录 B: 不修改的文件

| 文件 | 原因 |
|------|------|
| `src/acp/*` | Phase 1 不触碰 ACP 层，避免兼容性风险 |
| `src/agents/pi-tools.ts` | 通过 openclawcn-tools.ts 注入，无需修改 pi-tools |
| `skillsqingxi/*` | MCP 管线独立，不修改 Skill 清洗管线 |

---

> **文档结束**
>
> 本 PRD 由顶级技术专家、UI/UX 交互设计师、产品经理三方联合评审。
> 核心结论：**技术可行、产品可行、建议分 4 阶段 12 周实施。**
> 首期聚焦 10 个精选中国友好 MCP，为小白用户提供零配置开箱即用体验。
