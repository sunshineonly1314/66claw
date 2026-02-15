# TODO-03: 大文件拆分

**优先级**: P1  
**预估工时**: 4-5天  
**影响**: 代码可维护性、测试覆盖率

## 问题清单

项目指南建议文件保持在 500 行以内（700行上限），以下文件严重超标：

| 文件 | 行数 | 超标倍数 | 优先级 |
|------|------|----------|--------|
| `src/gateway/setup-wizard.ts` | 2155 | 4.3x | 高 |
| `ui/src/ui/views/skills.ts` | 1139 | 2.3x | 中 |
| `ui/src/ui/views/overview.ts` | 1080 | 2.2x | 中 |
| `ui/src/ui/app.ts` | 950 | 1.9x | 中 |
| `src/gateway/server-methods/chat.ts` | 695 | 1.4x | 低 |
| `extensions/wecom/src/channel.ts` | 631 | 1.3x | 低 |
| `src/cli/skills-cli.ts` | 625 | 1.3x | 低 |

---

### 3.1 setup-wizard.ts 拆分方案（最优先）

当前 2155 行，包含：路由分发、提供商选择、API Key 配置、渠道配置、安全设置、目录浏览、授权处理。

**建议拆分结构**:
```
src/gateway/setup-wizard/
├── index.ts              (~100行) 路由分发入口
├── types.ts              (~50行)  类型定义
├── state.ts              (~30行)  向导状态管理
├── handlers/
│   ├── providers.ts      (~300行) 提供商选择与API Key
│   ├── channels.ts       (~250行) 渠道配置
│   ├── security.ts       (~150行) 安全设置
│   ├── license.ts        (~200行) 授权处理
│   ├── browse.ts         (~100行) 目录浏览
│   └── test-connection.ts(~100行) 连接测试
└── utils.ts              (~100行) 响应工具函数
```

**注意事项**:
- 保持 `handleSetupWizardHttpRequest` 导出签名不变
- `setChannelStartCallback` 回调机制保持不变
- 逐步迁移，每步确保测试通过

---

### 3.2 UI 大文件拆分方案

**skills.ts (1139行)**:
```
ui/src/ui/views/skills/
├── index.ts         重新导出
├── skills-list.ts   列表渲染
├── skills-search.ts 搜索与筛选
├── skills-detail.ts 详情面板
├── skills-install.ts 安装流程
└── skills-types.ts  类型
```

**overview.ts (1080行)**:
```
ui/src/ui/views/overview/
├── index.ts              重新导出
├── model-selector.ts     模型选择
├── stats-panel.ts        统计面板
├── quick-actions.ts      快速操作
└── security-toggle.ts    安全模式
```

**app.ts (950行)**:
```
提取状态到独立管理器：
├── state/chat-state.ts
├── state/config-state.ts
├── state/license-state.ts
└── state/navigation-state.ts
使用 Lit Context 注入
```

## 拆分原则

1. **签名不变**: 对外暴露的函数/类签名不改
2. **逐个文件**: 每次只拆一个文件，确认无回归后再拆下一个
3. **测试先行**: 如果有对应测试文件，先确认测试通过
4. **import 路径**: 使用 index.ts 重新导出，最小化对其他模块的影响

## 验收标准

- [ ] setup-wizard.ts 拆分为 < 500行的子模块
- [ ] skills.ts 拆分为 < 500行的子组件
- [ ] overview.ts 拆分为 < 500行的子组件
- [ ] 所有现有测试通过
- [ ] lint 零错误
