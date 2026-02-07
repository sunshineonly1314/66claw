# 飞书插件依赖打包说明

> 更新时间: 2026-02-02
>
> 版本: 2026.2.2

---

## 一、新增依赖

飞书插件 (`extensions/feishu`) 新增了官方 SDK 依赖：

```json
{
  "dependencies": {
    "@larksuiteoapi/node-sdk": "^1.30.0",
    "zod": "^4.3.6"
  }
}
```

### SDK 说明

| 依赖包 | 大小 | 用途 |
|-------|------|------|
| `@larksuiteoapi/node-sdk` | ~2MB | 飞书官方 Node.js SDK，支持 WebSocket 长连接 |

---

## 二、已更新的打包文件

### 1. 插件 package.json

| 文件 | 状态 |
|------|------|
| `extensions/feishu/package.json` | ✅ 已更新 |
| `build/windows/deploy/extensions/feishu/package.json` | ✅ 已更新 |

### 2. 打包脚本

| 文件 | 变更 |
|------|------|
| `scripts/windows/build-offline-cn.ps1` | 添加 feishu SDK 安装检查 |
| `scripts/windows/build-windows.ps1` | 添加插件依赖自动安装 |
| `build/scripts/windows/build-full-package.ps1` | 添加扩展依赖安装步骤 |

### 3. 安装程序配置

| 文件 | 变更 |
|------|------|
| `scripts/windows/setup.iss` | 添加 feishu SDK 说明注释 |
| `scripts/windows/setup-online.iss` | 添加 feishu SDK 说明注释 |
| `scripts/windows/install-deps.bat` | 添加扩展依赖安装步骤 |

---

## 三、打包流程

### 离线版打包

```powershell
# 1. 构建项目
pnpm build

# 2. 安装扩展依赖
cd extensions/feishu
npm install --omit=dev

cd ../dingtalk
npm install --omit=dev

cd ../wecom
npm install --omit=dev

# 3. 运行打包脚本
cd scripts/windows
.\build-offline-cn.ps1
```

### 在线版打包

```powershell
# 在线版不包含 node_modules
# install-deps.bat 会在安装时自动下载依赖
.\build-full-package.ps1 -OnlineOnly
```

---

## 四、验证清单

打包完成后，请检查：

### 离线版 (ClawdbotCN-Setup-xxx-x64.exe)

- [ ] `extensions/feishu/node_modules/@larksuiteoapi/node-sdk` 存在
- [ ] 安装后飞书 WebSocket 模式可用
- [ ] 安装包大小约 105-110MB

### 在线版 (ClawdbotCN-Setup-xxx-x64-online.exe)

- [ ] 安装时 `install-deps.bat` 正确执行
- [ ] 控制台显示 "Installing Feishu dependencies..."
- [ ] 安装完成后 `extensions/feishu/node_modules` 存在

---

## 五、常见问题

### Q: 打包后飞书 WebSocket 模式不工作

检查 `extensions/feishu/node_modules/@larksuiteoapi/node-sdk` 是否存在。

如果不存在，手动安装：

```bash
cd extensions/feishu
npm install --omit=dev
```

### Q: 安装包体积增大

`@larksuiteoapi/node-sdk` 约 2MB，会增加安装包体积。这是正常的。

### Q: 在线安装时依赖下载失败

检查网络连接，或尝试切换镜像：

```bash
npm config set registry https://registry.npmmirror.com
# 或
npm config set registry https://mirrors.cloud.tencent.com/npm
```

---

## 六、相关文件清单

```
extensions/feishu/
├── package.json              # 新增 @larksuiteoapi/node-sdk
├── src/
│   ├── client.ts            # 新增：官方 SDK 客户端
│   ├── media.ts             # 新增：媒体上传下载
│   ├── mention.ts           # 新增：@ 提及处理
│   ├── monitor.ts           # 新增：WebSocket 监控
│   ├── targets.ts           # 新增：目标地址处理
│   ├── api.ts               # 更新：使用官方 SDK
│   ├── channel.ts           # 更新：集成新功能
│   ├── config-schema.ts     # 更新：新配置项
│   ├── types.ts             # 更新：新类型定义
│   └── ...
├── FEISHU-CONFIG.md         # 新增：配置文档
└── node_modules/            # 打包时需要包含
    └── @larksuiteoapi/
        └── node-sdk/
```
