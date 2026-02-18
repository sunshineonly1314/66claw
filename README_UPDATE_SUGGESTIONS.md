# README 更新建议

**基于**: 2026-02-17 代码审查
**目的**: 提升README的完整性、准确性和用户友好性

---

## 当前 README 分析

**当前文件**: `README.md` (111,096 字节)

**优点**:
- ✅ 内容详实,覆盖面广
- ✅ 中英文双语支持
- ✅ 包含详细的安装和配置说明
- ✅ 有丰富的功能介绍

**需要改进的方面**:
- ⚠️ 缺少安全最佳实践章节
- ⚠️ 未列出已知问题和限制
- ⚠️ 性能注意事项不够详细
- ⚠️ 贡献指南可以更完善
- ⚠️ 故障排查部分较薄弱

---

## 建议的 README 结构

### 1. 添加"安全与最佳实践"章节

**位置**: 在"配置"章节之后

**建议内容**:

```markdown
## 🔒 安全与最佳实践

### 认证数据保护

OpenClawCN 会存储各种服务的认证凭证(OAuth tokens、API keys等)。为确保安全:

**⚠️ 重要提醒**:
- 从 v2026.2.17 开始,认证数据默认使用加密存储
- 如果您是从旧版本升级,请运行迁移工具:
  ```bash
  npx clawdbot migrate-auth-encryption
  ```

**最佳实践**:
1. **文件权限**: 确保配置目录权限正确
   ```bash
   chmod 700 ~/.config/clawdbot
   chmod 600 ~/.config/clawdbot/auth-store.json
   ```

2. **备份**: 定期备份加密的认证数据
   ```bash
   cp ~/.config/clawdbot/auth-store.json ~/backups/
   ```

3. **环境隔离**: 开发和生产环境使用不同的配置目录
   ```bash
   export CLAWDBOT_AGENT_DIR=~/.config/clawdbot-dev
   ```

### 命令执行安全

OpenClawCN 的核心功能之一是执行命令。请注意:

**⚠️ 安全警告**:
- 不要在 `config.json` 中配置 `tools.exec.pathPrepend` (除非完全信任来源)
- Gateway 模式下已禁止 pathPrepend 以防止 PATH 劫持攻击
- 始终审查批准列表中的命令

**推荐配置**:
```json
{
  "tools": {
    "exec": {
      "approvals": {
        "mode": "prompt",  // 推荐使用 prompt 模式
        "allowlist": [
          // 只添加必要的命令
          "git status",
          "npm install"
        ]
      }
    }
  }
}
```

### 资源限制

为避免资源耗尽,建议配置资源限制:

```json
{
  "sessions": {
    "maintenance": {
      "pruneAfter": "7d",  // 7天后清理会话
      "maxSessions": 100   // 最多保留100个会话
    }
  }
}
```

### 网络安全

如果使用 Gateway 模式连接远程节点:

1. **使用 TLS**: 确保启用 TLS 加密
2. **证书验证**: 不要禁用证书验证
3. **防火墙**: 限制Gateway端口访问
   ```bash
   # 仅允许特定IP访问
   sudo ufw allow from 192.168.1.0/24 to any port 7777
   ```

### 数据隐私

**注意事项**:
- 会话历史包含对话内容,定期清理:
  ```bash
  npx clawdbot sessions prune --older-than 30d
  ```
- 日志可能包含敏感信息,注意保护
- 使用国内服务时注意数据驻留要求

### 安全审计

定期运行安全检查:

```bash
# 检查认证数据加密状态
npx clawdbot doctor --check-auth-encryption

# 检查文件权限
npx clawdbot doctor --check-permissions

# 查看批准列表
npx clawdbot exec approvals list
```

### 报告安全问题

如果发现安全漏洞,请通过以下方式报告:
- 邮件: security@your-domain.com (加密: GPG key)
- 私密Issue: GitHub Security Advisory
- 不要在公开Issue中披露安全漏洞

**安全响应时间**:
- Critical: 24小时内响应,7天内修复
- High: 48小时内响应,14天内修复
```

---

### 2. 添加"已知问题和限制"章节

**位置**: 在"故障排查"章节之前

**建议内容**:

```markdown
## ⚠️ 已知问题和限制

### 当前版本已知问题 (v2026.2.15)

我们正在积极修复以下问题,预计在v2026.3.x版本中解决:

#### 性能相关

1. **长时间运行内存增长** (Issue #3, #7)
   - **现象**: 连续运行数天后内存使用增加
   - **影响**: macOS/Linux长期运行的实例
   - **临时解决**: 每周重启一次服务
   - **状态**: 修复中,预计2周内发布补丁

2. **高并发场景响应慢** (Issue #2, #9)
   - **现象**: 同时处理10+请求时响应变慢
   - **影响**: 高负载场景
   - **临时解决**: 限制并发请求数
   - **状态**: 修复中

#### 兼容性限制

1. **Windows路径问题**
   - **限制**: 包含空格的路径可能导致问题
   - **解决**: 避免在路径中使用空格,或使用短路径名
   - **状态**: 部分修复,长期改进中

2. **Node.js版本要求**
   - **要求**: Node.js >= 22.0.0
   - **原因**: 使用了新的并发API
   - **注意**: 不兼容Node.js 20.x及以下版本

3. **macOS Intel vs Apple Silicon**
   - **已知问题**: Intel Mac上语音唤醒延迟较高
   - **建议**: Apple Silicon Mac获得最佳体验

#### 插件相关

1. **BlueBubbles 私有API依赖** (Issue #11)
   - **限制**: 需要在BlueBubbles服务器启用私有API
   - **风险**: 私有API可能随时失效
   - **建议**: 谨慎用于生产环境

2. **钉钉/飞书高并发**
   - **限制**: 同时大量消息可能触发限流
   - **建议**: 使用消息队列平滑流量

#### 功能限制

1. **最大文件大小**
   - 上传文件: 100MB (可配置)
   - 会话历史: 单个会话最大10MB

2. **并发限制**
   - 同时命令执行: 10个 (可配置)
   - WebSocket连接: 100个 (可配置)

3. **平台功能差异**
   - iOS: 不支持后台语音唤醒(App Store政策)
   - Windows: 不支持PTY模式(技术限制)
   - Linux: 需要PulseAudio或PipeWire(音频依赖)

### 计划中的改进

**短期 (1-2个月)**:
- [ ] 修复所有已知的Critical和High问题
- [ ] 改进资源管理和内存效率
- [ ] 提升并发性能
- [ ] 增强错误处理和诊断

**中期 (3-6个月)**:
- [ ] 重构核心架构,提升稳定性
- [ ] 改进插件系统API
- [ ] 增加更多测试覆盖
- [ ] 性能优化

**长期 (6-12个月)**:
- [ ] 分布式架构支持
- [ ] 增强安全特性
- [ ] AI能力升级
- [ ] 企业级功能

### 获取更新

- 订阅 [Release Notes](https://github.com/your-repo/releases)
- 关注 [Issue Tracker](https://github.com/your-repo/issues)
- 加入 [Discord社区](https://discord.gg/...)
```

---

### 3. 添加"性能优化建议"章节

**位置**: 在"配置"章节内,作为子章节

**建议内容**:

```markdown
## ⚡ 性能优化建议

### 硬件要求

**最低配置**:
- CPU: 2核
- 内存: 4GB
- 磁盘: 5GB可用空间

**推荐配置**:
- CPU: 4核+ (Apple Silicon / Intel i5+)
- 内存: 8GB+ (16GB更佳)
- 磁盘: 10GB+ SSD

### 性能优化配置

#### 1. 会话管理

定期清理旧会话避免内存和磁盘占用:

```json
{
  "sessions": {
    "maintenance": {
      "enabled": true,
      "pruneAfter": "7d",    // 7天后清理
      "maxSessions": 100,    // 最多保留100个
      "checkInterval": "1h"  // 每小时检查一次
    }
  }
}
```

#### 2. 日志级别

生产环境使用适当的日志级别:

```json
{
  "logging": {
    "level": "info",  // 不要使用 "debug" 或 "trace"
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

#### 3. 并发控制

根据硬件配置调整并发:

```json
{
  "tools": {
    "exec": {
      "maxConcurrent": 5,  // CPU核心数的1-2倍
      "timeout": 300000    // 5分钟超时
    }
  }
}
```

#### 4. 缓存策略

合理配置缓存:

```json
{
  "cache": {
    "enabled": true,
    "maxSize": "500MB",
    "ttl": 3600  // 1小时
  }
}
```

### 监控和诊断

#### 性能监控

使用内置的性能监控:

```bash
# 实时查看性能指标
npx clawdbot monitor --metrics

# 查看资源使用
npx clawdbot doctor --resources
```

#### 性能分析

如果遇到性能问题:

```bash
# 启用性能分析
NODE_OPTIONS="--inspect" npx clawdbot serve

# 生成CPU profile
kill -SIGUSR2 <pid>

# 生成内存快照
node --expose-gc --inspect your-script.js
```

### 常见性能问题

#### 内存占用过高

**排查步骤**:
1. 检查会话数量: `npx clawdbot sessions list | wc -l`
2. 检查日志文件大小: `du -sh ~/.config/clawdbot/logs`
3. 运行诊断: `npx clawdbot doctor --check-resources`

**解决方法**:
- 减小会话保留时间
- 清理旧日志
- 降低日志级别
- 重启服务

#### CPU占用过高

**可能原因**:
- 大量并发命令执行
- 正则表达式性能问题
- 死循环或无限重试

**排查方法**:
```bash
# 查看活跃进程
npx clawdbot ps

# 查看最近的命令
npx clawdbot history --tail 20

# 检查错误日志
npx clawdbot logs --level error --tail 50
```

#### 响应慢

**优化检查清单**:
- [ ] 网络连接是否稳定
- [ ] Gateway连接是否正常
- [ ] 是否有大量并发请求
- [ ] 磁盘I/O是否正常
- [ ] 是否需要增加超时时间

### 生产环境部署建议

1. **使用进程管理器**
   ```bash
   # PM2
   pm2 start npx --name clawdbot -- clawdbot serve
   pm2 save

   # systemd (推荐)
   sudo systemctl enable clawdbot
   sudo systemctl start clawdbot
   ```

2. **配置监控和报警**
   - CPU使用率 > 80% 报警
   - 内存使用率 > 80% 报警
   - 磁盘使用率 > 90% 报警
   - 错误率 > 5% 报警

3. **定期维护**
   - 每周检查日志
   - 每月清理旧数据
   - 每季度更新依赖
   - 定期备份配置

4. **负载均衡**
   - 使用多个Gateway分担负载
   - 配置反向代理(nginx/traefik)
   - 实施限流策略
```

---

### 4. 改进"贡献指南"章节

**位置**: README末尾

**建议内容**:

```markdown
## 🤝 贡献指南

我们欢迎各种形式的贡献!无论是报告bug、提出功能建议、改进文档,还是提交代码。

### 开始之前

1. **阅读行为准则**: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
2. **查看已有Issue**: 避免重复工作
3. **讨论大的改动**: 大型功能请先创建RFC Issue讨论

### 报告Bug

**好的Bug报告应该包括**:
- 清晰的标题和描述
- 复现步骤
- 预期行为 vs 实际行为
- 环境信息(OS、Node.js版本等)
- 相关日志和截图

**Bug报告模板**:
```markdown
**描述**
简短描述问题

**复现步骤**
1. 执行命令 '...'
2. 观察到 '...'
3. 预期应该 '...'

**环境**
- OS: macOS 14.2
- Node.js: v22.1.0
- ClawdBot: v2026.2.15

**日志**
[粘贴相关日志]
```

### 提出功能建议

**功能请求应该包括**:
- 功能描述和使用场景
- 为什么需要这个功能
- 可能的实现方案
- 是否愿意参与开发

### 贡献代码

#### 开发环境设置

```bash
# 1. Fork并克隆仓库
git clone https://github.com/your-username/clawdbot.git
cd clawdbot

# 2. 安装依赖
npm install

# 3. 构建项目
npm run build

# 4. 运行测试
npm test

# 5. 创建功能分支
git checkout -b feature/your-feature-name
```

#### 编码规范

**TypeScript/JavaScript**:
- 使用TypeScript严格模式
- 遵循Prettier格式化
- 通过ESLint检查
- 添加JSDoc注释

**示例**:
```typescript
/**
 * 执行命令并返回结果
 * @param command - 要执行的命令
 * @param options - 执行选项
 * @returns 命令输出
 * @throws {Error} 当命令执行失败时
 */
export async function executeCommand(
  command: string,
  options: ExecOptions = {}
): Promise<ExecResult> {
  // 验证输入
  if (!command || typeof command !== 'string') {
    throw new Error('Invalid command');
  }

  // 实现...
}
```

**Swift**:
- 遵循Swift API设计指南
- 使用SwiftLint
- 添加文档注释

#### 测试要求

**所有PR必须包括测试**:
- 单元测试覆盖新代码
- 集成测试验证功能
- 边界条件测试
- 并发场景测试(如适用)

**测试示例**:
```typescript
describe('executeCommand', () => {
  it('should execute valid command', async () => {
    const result = await executeCommand('echo "test"');
    expect(result.stdout).toBe('test\n');
  });

  it('should reject invalid command', async () => {
    await expect(
      executeCommand('')
    ).rejects.toThrow('Invalid command');
  });

  it('should handle concurrent execution', async () => {
    const results = await Promise.all(
      Array(10).fill(0).map(() => executeCommand('echo "test"'))
    );
    expect(results).toHaveLength(10);
  });
});
```

#### 提交信息规范

使用[Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add support for custom timeout
fix: resolve memory leak in session store
docs: update installation guide
test: add concurrency tests
refactor: simplify error handling
perf: optimize regex compilation
```

**类型**:
- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档
- `test`: 测试
- `refactor`: 重构
- `perf`: 性能优化
- `chore`: 构建/工具

#### Pull Request流程

1. **创建PR前**:
   - [ ] 代码通过所有测试
   - [ ] 代码通过lint检查
   - [ ] 添加/更新文档
   - [ ] 更新CHANGELOG.md

2. **PR描述应包括**:
   - 改动内容和原因
   - 相关Issue编号
   - 测试方法
   - 截图(如适用)
   - 破坏性变更说明

3. **PR检查清单**:
   ```markdown
   - [ ] 代码遵循项目规范
   - [ ] 添加了必要的测试
   - [ ] 所有测试通过
   - [ ] 文档已更新
   - [ ] 提交信息符合规范
   - [ ] 无破坏性变更,或已文档化
   ```

4. **代码审查**:
   - 至少1名维护者审查
   - 处理所有审查意见
   - CI检查全部通过

5. **合并后**:
   - 删除功能分支
   - 关闭相关Issue
   - 更新项目板

### 开发技巧

#### 本地测试

```bash
# 运行特定测试
npm test -- src/agents/bash-tools.test.ts

# 监视模式
npm test -- --watch

# 覆盖率报告
npm run test:coverage

# E2E测试
npm run test:e2e
```

#### 调试

```bash
# Node.js调试
NODE_OPTIONS="--inspect" npm start

# 详细日志
DEBUG=clawdbot:* npm start

# 使用VSCode调试
# 在.vscode/launch.json中配置
```

#### 性能分析

```bash
# CPU profile
node --prof your-script.js
node --prof-process isolate-*.log > processed.txt

# 内存分析
node --inspect --expose-gc your-script.js
```

### 文档贡献

**文档同样重要!**
- 修正拼写和语法错误
- 改进示例和说明
- 添加缺失的文档
- 翻译文档

### 社区

- **Discord**: [加入讨论](https://discord.gg/...)
- **论坛**: [提问和分享](https://forum....)
- **周会**: 每周五晚8点(北京时间)
- **邮件列表**: dev@clawdbot.io

### 致谢

感谢所有贡献者! 🎉

查看完整贡献者列表: [CONTRIBUTORS.md](CONTRIBUTORS.md)

### 许可证

通过贡献代码,您同意您的贡献将采用与项目相同的[MIT许可证](LICENSE)。
```

---

### 5. 添加"故障排查"增强

**位置**: 替换或增强现有的故障排查章节

**建议内容**:

```markdown
## 🔧 故障排查

### 常见问题速查

| 问题 | 可能原因 | 解决方法 |
|------|----------|----------|
| 无法启动 | 端口被占用 | `npx clawdbot doctor --check-ports` |
| 命令执行失败 | 权限不足 | 检查文件权限,使用 `chmod +x` |
| 内存占用高 | 会话过多 | `npx clawdbot sessions prune` |
| 连接Gateway失败 | 证书问题 | 检查证书有效期,重新信任 |
| 消息发送失败 | Token过期 | 重新认证,检查网络 |

### 详细故障排查

#### 1. 启动失败

**症状**: 运行 `npx clawdbot serve` 失败

**排查步骤**:
```bash
# 1. 检查Node.js版本
node --version  # 应该 >= 22.0.0

# 2. 检查端口占用
npx clawdbot doctor --check-ports

# 3. 检查配置文件
npx clawdbot config validate

# 4. 查看详细错误
DEBUG=clawdbot:* npx clawdbot serve
```

**常见错误**:
- `Error: listen EADDRINUSE`: 端口被占用
  ```bash
  # 查找占用进程
  lsof -i :7777  # macOS/Linux
  netstat -ano | findstr :7777  # Windows
  ```

- `Error: Cannot find module`: 依赖未安装
  ```bash
  rm -rf node_modules package-lock.json
  npm install
  ```

#### 2. 认证问题

**症状**: 无法连接到外部服务(钉钉/飞书等)

**排查步骤**:
```bash
# 1. 检查认证状态
npx clawdbot auth list

# 2. 验证Token
npx clawdbot auth verify --profile <profile-name>

# 3. 重新认证
npx clawdbot auth login --service dingtalk
```

**常见错误**:
- `Token expired`: Token过期
  - 重新登录获取新Token

- `Invalid credentials`: 凭证无效
  - 检查App ID和Secret是否正确
  - 确认服务端配置

#### 3. 性能问题

**症状**: 响应慢或卡顿

**诊断工具**:
```bash
# 运行完整诊断
npx clawdbot doctor

# 检查资源使用
npx clawdbot monitor --resources

# 查看活跃进程
npx clawdbot ps

# 分析性能瓶颈
NODE_OPTIONS="--inspect" npx clawdbot serve
```

**优化措施**:
1. 清理旧数据
   ```bash
   npx clawdbot sessions prune --older-than 7d
   npx clawdbot logs clean --keep-days 7
   ```

2. 调整配置
   ```json
   {
     "sessions": { "maintenance": { "pruneAfter": "3d" } },
     "logging": { "level": "info" }
   }
   ```

3. 重启服务
   ```bash
   pm2 restart clawdbot
   ```

#### 4. 连接问题

**症状**: Gateway连接不稳定或失败

**检查清单**:
- [ ] 网络连接正常
- [ ] 防火墙规则正确
- [ ] 证书有效且未过期
- [ ] 时间同步正确

**诊断命令**:
```bash
# 测试网络连接
curl -v https://gateway-host:7777/health

# 检查证书
openssl s_client -connect gateway-host:7777

# 查看连接日志
npx clawdbot logs --grep "gateway" --tail 100
```

#### 5. 插件问题

**症状**: 特定插件不工作

**排查步骤**:
```bash
# 1. 检查插件状态
npx clawdbot plugins list

# 2. 验证插件配置
npx clawdbot plugins verify <plugin-name>

# 3. 重新加载插件
npx clawdbot plugins reload <plugin-name>

# 4. 查看插件日志
npx clawdbot logs --plugin <plugin-name>
```

### 获取帮助

**自助资源**:
- 📚 [完整文档](https://docs.clawdbot.io)
- 💬 [Discord社区](https://discord.gg/...)
- 🐛 [Issue追踪](https://github.com/your-repo/issues)
- 📧 [邮件列表](mailto:help@clawdbot.io)

**报告Bug**:
1. 搜索已有Issue避免重复
2. 使用Bug模板创建Issue
3. 提供详细的复现步骤
4. 附上日志和环境信息

**紧急支持**:
- Critical安全问题: security@clawdbot.io
- 生产环境故障: support@clawdbot.io (企业用户)
```

---

## 其他建议改进

### 6. 在README顶部添加状态徽章

```markdown
![Build Status](https://github.com/your-repo/actions/workflows/ci.yml/badge.svg)
![Test Coverage](https://codecov.io/gh/your-repo/branch/master/graph/badge.svg)
![Security Scan](https://snyk.io/test/github/your-repo/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/github/v/release/your-repo)
```

### 7. 添加快速开始视频/动图

在"快速开始"章节添加:
```markdown
### 📹 视频教程

- [5分钟快速入门](https://youtube.com/...)
- [完整功能演示](https://youtube.com/...)
- [常见问题解答](https://youtube.com/...)

### 🎬 功能演示

![Demo](./docs/images/demo.gif)
```

### 8. 添加比较表格

如果有竞品,可以添加功能对比:
```markdown
### 为什么选择 OpenClawCN?

| 功能 | OpenClawCN | 竞品A | 竞品B |
|------|-----------|-------|-------|
| 中国本地化 | ✅ 完整 | ⚠️ 部分 | ❌ 无 |
| 钉钉/飞书集成 | ✅ 原生 | 🔌 插件 | ❌ 无 |
| 开源 | ✅ MIT | ⚠️ 部分 | ❌ 闭源 |
| 本地部署 | ✅ 支持 | ✅ 支持 | ❌ 仅云 |
| 自托管 | ✅ 免费 | 💰 付费 | ❌ 不支持 |
```

### 9. 改进示例代码

在配置示例中添加更多注释:
```json5
{
  // 服务器配置
  "server": {
    "port": 7777,        // 监听端口
    "host": "0.0.0.0"    // 绑定地址,0.0.0.0监听所有接口
  },

  // 命令执行配置
  "tools": {
    "exec": {
      "approvals": {
        "mode": "prompt",  // 可选: auto, prompt, deny
        "allowlist": [     // 自动批准的命令列表
          "git status",
          "npm install"
        ]
      },
      "maxConcurrent": 5,  // 最大并发执行数
      "timeout": 300000    // 超时时间(毫秒)
    }
  }
}
```

### 10. 添加迁移指南

如果用户从旧版本升级:
```markdown
## 📦 从旧版本升级

### 从 v2026.1.x 升级到 v2026.2.x

**重要变更**:
1. 认证存储现在默认加密
2. 配置文件结构有变化
3. 某些API已弃用

**升级步骤**:
```bash
# 1. 备份数据
cp -r ~/.config/clawdbot ~/.config/clawdbot.backup

# 2. 更新版本
npm install -g clawdbot@latest

# 3. 运行迁移工具
npx clawdbot migrate --from 2026.1.x

# 4. 验证配置
npx clawdbot config validate

# 5. 重启服务
pm2 restart clawdbot
```

**不兼容变更**:
- 移除了已弃用的 `exec.unsafeMode` 选项
- `sessions.maxAge` 重命名为 `sessions.maintenance.pruneAfter`
- API端点 `/api/v1/exec` 改为 `/api/v2/exec`
```

---

## 实施计划

### 优先级

**High (立即实施)**:
1. ✅ 添加"安全与最佳实践"章节
2. ✅ 添加"已知问题和限制"章节
3. ✅ 改进"故障排查"章节

**Medium (本周内)**:
4. 添加"性能优化建议"章节
5. 改进"贡献指南"章节
6. 添加状态徽章

**Low (逐步完善)**:
7. 添加视频教程
8. 添加比较表格
9. 改进示例代码注释
10. 添加迁移指南

### 审核流程

1. **初稿**: 根据本建议创建README更新PR
2. **技术审核**: 技术团队审核准确性
3. **文案审核**: 检查语言表达和格式
4. **社区反馈**: 发布到Discord/论坛征求意见
5. **最终发布**: 合并PR并发布

---

## 附录:README检查清单

使用此清单确保README完整:

### 基本信息
- [ ] 项目名称和Logo
- [ ] 一句话介绍
- [ ] 状态徽章
- [ ] 简短描述和特性列表

### 快速开始
- [ ] 系统要求
- [ ] 安装步骤
- [ ] 基本使用示例
- [ ] 视频/动图演示

### 核心功能
- [ ] 功能列表和说明
- [ ] 使用示例和代码
- [ ] 配置选项
- [ ] 插件系统

### 安全和最佳实践
- [ ] 安全警告和注意事项
- [ ] 推荐配置
- [ ] 资源限制建议
- [ ] 审计和监控

### 已知问题
- [ ] 当前版本已知问题
- [ ] 兼容性限制
- [ ] 平台差异
- [ ] 计划改进

### 文档和支持
- [ ] 完整文档链接
- [ ] API参考
- [ ] 故障排查指南
- [ ] 获取帮助的渠道

### 开发和贡献
- [ ] 开发环境设置
- [ ] 编码规范
- [ ] 测试要求
- [ ] PR流程

### 其他
- [ ] 许可证
- [ ] 贡献者致谢
- [ ] Roadmap
- [ ] 更新日志

---

**本建议基于**: 2026-02-17代码审查发现
**更新日期**: 2026-02-17
**下次审查**: 3个月后或重大版本发布时
