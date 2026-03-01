/**
 * 压测数据生成器 — 用 Node 脚本批量生成，不烧 LLM token
 *
 * 生成目标：
 * - 2000+ 篇 memory/*.md 文件
 * - 200+ 个 session JSONL 文件
 * - 总数据量 ~25-30MB
 * - 50+ 细分主题，中英文混合
 * - 模拟 2 年使用历史（730 天）
 *
 * 用法：npx tsx test/memory/stress-data-gen.ts <output-dir>
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const OUTPUT_DIR =
  process.argv[2] || path.join(process.env.TEMP || "/tmp", "openclawcn-stress-data");

// ─── 主题语料库 ──────────────────────────────────────────────────────────────
// 每个主题有：标题模板、段落模板、关键术语
// 脚本通过随机组合这些模板生成大量不重复的文档

interface TopicCorpus {
  id: string;
  titleTemplates: string[];
  paragraphs: string[]; // 每段 100-300 字，随机选 3-8 段组成一篇文档
  keywords: string[];
}

const TOPICS: TopicCorpus[] = [
  {
    id: "auth",
    titleTemplates: [
      "认证系统{action}",
      "JWT/OAuth {action}",
      "登录安全{action}",
      "身份验证{action}",
      "SSO单点登录{action}",
    ],
    paragraphs: [
      "JWT token 的签名算法从 HS256 升级到 RS256 非对称加密。access_token 过期时间设为 15 分钟，refresh_token 设为 7 天。签名密钥每 90 天轮换一次，旧密钥保留 24 小时兼容已签发 token。",
      "OAuth2 授权码模式实现了 PKCE 扩展（Proof Key for Code Exchange），防止授权码拦截攻击。回调 URL 严格白名单校验，不允许通配符。state 参数使用 CSPRNG 生成的 32 字节随机值。",
      "密码存储使用 bcrypt 算法，cost factor 设为 12（约 250ms/hash）。旧用户 MD5 密码在首次登录时自动迁移到 bcrypt。密码策略：最少 8 位，包含大小写字母和数字，禁止最近 5 次使用过的密码。",
      "多因素认证支持 TOTP（Google Authenticator）和 WebAuthn FIDO2（指纹/Face ID）。TOTP 密钥使用 AES-256-GCM 加密存储。备用恢复码生成 10 个一次性码，每个 8 位字母数字。",
      "Session 管理策略：同一账号最多 5 个在线设备，新设备登录挤掉最早的 session。Session ID 使用 128 位随机值，存储在 Redis 中，TTL 与 token 过期时间一致。",
      "SSO 单点登录对接了 SAML 2.0 和 OIDC 两种协议。SAML Response 签名验证使用 X.509 证书。OIDC ID Token 的 aud 和 iss claim 严格校验。",
      "登录安全防护：连续 5 次失败锁定 15 分钟，IP 级别限流每分钟 20 次。验证码使用 hCaptcha 替代 reCAPTCHA（隐私合规）。登录日志记录 IP、User-Agent、地理位置。",
      "Zero Trust 架构实施：每次 API 调用都验证 JWT 令牌有效性。mTLS 双向认证用于服务间通信。API Gateway 统一处理认证逻辑，微服务只需校验 X-User-Id header。",
    ],
    keywords: [
      "JWT",
      "OAuth",
      "token",
      "PKCE",
      "bcrypt",
      "TOTP",
      "WebAuthn",
      "Session",
      "SSO",
      "SAML",
      "OIDC",
      "认证",
      "密码",
      "登录",
    ],
  },
  {
    id: "database",
    titleTemplates: [
      "数据库{action}",
      "MySQL优化{action}",
      "PostgreSQL {action}",
      "Redis缓存{action}",
      "数据架构{action}",
    ],
    paragraphs: [
      "MySQL 慢查询 TOP5 分析：1) orders 表缺少 (user_id, status) 复合索引，全表扫描 2.3s；2) COUNT(*) 在 InnoDB 下走主键索引，优化为 COUNT(1)；3) LIKE '%keyword%' 无法利用索引，改用全文索引；4) JOIN 三张大表改为分步查询+应用层聚合；5) SELECT * 改为只查需要的列，减少 IO。",
      "PostgreSQL JSONB 查询优化：创建 GIN 索引 CREATE INDEX idx_meta ON items USING gin(metadata jsonb_path_ops)。查询速度从 1.2s 降到 15ms。JSONB 路径查询使用 @> 操作符比 -> 链式取值快 10 倍。",
      "Redis 缓存架构设计：Cache-Aside 模式处理读多写少场景。缓存 key 命名规范 {service}:{entity}:{id}:{version}。TTL 分层：热点数据 5 分钟，普通数据 30 分钟，冷数据 2 小时。缓存穿透防护使用布隆过滤器。",
      "分库分表方案：按 user_id 取模分 32 个库，每个库 8 张表。分布式 ID 使用雪花算法（Snowflake）。跨库查询走 ElasticSearch 宽表。分页查询优化：禁止 OFFSET 大于 10000，使用 cursor-based pagination。",
      "数据库连接池配置：HikariCP 最大连接数 50，最小空闲 10，连接最大生命周期 30 分钟。连接泄漏检测 leakDetectionThreshold 设为 60 秒。validation query 使用 SELECT 1，每 30 秒检测一次。",
      "MySQL 主从复制延迟监控：主从延迟 < 100ms。半同步复制 semi-sync 确保至少一个从库收到 binlog。GTID 模式启用，failover 自动切换。读写分离中间件使用 ProxySQL，权重分配 主:从 = 1:3。",
      "数据迁移最佳实践：Online DDL 使用 pt-online-schema-change 避免锁表。字符集迁移 utf8 → utf8mb4 支持 emoji。大表重建索引使用 ALTER TABLE ... ALGORITHM=INPLACE。迁移窗口安排在凌晨 2:00-4:00。",
      "MongoDB 文档数据库用于日志和事件存储。分片策略使用 hash 分片 on _id 字段。写关注 w:majority 确保数据持久化。索引策略：单字段索引 + TTL 索引自动清理 30 天前的日志。",
    ],
    keywords: [
      "MySQL",
      "PostgreSQL",
      "Redis",
      "SQL",
      "索引",
      "缓存",
      "分库分表",
      "连接池",
      "主从复制",
      "数据库",
      "查询优化",
      "MongoDB",
    ],
  },
  {
    id: "deploy",
    titleTemplates: [
      "部署流程{action}",
      "Docker容器{action}",
      "K8s集群{action}",
      "CI/CD流水线{action}",
      "基础设施{action}",
    ],
    paragraphs: [
      "Docker multi-stage build 优化镜像大小：Stage 1 用 node:20-alpine 构建（npm ci --production），Stage 2 用 gcr.io/distroless/nodejs20 运行。最终镜像从 1.2GB 降到 180MB。使用 .dockerignore 排除 node_modules、.git、test 目录。",
      "Kubernetes 集群架构：3 master（高可用 etcd）+ 12 worker 节点。Node 资源：8 核 32GB。Pod 资源限制：request cpu=200m mem=256Mi, limit cpu=1000m mem=1Gi。HPA 自动扩缩容：CPU > 70% 扩容，< 30% 缩容。",
      "CI/CD pipeline 四阶段：1) Build — Docker 构建 + 镜像推送到 Harbor；2) Test — 单元测试 + 集成测试 + SAST 扫描；3) Staging — 自动部署到预发环境 + E2E 测试；4) Production — 人工审批后灰度发布。总耗时 < 15 分钟。",
      "Helm chart 管理：values.yaml 按环境分文件（dev/staging/prod）。Chart 版本与应用版本独立管理。Secrets 使用 sealed-secrets 加密存储在 Git。ConfigMap 热更新使用 reloader 自动重启 Pod。",
      "Terraform IaC 管理所有云资源。State 文件存储在 S3 + DynamoDB 锁。Module 化拆分：network、compute、storage、monitoring。Plan 审核流程：PR 触发 terraform plan，人工确认后 apply。",
      "灰度发布策略：Canary 发布使用 Flagger + Istio。流程：5% 流量 → 分析指标 3 分钟 → 30% → 分析 5 分钟 → 100%。回滚条件：5xx 错误率 > 1% 或 P99 延迟 > 500ms。全程自动化，无需人工干预。",
      "GitOps 工作流：ArgoCD 监控 Git 仓库变更。Application CRD 定义部署目标。Sync policy 设为 automated + self-heal。配置漂移检测每 3 分钟一次，自动修正与 Git 仓库不一致的状态。",
      "日志和监控基础设施：Prometheus + Grafana 监控指标。Loki 收集容器日志。AlertManager 告警路由：P1 → PagerDuty + 电话，P2 → Slack + 邮件，P3 → Slack。SLO 定义：可用性 99.9%，延迟 P99 < 500ms。",
    ],
    keywords: [
      "Docker",
      "K8s",
      "Kubernetes",
      "CI/CD",
      "Helm",
      "Terraform",
      "灰度发布",
      "ArgoCD",
      "GitOps",
      "部署",
      "容器",
      "镜像",
    ],
  },
  {
    id: "frontend",
    titleTemplates: [
      "前端开发{action}",
      "React组件{action}",
      "UI/UX{action}",
      "前端工程化{action}",
      "Web性能{action}",
    ],
    paragraphs: [
      "React 18 Server Components 集成：将数据获取逻辑从客户端移到服务端。首屏 LCP 从 3.5s 降到 1.2s。Streaming SSR 使用 Suspense 边界分块传输 HTML。关键 CSS 内联到 <head>，非关键 CSS 异步加载。",
      "组件架构设计：Atomic Design 方法论分 5 层（Atoms → Molecules → Organisms → Templates → Pages）。共享组件发布为内部 npm 包 @company/ui-kit。组件文档使用 Storybook 7，支持 MDX 格式。",
      "状态管理方案：全局状态使用 Zustand（比 Redux 轻量 90%）。服务端状态使用 TanStack Query（前 React Query）管理缓存和失效。表单状态使用 React Hook Form + Zod 校验。URL 状态使用 nuqs 同步到查询参数。",
      "CSS 方案迁移：从 styled-components 迁移到 Vanilla Extract（零运行时）。CSS 变量实现主题切换（亮色/暗色）。设计令牌（Design Tokens）使用 Style Dictionary 管理。响应式布局使用 Container Queries 替代 Media Queries。",
      "打包构建优化：Vite 替代 Webpack，HMR 速度提升 10 倍。代码分割：路由级 lazy loading + 组件级动态导入。Tree shaking 移除 lodash 全量引入（改用 lodash-es）。Bundle 分析使用 rollup-plugin-visualizer。",
      "Web 性能优化清单：1) 图片使用 <picture> + srcset 响应式加载；2) WebP/AVIF 格式替代 PNG/JPEG；3) 字体使用 font-display: swap + preload；4) 第三方脚本延迟加载（defer/async）；5) prefetch 预加载下一页资源。",
      "无障碍 (A11Y) 适配：WCAG 2.1 AA 级别。aria-label 和 role 属性补全。键盘导航支持 Tab/Shift+Tab/Enter/Escape。颜色对比度 ≥ 4.5:1。Screen reader 测试使用 VoiceOver (macOS) 和 NVDA (Windows)。",
      "国际化 (i18n) 实现：使用 react-i18next 库。支持中文、英文、日文。RTL 布局适配（阿拉伯语/希伯来语）。日期时间使用 Intl.DateTimeFormat。数字格式化使用 Intl.NumberFormat。翻译文件按命名空间拆分。",
    ],
    keywords: [
      "React",
      "Vue",
      "CSS",
      "组件",
      "SSR",
      "Vite",
      "TypeScript",
      "前端",
      "UI",
      "UX",
      "性能",
      "状态管理",
    ],
  },
  {
    id: "security",
    titleTemplates: [
      "安全审计{action}",
      "漏洞修复{action}",
      "安全加固{action}",
      "渗透测试{action}",
      "合规检查{action}",
    ],
    paragraphs: [
      "XSS 防护策略：输出编码使用 DOMPurify 库。CSP (Content-Security-Policy) 头部配置 script-src 'self' 'nonce-{random}'。innerHTML 全部替换为 textContent。React 默认转义 JSX 变量，dangerouslySetInnerHTML 审查后才允许使用。",
      "SQL 注入防护：全部使用参数化查询（Prepared Statements）。ORM 层（Prisma/Drizzle）自动处理参数转义。审计发现 3 处字符串拼接 SQL，全部修复。数据库用户权限最小化：应用账号只有 SELECT/INSERT/UPDATE，禁止 DROP/ALTER。",
      "CSRF 防护实现：SameSite=Strict Cookie 设置。自定义 X-CSRF-Token header 验证。Origin/Referer 校验白名单域名。JSON API 要求 Content-Type: application/json（阻止表单 POST）。",
      "依赖安全审计：npm audit 每周自动运行。Dependabot 监控 CVE 公告，自动提 PR 升级。SCA（Software Composition Analysis）集成到 CI pipeline。发现的 2 个 Critical CVE 在 24 小时内修复。",
      "密钥管理：所有 API Key、数据库密码、证书私钥存储在 HashiCorp Vault。应用通过 Kubernetes Service Account 自动获取密钥。密钥轮换：90 天自动轮换，旧密钥保留 24 小时。Git 仓库使用 git-secrets pre-commit hook 防止密钥泄漏。",
      "WAF 规则配置：OWASP CRS 3.x 规则集。自定义规则：拦截 User-Agent 包含 sqlmap/nmap/nikto 的请求。IP 黑名单：已知恶意 IP 段自动同步。Rate limiting：API 端点每 IP 每分钟 100 次。",
      "渗透测试报告：委托第三方白盒渗透测试。发现 1 个 SSRF 漏洞（内部服务调用未校验 URL），已修复。发现 1 个 IDOR 漏洞（订单 ID 可枚举），增加鉴权校验。建议：增加 HTTP Security Headers（X-Frame-Options, X-Content-Type-Options）。",
      "合规检查：GDPR 数据处理协议 (DPA) 签署完成。用户数据导出 API 实现（Right to Access）。数据删除 API 实现（Right to be Forgotten）。Cookie 同意管理使用 CookieConsent 库。隐私政策和服务条款定期审查更新。",
    ],
    keywords: [
      "XSS",
      "CSRF",
      "SQL注入",
      "WAF",
      "CVE",
      "渗透测试",
      "安全",
      "漏洞",
      "加密",
      "权限",
      "RBAC",
      "合规",
    ],
  },
  {
    id: "performance",
    titleTemplates: [
      "性能优化{action}",
      "性能排查{action}",
      "缓存策略{action}",
      "负载测试{action}",
      "性能监控{action}",
    ],
    paragraphs: [
      "页面加载性能优化结果：LCP 从 3.2s → 1.1s，FID 从 120ms → 45ms，CLS 从 0.15 → 0.02。Core Web Vitals 全部达到 Good 等级。关键路径资源预加载（preload），非关键资源延迟加载（lazy loading）。",
      "Node.js 内存泄漏排查：使用 --inspect + Chrome DevTools 抓取 Heap Snapshot。定位到 EventEmitter 监听器未移除（accumulation pattern）。修复后 RSS 内存从 2.1GB 稳定在 800MB。设置 --max-old-space-size=4096 防止 OOM。",
      "数据库查询性能优化：慢查询阈值设为 200ms。使用 EXPLAIN ANALYZE 分析执行计划。批量插入使用 INSERT ... VALUES (...), (...) 一次 1000 行。N+1 查询问题使用 DataLoader 批量加载解决。",
      "Redis 缓存优化：命中率从 60% 提升到 92%。热点 key 使用 local cache（进程内 LRU）+ Redis 二级缓存。大 key 拆分：将 500KB 的 JSON 拆成多个子 key。Pipeline 批量操作减少网络往返。",
      "API 响应时间优化：P50 从 150ms → 50ms，P99 从 800ms → 200ms。数据库连接复用（连接池预热）。JSON 序列化使用 fast-json-stringify 加速 40%。GraphQL 使用 DataLoader 解决 N+1 问题。",
      "k6 负载测试结果：模拟 2000 并发用户，持续 10 分钟。吞吐量 5200 RPS，P99 延迟 380ms。发现瓶颈：数据库连接池耗尽（max_connections 从 100 提升到 200）。CPU 使用率 70%，内存 4.2GB/8GB。",
      "CDN 优化策略：Cloudflare CDN 命中率 94%。静态资源设置 Cache-Control: public, max-age=31536000, immutable。API 响应设置 Cache-Control: private, no-store。Edge Function 处理 A/B 测试路由。",
      "CPU profiling 分析：JSON.parse/stringify 占总 CPU 时间 30%。替换为 simdjson (C++ binding) 后降到 8%。正则表达式灾难性回溯检测：禁止 (a+)+ 模式。Worker Threads 处理 CPU 密集型任务。",
    ],
    keywords: [
      "LCP",
      "FID",
      "CLS",
      "缓存",
      "CDN",
      "延迟",
      "吞吐量",
      "性能",
      "优化",
      "P99",
      "内存",
      "CPU",
    ],
  },
  {
    id: "api",
    titleTemplates: [
      "API设计{action}",
      "接口规范{action}",
      "API网关{action}",
      "微服务通信{action}",
      "API版本管理{action}",
    ],
    paragraphs: [
      "REST API 设计规范：资源命名使用复数名词（/api/v2/users）。HTTP 方法语义：GET 查询, POST 创建, PUT 全量更新, PATCH 部分更新, DELETE 删除。状态码规范：200 成功, 201 已创建, 400 参数错误, 401 未认证, 403 无权限, 404 未找到, 429 限流, 500 内部错误。",
      "GraphQL API 实现：使用 @apollo/server 4.x。Schema-first 设计，类型定义与实现分离。查询深度限制 5 层防止递归攻击。复杂度分析：每个字段赋予权重，单次查询总复杂度不超过 1000。Persisted queries 防止任意查询。",
      "gRPC 内部通信：Protocol Buffers 3 定义接口。Unary RPC 用于请求-响应模式。Server Streaming 用于实时推送。Deadline propagation 超时传播。健康检查使用 grpc.health.v1.Health 标准协议。",
      "API 限流策略：滑动窗口算法，Redis Lua 脚本实现原子操作。分层限流：全局 10000 RPS，每 IP 200/分钟，每用户 50/分钟。超限返回 429 + Retry-After header。VIP 用户配额翻倍。",
      "API 版本管理：URL 路径版本（/api/v1, /api/v2）。废弃版本提前 6 个月通知，设置 Sunset header。向后兼容原则：新增字段不影响旧客户端。Breaking change 只能在大版本号变更时引入。",
      "API 文档：OpenAPI 3.1 规范自动生成。Swagger UI 在线预览和调试。代码示例覆盖 Python, JavaScript, Go, Java。变更日志（Changelog）记录每个版本的新增、修改、废弃。",
      "WebSocket 实时通信：Socket.IO 4.x 实现。Namespace 按功能划分（/chat, /notifications, /live-data）。Room 机制实现群组推送。心跳间隔 25 秒，超时 60 秒自动断开。消息压缩使用 permessage-deflate。",
      "API Gateway 统一入口：Kong 或 APISIX 作为网关。路由转发、认证鉴权、限流熔断统一处理。Service Discovery 集成 Consul。插件机制：日志、监控、跨域、IP 白名单。",
    ],
    keywords: [
      "REST",
      "GraphQL",
      "gRPC",
      "API",
      "接口",
      "限流",
      "WebSocket",
      "网关",
      "HTTP",
      "端点",
    ],
  },
  {
    id: "testing",
    titleTemplates: [
      "测试策略{action}",
      "自动化测试{action}",
      "质量保证{action}",
      "测试框架{action}",
      "测试覆盖{action}",
    ],
    paragraphs: [
      "测试金字塔策略：单元测试 70%，集成测试 20%，E2E 测试 10%。单元测试使用 Vitest（比 Jest 快 3 倍）。集成测试使用 Testcontainers 启动真实 MySQL/Redis 实例。E2E 测试使用 Playwright 跨浏览器测试。",
      "Mock 策略分层：单元测试 mock 外部依赖（API 调用、数据库、文件系统）。集成测试使用真实依赖（Testcontainers）。E2E 测试不 mock 任何组件。Mock 工具：MSW (Mock Service Worker) 拦截 HTTP 请求。",
      "测试覆盖率目标：行覆盖率 ≥ 80%，分支覆盖率 ≥ 70%。关键模块（认证、支付、数据处理）覆盖率 ≥ 90%。覆盖率报告使用 c8/istanbul。CI 中覆盖率低于阈值自动 fail。",
      "性能测试：k6 负载测试脚本 check() 验证响应。阶段配置：warmup 1 分钟 50 VUs → ramp up 2 分钟到 500 VUs → steady 5 分钟 → ramp down 1 分钟。SLA 验证：P95 < 300ms, error rate < 0.1%。",
      "混沌工程：Chaos Monkey 随机杀 Pod 验证容错。Network Chaos：注入 100ms 延迟和 1% 丢包。Disk Chaos：填满磁盘测试降级策略。定期演练：每月一次故障注入，验证告警和恢复流程。",
      "契约测试：Pact 框架实现消费者驱动的契约测试。Provider 端验证 API 契约兼容性。契约存储在 Pact Broker 中心化管理。CI 中新 PR 自动验证契约不被破坏。",
      "视觉回归测试：Percy 或 Chromatic 截图对比。组件级别截图（Storybook 集成）。页面级别截图（Playwright + 像素对比）。差异阈值 0.1%，超出自动标记 review。",
      "测试数据管理：Factory 模式生成测试数据（faker.js）。数据库 seed 脚本标准化。测试间隔离：每个测试用例使用独立的数据库 transaction，结束后 rollback。Fixture 文件管理测试的静态数据。",
    ],
    keywords: [
      "Vitest",
      "Jest",
      "Playwright",
      "mock",
      "测试",
      "覆盖率",
      "E2E",
      "单元测试",
      "集成测试",
      "TDD",
    ],
  },
  {
    id: "ai",
    titleTemplates: [
      "AI集成{action}",
      "大模型{action}",
      "RAG方案{action}",
      "机器学习{action}",
      "NLP处理{action}",
    ],
    paragraphs: [
      "RAG 检索增强生成架构：文档 → Chunking（400 token，80 overlap）→ Embedding（bge-m3 1024维）→ Vector DB（SQLite + sqlite-vec）→ Top-K 检索 → Prompt 拼接 → LLM 生成。端到端延迟 < 2s。",
      "LLM 选型对比：Claude 3.5 Sonnet 用于生产（推理能力强，上下文 200K）。GPT-4o 作为备选（多模态能力好）。本地部署 Llama 3 70B 用于数据敏感场景。Gemini 1.5 Pro 用于超长文本处理（1M token 上下文）。",
      "Embedding 模型评估：bge-m3 中英文双语效果最好（1024 维，跨语言相似度 0.76）。text-embedding-3-small 英文效果好但中文弱（1536 维）。本地模型 GTE-large 可以离线运行（1024 维，CPU 推理 50ms/query）。",
      "向量数据库选型：SQLite + sqlite-vec 适合单机小规模（100 万向量以内）。Milvus 适合分布式大规模（亿级向量）。FAISS 适合单机高性能检索（支持 GPU 加速）。Qdrant 支持混合搜索（向量 + 关键字）。",
      "Prompt Engineering 最佳实践：System prompt 定义角色和行为约束。Few-shot 示例提升格式一致性。Chain-of-Thought 提升推理准确性。Temperature 设置：创意写作 0.8，代码生成 0.2，事实回答 0。",
      "模型微调流程：LoRA 低秩适配，trainable 参数只有 0.1%。训练数据 10000 条 instruction-response 对。DeepSpeed ZeRO-3 分布式训练。评估指标：BLEU、ROUGE-L、人工评分。A/B 测试验证微调效果。",
      "AI 安全防护：Prompt injection 检测（规则 + 分类器双层）。输出内容审核（关键词过滤 + LLM 自检）。PII 脱敏：正则 + NER 模型识别姓名、电话、身份证号。输入长度限制 4096 token 防止 DoS。",
      "模型推理优化：TensorRT 加速推理 3 倍。INT8 量化减少 GPU 内存 40%。KV Cache 优化 PagedAttention（vLLM）。Batch inference 提升吞吐量。Speculative decoding 使用小模型预测加速大模型生成。",
    ],
    keywords: [
      "RAG",
      "LLM",
      "embedding",
      "向量",
      "大模型",
      "AI",
      "GPT",
      "Claude",
      "NLP",
      "推理",
      "微调",
      "Prompt",
    ],
  },
  {
    id: "architecture",
    titleTemplates: [
      "系统架构{action}",
      "微服务设计{action}",
      "架构演进{action}",
      "技术选型{action}",
      "架构评审{action}",
    ],
    paragraphs: [
      "微服务拆分原则：按业务领域（Bounded Context）拆分，不按技术层拆分。每个服务有独立的数据库（Database per Service）。服务间通信：同步用 gRPC，异步用 Kafka。API Gateway 统一对外暴露接口。",
      "DDD 领域驱动设计：战略设计识别 6 个限界上下文（用户、订单、支付、库存、物流、通知）。聚合根设计：Order 聚合包含 OrderItem、ShippingAddress 值对象。领域事件：OrderPaid → 触发发货、积分、通知。",
      "CQRS 命令查询职责分离：写侧使用 PostgreSQL（强一致性）。读侧使用 ElasticSearch（高性能搜索）。Event Sourcing 记录所有状态变更事件。最终一致性：写入后 100ms 内同步到读侧。",
      "事件驱动架构：核心事件流走 Kafka（高吞吐，持久化）。实时通知走 Redis Pub/Sub（低延迟）。事件溯源：事件不可变，只追加不修改。Saga 模式编排长事务（订单 → 支付 → 库存 → 物流）。",
      "系统可用性设计：多可用区部署（AZ-A + AZ-B + AZ-C）。数据库主从跨 AZ。无状态服务支持水平扩展。有状态服务使用 Sticky Session + Redis 共享状态。SLA 目标 99.95%（年停机时间 < 4.38 小时）。",
      "技术债管理：ADR（Architecture Decision Record）记录每个架构决策。技术债看板：按影响范围和修复成本分类。每个 Sprint 分配 20% 时间处理技术债。定期架构评审（每月一次），识别新增技术债。",
      "服务网格 (Service Mesh)：Istio 实现服务间 mTLS 通信。Envoy Sidecar 透明代理。流量管理：canary、blue-green、fault injection。可观测性：分布式追踪 (Jaeger)、指标 (Prometheus)、日志 (Loki)。",
      "API 设计原则：API-First 开发模式，先写 OpenAPI spec 再写代码。Backward compatible：新增字段不影响旧客户端。Pagination：cursor-based 替代 offset-based。Error format 标准化：RFC 7807 Problem Details。",
    ],
    keywords: [
      "微服务",
      "DDD",
      "CQRS",
      "架构",
      "领域驱动",
      "事件驱动",
      "Saga",
      "Service Mesh",
      "Istio",
      "解耦",
    ],
  },
];

// ─── 辅助工具 ──────────────────────────────────────────────────────────────

const ACTIONS = [
  "讨论",
  "优化",
  "设计",
  "评审",
  "问题排查",
  "方案制定",
  "实践总结",
  "规划",
  "复盘",
  "调研",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dateString(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10);
}

// ─── 文档生成 ──────────────────────────────────────────────────────────────

function generateMemoryDoc(
  topic: TopicCorpus,
  daysAgo: number,
  seqId: number,
): { filename: string; content: string } {
  const date = dateString(daysAgo);
  const action = pick(ACTIONS);
  const title = pick(topic.titleTemplates).replace("{action}", action);
  const numParagraphs = randomInt(3, 7);
  const paragraphs = pickN(topic.paragraphs, numParagraphs);

  // 有些文档带子标题（模拟长文档）
  const sections: string[] = [`# ${date} ${title}`];
  if (numParagraphs >= 5 && Math.random() > 0.3) {
    // 带二级标题
    const mid = Math.floor(paragraphs.length / 2);
    sections.push("", ...paragraphs.slice(0, mid).map((p) => p));
    sections.push("", `## 详细分析`, "");
    sections.push(...paragraphs.slice(mid).map((p) => p));
  } else {
    sections.push("", ...paragraphs.map((p) => p));
  }

  // 有些文档带代码块
  if (Math.random() > 0.6) {
    sections.push(
      "",
      "```",
      `// ${topic.id} 相关代码示例`,
      `const config = { topic: "${topic.id}", seq: ${seqId} };`,
      "```",
    );
  }

  // 有些文档带列表
  if (Math.random() > 0.5) {
    const items = pickN(topic.keywords, randomInt(3, 6));
    sections.push("", "### 关键词", ...items.map((kw, i) => `${i + 1}. ${kw}`));
  }

  const content = sections.join("\n");
  const filename = `${date}-${topic.id}-${seqId}.md`;
  return { filename, content };
}

// ─── Session JSONL 生成 ──────────────────────────────────────────────────

function generateSessionFile(
  topics: TopicCorpus[],
  daysAgo: number,
  sessionId: number,
): { filename: string; content: string } {
  const timestamp = new Date(Date.now() - daysAgo * 86400000).toISOString();
  const numTurns = randomInt(5, 15);
  const lines: string[] = [];

  // Header
  lines.push(
    JSON.stringify({ type: "header", timestamp, agentId: "main", sessionId: `sess-${sessionId}` }),
  );

  for (let i = 0; i < numTurns; i++) {
    const topic = pick(topics);
    const paragraph = pick(topic.paragraphs);

    // User message
    const userQueries = [
      `${pick(topic.keywords)}怎么配置？`,
      `帮我分析一下${pick(topic.keywords)}的问题`,
      `${pick(topic.keywords)}和${pick(topic.keywords)}有什么区别？`,
      `如何优化${pick(topic.keywords)}？`,
      `${pick(topic.keywords)}的最佳实践是什么？`,
    ];
    lines.push(
      JSON.stringify({
        type: "message",
        timestamp: new Date(Date.now() - daysAgo * 86400000 + i * 60000).toISOString(),
        message: { role: "user", content: pick(userQueries) },
      }),
    );

    // Assistant message（较长）
    lines.push(
      JSON.stringify({
        type: "message",
        timestamp: new Date(Date.now() - daysAgo * 86400000 + i * 60000 + 30000).toISOString(),
        message: { role: "assistant", content: paragraph },
      }),
    );
  }

  const filename = `session-${sessionId}.jsonl`;
  return { filename, content: lines.join("\n") };
}

// ─── 主逻辑 ──────────────────────────────────────────────────────────────

function main() {
  const memoryDir = path.join(OUTPUT_DIR, "memory");
  const sessionDir = path.join(OUTPUT_DIR, "sessions", "main");
  fs.mkdirSync(memoryDir, { recursive: true });
  fs.mkdirSync(sessionDir, { recursive: true });

  let totalFiles = 0;
  let totalBytes = 0;
  let seqId = 0;

  // 生成 2000+ memory 文档，分布在 730 天内
  const TARGET_DOCS = 2500;
  console.log(`Generating ${TARGET_DOCS} memory documents...`);

  for (let i = 0; i < TARGET_DOCS; i++) {
    const topic = TOPICS[i % TOPICS.length]!;
    const daysAgo = Math.floor((i / TARGET_DOCS) * 730); // 均匀分布在 2 年内
    const { filename, content } = generateMemoryDoc(topic, daysAgo, seqId++);
    fs.writeFileSync(path.join(memoryDir, filename), content);
    totalFiles++;
    totalBytes += Buffer.byteLength(content);
  }

  console.log(`  Memory docs: ${totalFiles} files, ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);

  // 生成 300 个 session JSONL 文件
  const TARGET_SESSIONS = 300;
  let sessionFiles = 0;
  let sessionBytes = 0;
  console.log(`Generating ${TARGET_SESSIONS} session files...`);

  for (let i = 0; i < TARGET_SESSIONS; i++) {
    const daysAgo = Math.floor((i / TARGET_SESSIONS) * 730);
    const { filename, content } = generateSessionFile(TOPICS, daysAgo, i);
    fs.writeFileSync(path.join(sessionDir, filename), content);
    sessionFiles++;
    sessionBytes += Buffer.byteLength(content);
  }

  console.log(
    `  Session files: ${sessionFiles} files, ${(sessionBytes / 1024 / 1024).toFixed(2)} MB`,
  );

  const grandTotal = totalBytes + sessionBytes;
  console.log(
    `\nTotal: ${totalFiles + sessionFiles} files, ${(grandTotal / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(`Output: ${OUTPUT_DIR}`);

  // 写一个 manifest 文件，记录生成的统计信息
  const manifest = {
    generatedAt: new Date().toISOString(),
    memoryDocs: totalFiles,
    memoryBytes: totalBytes,
    sessionFiles,
    sessionBytes,
    totalBytes: grandTotal,
    topics: TOPICS.map((t) => t.id),
    totalTopics: TOPICS.length,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
}

main();
