# ClawdSkillsProxy 二进制托管对接文档

> 更新时间: 2026-02-02
> 
> 状态: 待后端部署

---

## 一、概述

### 需要托管的内容

| 类型 | 状态 | 说明 |
|------|------|------|
| Signal CLI | ✅ 需要 | 国内用户无法访问 GitHub |
| 能力包 | ❌ 暂不需要 | 功能未上线，后续再添加 |

---

## 二、Signal CLI 托管

### 1. 下载地址

**GitHub Releases**: https://github.com/AsamK/signal-cli/releases

### 2. v0.13.4 版本下载链接

| 平台 | 文件名 | 下载链接 | 大小 |
|------|--------|----------|------|
| Linux | `signal-cli-0.13.4-Linux.tar.gz` | https://github.com/AsamK/signal-cli/releases/download/v0.13.4/signal-cli-0.13.4-Linux.tar.gz | ~50MB |
| macOS | `signal-cli-0.13.4.tar.gz` | https://github.com/AsamK/signal-cli/releases/download/v0.13.4/signal-cli-0.13.4.tar.gz | ~50MB |

### 3. 上传到服务器后的路径

```
/api/binaries/signal-cli/0.13.4/signal-cli-0.13.4-Linux.tar.gz
/api/binaries/signal-cli/0.13.4/signal-cli-0.13.4.tar.gz
```

### 4. 版本更新通知

新版本发布时我们会通知更新。当前最新稳定版是 v0.13.4。

---

## 三、能力包说明

### 为什么暂不需要？

| 文件 | 状态 | 原因 |
|------|------|------|
| `browser-pack.zip` | ❌ 未构建 | 功能在规划中，代码未完成 |
| `files-pack.zip` | ❌ 未构建 | 功能在规划中，代码未完成 |
| `notes-pack.zip` | ❌ 未构建 | 功能在规划中，代码未完成 |
| `image-pack.zip` | ❌ 未构建 | 功能在规划中，代码未完成 |
| `smarthome-pack.zip` | ❌ 未构建 | 功能在规划中，代码未完成 |
| `openclawcn-wsl-latest.tar.gz` | ❌ 暂不需要 | Windows 原生版不使用 WSL |

### 对用户的影响

**无影响**。能力包功能尚未上线，用户目前不会用到这些文件。

Windows 原生离线版打包时：
- ✅ Skills 安装：使用 ClawdSkillsProxy（已支持）
- ✅ npm 依赖：预打包到安装包中
- ✅ Node.js：预打包到安装包中
- ❌ 能力包：功能未上线，不打包

### 后续计划

能力包功能开发完成后，我们会：
1. 构建能力包文件
2. 提供给你们上传
3. 前端代码已预留接口，无需修改

---

## 四、API 接口确认

### 认证方式

```
Authorization: Bearer openclawcnCN778
```

### Signal CLI 接口 ✅ 需要实现

#### 获取最新版本

```http
GET http://121.43.61.90/api/binaries/signal-cli/latest
Authorization: Bearer openclawcnCN778
```

响应：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "tagName": "v0.13.4",
    "version": "0.13.4",
    "publishedAt": "2024-01-15T12:00:00Z",
    "assets": [
      {
        "name": "signal-cli-0.13.4-Linux.tar.gz",
        "size": 52428800,
        "downloadUrl": "/api/binaries/signal-cli/0.13.4/signal-cli-0.13.4-Linux.tar.gz"
      },
      {
        "name": "signal-cli-0.13.4.tar.gz",
        "size": 52428800,
        "downloadUrl": "/api/binaries/signal-cli/0.13.4/signal-cli-0.13.4.tar.gz"
      }
    ]
  }
}
```

#### 下载文件

```http
GET http://121.43.61.90/api/binaries/signal-cli/{version}/{filename}
Authorization: Bearer openclawcnCN778
```

示例：
```
GET http://121.43.61.90/api/binaries/signal-cli/0.13.4/signal-cli-0.13.4-Linux.tar.gz
```

### 能力包接口 ⏸️ 暂缓实现

可以先返回空列表或 404，等功能上线后再补充。

```http
GET http://121.43.61.90/api/capabilities
Authorization: Bearer openclawcnCN778
```

建议响应：
```json
{
  "code": 200,
  "message": "success",
  "data": []
}
```

---

## 五、前端代码配置

已更新完成，无需修改。

```typescript
// src/config/cn-mirrors.ts
export const CLAWDSKILLSPROXY_CONFIG = {
  baseUrl: "http://121.43.61.90",
  token: "openclawcnCN778",
  endpoints: {
    skills: "/api/skills/index",
    signalCliLatest: "/api/binaries/signal-cli/latest",
    signalCliDownload: "/api/binaries/signal-cli",
    signalCliVersions: "/api/binaries/signal-cli/versions",
    capabilities: "/api/capabilities",
    capabilitiesWsl: "/api/capabilities/wsl",
  },
} as const;
```

---

## 六、测试命令

部署后测试：

```powershell
# 测试 Signal CLI 版本接口
Invoke-RestMethod -Uri "http://121.43.61.90/api/binaries/signal-cli/latest" `
  -Headers @{ Authorization = "Bearer openclawcnCN778" }

# 测试 Signal CLI 下载
Invoke-WebRequest -Uri "http://121.43.61.90/api/binaries/signal-cli/0.13.4/signal-cli-0.13.4-Linux.tar.gz" `
  -Headers @{ Authorization = "Bearer openclawcnCN778" } `
  -OutFile "signal-cli.tar.gz"
```

---

## 七、部署清单

- [ ] 下载 Signal CLI v0.13.4 两个文件
- [ ] 上传到服务器
- [ ] 部署 Signal CLI 接口
- [ ] 测试验证
- [ ] 通知前端联调

---

## 八、联系方式

有问题随时沟通。
