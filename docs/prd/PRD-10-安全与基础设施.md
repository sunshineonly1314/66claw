# PRD-10: 安全与基础设施

## 1. 安全基础设施

### 1.1 SSRF 防护 (src/infra/net/ssrf.ts)

- URL 验证与过滤
- 内网地址阻断
- 白名单机制
- DNS 重绑定防护

### 1.2 授权认证

- Bearer Token 认证
- HMAC 请求签名
- RSA 响应签名验证
- 设备指纹识别

### 1.3 输入验证

- Zod Schema 验证
- 路径遍历防护
- XSS 防护（DOMPurify）
- SQL 注入防护（无 SQL 数据库）

### 1.4 安全配置

```json
{
  "security": {
    "mode": "standard",
    "allowedHosts": [],
    "enableExecApproval": true
  }
}
```

## 2. 更新检查 (src/infra/update-check.ts)

- 定期检查新版本
- 版本比较
- 更新通知
- 强制更新支持

## 3. 媒体处理

### 3.1 媒体获取 (src/media/fetch.ts)

- 远程媒体下载
- 文件类型检测
- 大小限制
- 超时控制

### 3.2 媒体理解 (src/media-understanding/)

- 图片理解（视觉模型）
- 文档解析（PDF, DOCX）
- 音频转文字
- 视频帧提取

### 3.3 链接理解 (src/link-understanding/)

- URL 内容提取
- 网页摘要
- 元数据获取

## 4. 语音合成 (src/tts/)

- Edge TTS 引擎
- 多语言支持
- 语音选择
- 缓存机制

## 5. 进程管理 (src/process/)

### 5.1 执行器 (exec.ts)

- 子进程执行
- 超时控制
- 输出捕获
- 进程树终止

### 5.2 守护进程 (src/daemon/)

- 后台运行
- PID 文件管理
- 日志重定向
- 信号处理

## 6. 日志系统 (src/logging/)

- tslog 集成
- 子系统日志
- 日志级别控制
- 结构化日志

## 7. 定时任务 (src/cron/)

- croner 集成
- 定时发送消息
- 健康检查定时器
- 配置驱动

## 8. 路由系统 (src/routing/)

- 消息路由规则
- 允许列表管理
- 群组激活检测
- 回复目标解析

## 9. 内存管理 (src/memory/)

- 会话记忆
- 上下文窗口管理
- 记忆持久化
- 记忆清理

## 10. 构建与部署

### 10.1 Windows 构建

- Inno Setup 安装程序 (scripts/windows/setup.iss)
- 托盘应用 (OpenClawCNTray.ps1)
- 看门狗 (OpenClawCNWatchdog.ps1)
- 服务脚本

### 10.2 macOS 构建

- Swift UI 菜单栏应用
- 代码签名与公证
- Universal Binary 支持
- LaunchAgent 集成

### 10.3 Docker 部署

- docker-compose.yml 配置
- 沙箱容器构建
- 网络配置
- 持久化存储

### 10.4 CI/CD

- GitHub Actions
- 自动测试（Vitest）
- Lint 检查（oxlint）
- Docker 构建测试
- 安装烟雾测试

## 11. 非功能性需求

### 11.1 安全性
- 零信任原则
- 最小权限
- 加密传输
- 审计日志

### 11.2 可观测性
- 结构化日志
- 健康检查
- 状态探测
- 使用统计

### 11.3 可靠性
- 守护进程看门狗
- 自动重启
- 数据持久化
- 备份策略
