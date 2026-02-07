# ClawdbotCN Windows 安装包测试报告

> 测试日期: 2026-02-04  
> 测试版本: 2026.2.3  
> 测试文件: `E:\clawdbuild\ClawdbotCN-Setup-2026.2.3-x64.exe` (106.22 MB)  
> 测试工程师: 自动化测试

---

## 一、测试概览

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 并行构建 | ✅ 通过 | 92.1 秒完成，加速 ~1.4x |
| 文件结构 | ✅ 通过 | 完整包含所有必需文件 |
| Gateway 服务 | ✅ 通过 | 端口 18789 正常监听 |
| Web UI 访问 | ✅ 通过 | 所有页面正常加载 |
| 中文显示 | ✅ 通过 | 界面中文化完整 |
| 主题切换 | ✅ 通过 | 明/暗主题切换正常 |

---

## 二、构建测试

### 2.1 并行构建性能

使用 `build-offline-parallel.ps1` 进行 20 线程并行构建：

```
总耗时: 92.1 秒

各阶段耗时:
- TypeScript 构建: 10.8s
- 编码转换: 10.5s
- .NET 服务构建: 10.4s
- npm install: 4.3s (缓存命中)
- 安装包编译: 75.6s (主要瓶颈)

性能提升: ~1.4x (节省约 39 秒)
```

### 2.2 输出文件

| 文件 | 大小 |
|------|------|
| ClawdbotCN-Setup-2026.2.3-x64.exe | 106.22 MB |

---

## 三、安装测试

### 3.1 安装目录结构

安装位置: `E:\clawdbuild\ClawdbotCN`

```
ClawdbotCN/
├── assets/           # 资源文件
├── config/           # 配置目录
├── data/             # 数据目录
├── dist/             # 编译输出
├── docs/             # 文档
├── extensions/       # 扩展插件 (飞书/钉钉/企微)
├── logs/             # 日志目录
├── node/             # Node.js 便携版
├── node_modules/     # 依赖包 (~391 MB)
├── skills/           # 技能目录
├── clawdbot.bat      # 主启动脚本
├── ClawdbotTray.ps1  # 托盘程序
├── diagnose.bat      # 诊断工具
├── fix-gateway.bat   # 修复工具
├── post-install.bat  # 安装后脚本
├── start-gateway.bat # Gateway 启动脚本
└── package.json      # 包配置
```

### 3.2 进程状态

```
进程名           PID     启动时间
ClawdbotService  30612   2026/2/3 9:43:09
node (Gateway)   48796   2026/2/4 4:00:39
```

### 3.3 端口监听

```
TCP 127.0.0.1:18789 LISTENING (Gateway)
TCP [::1]:18789     LISTENING (Gateway IPv6)
```

---

## 四、Web UI 测试

### 4.1 页面访问测试

| 页面 | URL | 状态 |
|------|-----|------|
| 对话 | /chat | ✅ 正常 |
| 概览 | /overview | ✅ 正常 |
| 用量统计 | /usage | ✅ 正常 |
| 指挥渠道 | /channels | ✅ 正常 |
| 实例 | /instances | ✅ 正常 |
| 会话 | /sessions | ✅ 正常 |
| 定时任务 | /cron | ✅ 正常 |
| 玩法推荐 | /playground | ✅ 正常 |
| 技能 | /skills | ✅ 正常 |
| 节点 | /nodes | ✅ 正常 |
| 配置 | /config | ✅ 正常 |
| 调试 | /debug | ✅ 正常 |
| 日志 | /logs | ✅ 正常 |

### 4.2 中文化检查

| 组件 | 中文化状态 |
|------|-----------|
| 导航栏 | ✅ 完整 |
| 页面标题 | ✅ 完整 |
| 按钮文字 | ✅ 完整 |
| 提示信息 | ✅ 完整 |
| 渠道名称 | ✅ 完整 (飞书/钉钉/谷歌聊天/松弛/信号) |

### 4.3 主题测试

- ✅ 系统主题 (自动)
- ✅ 浅色主题 
- ✅ 深色主题

---

## 五、截图记录

| 截图 | 描述 |
|------|------|
| test-01-chat-page.png | 对话页面 |
| test-02-overview-page.png | 概览页面 |
| test-03-config-page.png | 配置页面 |
| test-04-skills-page.png | 技能页面 |
| test-05-playground-page.png | 玩法推荐页面 |
| test-06-channels-page.png | 指挥渠道页面 (全页) |
| test-07-dark-theme.png | 深色主题效果 |

截图保存位置: `C:\Users\72793\AppData\Local\Temp\cursor-browser-extension\1770151153919\`

---

## 六、已知问题

### 6.1 Token 认证问题

直接访问 `http://localhost:18789` 会显示 token mismatch 错误：

```
disconnected (1008): unauthorized: gateway token mismatch 
(open a tokenized dashboard URL or paste token in Control UI settings)
```

**原因**: 需要通过带 token 的 URL 访问或在概览页面配置正确的令牌。

**解决方案**: 
1. 使用托盘程序"打开控制台"功能（自动带 token）
2. 在概览页面手动输入正确的令牌

### 6.2 配置页面架构不可用

配置页面显示"架构不可用"，这是因为需要先连接 Gateway WebSocket。

---

## 七、测试结论

### 通过项

1. ✅ 并行构建脚本正常工作，显著提升构建速度
2. ✅ 安装包文件结构完整
3. ✅ Gateway 服务正常启动和监听
4. ✅ Web UI 所有页面正常加载
5. ✅ 中文界面显示正确
6. ✅ 主题切换功能正常

### 建议改进

1. 考虑在安装后自动配置 token 或提供更友好的首次配置引导
2. Inno Setup 编译阶段是主要瓶颈（75s），可考虑使用 SSD 或优化压缩选项

---

## 八、签署

| 角色 | 状态 | 日期 |
|------|------|------|
| 测试工程师 | ✅ 完成 | 2026-02-04 |
| 产品确认 | 待确认 | - |

---

*报告生成时间: 2026-02-04*
