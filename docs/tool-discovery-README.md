# 工具发现系统 - 文档索引

**系统版本**: v1.0.0
**更新日期**: 2026-02-18
**状态**: ✅ 生产就绪 (需应用 P0 补丁)

---

## 📚 文档导航

### 🚀 快速开始
1. **[用户使用指南](tool-discovery-cn.md)** ⭐ **推荐首读**
   - 如何查询工具 (CLI + API)
   - 如何启用向量搜索
   - 常见问题 FAQ
   - 适合: 用户、运维

### 🏗️ 架构设计
2. **[系统架构文档](tool-discovery-architecture.md)**
   - 双系统设计 (CLI Query + LLM Auto)
   - FTS5 + Vector 混合搜索原理
   - 数据流与模块关系
   - 适合: 开发者、架构师

3. **[启动策略文档](tool-discovery-startup-strategy.md)**
   - Phase 0: CI 构建 (FTS5 only)
   - Phase 1: 用户首次启动 (默认模式)
   - Phase 2: 启用向量搜索 (升级模式)
   - 降级与容错机制
   - 适合: 运维、DevOps

### 🛠️ 开发指南
4. **[CRUD API 文档](tool-index-crud-api.md)**
   - `incrementalUpdate()` 使用方法
   - 添加/删除/更新工具
   - 事务保护与同步逻辑
   - 适合: 开发者、插件作者

5. **[完成报告](tool-discovery-system-completion.md)**
   - 功能清单 (已完成 ✅)
   - 文件清单
   - 使用示例
   - 性能指标
   - 适合: 项目经理、产品经理

### 🔍 代码审查
6. **[深度代码审查报告](tool-discovery-code-review.md)** ⚠️ **重要**
   - 12 个发现的问题 (3 P0 + 5 P1 + 4 P2)
   - 详细风险分析
   - 测试建议
   - 适合: 开发者、Tech Lead

7. **[紧急修复补丁](tool-discovery-hotfix-patches.md)** 🔧 **待应用**
   - P0: DB 泄漏、FTS5 注入、Embedding 超时
   - P1: 并发限流、路径解析、错误日志
   - P2: FTS5 Fallback、进度回调
   - 包含可直接应用的代码
   - 适合: 开发者

8. **[审查总结](tool-discovery-review-summary.md)** 📊 **管理层摘要**
   - 高层次概览
   - 关键发现与建议
   - 修复路线图
   - 适合: 管理层、决策者

---

## 🎯 按角色推荐阅读

### 👤 最终用户
```
1. 用户使用指南 (tool-discovery-cn.md)
   - 如何搜索工具
   - 如何启用向量搜索

2. 启动策略文档 (tool-discovery-startup-strategy.md)
   - 理解三阶段启动
   - 何时需要配置 API Key
```

### 💻 开发者
```
1. 用户使用指南 (tool-discovery-cn.md)
   - API 集成示例

2. 系统架构文档 (tool-discovery-architecture.md)
   - 理解双系统设计
   - 数据流与模块

3. CRUD API 文档 (tool-index-crud-api.md)
   - 增删改查工具

4. 代码审查报告 (tool-discovery-code-review.md) ⚠️
   - 理解潜在风险
   - 测试建议

5. 紧急修复补丁 (tool-discovery-hotfix-patches.md) 🔧
   - 应用 P0 补丁
```

### 🏗️ 架构师 / Tech Lead
```
1. 系统架构文档 (tool-discovery-architecture.md)
2. 启动策略文档 (tool-discovery-startup-strategy.md)
3. 代码审查报告 (tool-discovery-code-review.md) ⚠️
4. 审查总结 (tool-discovery-review-summary.md) 📊
```

### 📊 产品经理 / 项目经理
```
1. 完成报告 (tool-discovery-system-completion.md)
   - 功能清单
   - 性能指标

2. 审查总结 (tool-discovery-review-summary.md) 📊
   - 关键发现
   - 修复路线图
```

### ⚙️ 运维 / DevOps
```
1. 用户使用指南 (tool-discovery-cn.md)
   - 构建索引命令
   - 配置环境变量

2. 启动策略文档 (tool-discovery-startup-strategy.md)
   - CI/CD 集成
   - 降级策略

3. 紧急修复补丁 (tool-discovery-hotfix-patches.md) 🔧
   - 路径解析修复 (打包环境)
```

---

## 📂 文件结构

```
docs/
├── tool-discovery-README.md                 # 📖 本文档 (索引)
├── tool-discovery-cn.md                     # 🚀 用户使用指南
├── tool-discovery-architecture.md            # 🏗️ 系统架构文档
├── tool-discovery-startup-strategy.md        # ⚙️ 启动策略文档
├── tool-index-crud-api.md                   # 🛠️ CRUD API 文档
├── tool-discovery-system-completion.md       # ✅ 完成报告
├── tool-discovery-code-review.md            # 🔍 代码审查报告
├── tool-discovery-hotfix-patches.md         # 🔧 紧急修复补丁
└── tool-discovery-review-summary.md         # 📊 审查总结
```

---

## ⚡ 快速链接

### 常见任务

#### 🔍 我想查询工具
→ [用户使用指南 - 查询命令](tool-discovery-cn.md#命令行查询工具)

#### 🚀 我想启用向量搜索
→ [用户使用指南 - 向量化配置](tool-discovery-cn.md#向量化配置)

#### 🛠️ 我想添加自定义工具
→ [CRUD API 文档 - 添加工具示例](tool-index-crud-api.md#场景-1-添加自定义-skill)

#### 🐛 我遇到了错误
→ [用户使用指南 - 常见问题](tool-discovery-cn.md#常见问题)

#### 🔧 我要应用修复补丁
→ [紧急修复补丁 - 应用顺序](tool-discovery-hotfix-patches.md#应用补丁的顺序)

#### 📊 我要了解系统状态
→ [完成报告 - 系统概览](tool-discovery-system-completion.md#系统概览)

---

## 🚨 重要提醒

### ⚠️ 必读 (部署前)
1. **[代码审查报告](tool-discovery-code-review.md)** - 了解 3 个 P0 关键问题
2. **[紧急修复补丁](tool-discovery-hotfix-patches.md)** - 应用 P0 补丁后再部署

### 📝 建议阅读
3. **[启动策略文档](tool-discovery-startup-strategy.md)** - 理解三阶段启动
4. **[系统架构文档](tool-discovery-architecture.md)** - 理解设计决策

---

## 📊 系统状态

### ✅ 已完成功能
- ✅ 11,969 个工具统一索引
- ✅ FTS5 BM25 全文搜索 (<10ms)
- ✅ 向量混合搜索 (~50ms, 可选)
- ✅ 断点续传向量化
- ✅ 降级策略 (向量 → FTS5 → LIKE)
- ✅ CLI 查询工具
- ✅ LLM 智能推荐 API
- ✅ CRUD API (增删改查)
- ✅ 129 个测试 (全部通过)

### ⚠️ 待修复 (P0)
- 🔴 DB 连接泄漏 (10 分钟修复)
- 🔴 FTS5 注入风险 (10 分钟修复)
- 🔴 Embedding 超时 (30 分钟修复)

### 🟡 计划增强 (P1)
- 🟡 并发限流 (2 小时)
- 🟡 路径解析优化 (1 天)
- 🟡 错误日志增强 (30 分钟)

---

## 🔄 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.0.0 | 2026-02-18 | 初始发布,功能完整 |
| v1.0.1 | 待定 | P0 紧急修复 |
| v1.1.0 | 待定 | P1 增强 + 测试覆盖 |

---

## 📞 支持

- **技术问题**: 查看 [用户使用指南 FAQ](tool-discovery-cn.md#常见问题)
- **Bug 报告**: 参考 [代码审查报告](tool-discovery-code-review.md)
- **功能请求**: 提交 Issue 或 PR

---

**维护者**: OpenClawCN Team
**最后更新**: 2026-02-18
**状态**: ✅ 文档完整,系统就绪
