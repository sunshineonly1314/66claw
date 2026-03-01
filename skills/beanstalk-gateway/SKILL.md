---
name: beanstalk-gateway
description: 将本地 Clawdbot 连接到 [beans.talk](https://beans.talk)，实现远程监控与控制。
description_zh: 将本地 Clawdbot 连接到 [beans.talk](https://beans.talk)，实现远程监控与控制。
---
# Beanstalk 网关

将本地 Clawdbot 连接到 [beans.talk](https://beans.talk)，实现远程监控与控制。

## 安装

```bash
npm install -g beanstalk-gateway
```

## 配置

1. 访问 [beans.talk](https://beans.talk) 并点击“连接网关”
2. 复制配置命令
3. 在您的机器上运行该命令
4. 完成！

## 手动使用

```bash
# Configure
beanstalk-gateway configure --url wss://... --token gt_...

# Start
beanstalk-gateway start

# Check local Clawdbot status  
beanstalk-gateway status
```

## 更多信息

- [npm 包](https://www.npmjs.com/package/beanstalk-gateway)
- [GitHub](https://github.com/tommygeoco/beanstalk-gateway)