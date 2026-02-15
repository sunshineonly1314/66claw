# 功能归档：技术支持群二维码远程拉取 + 7 天缓存

> 日期：2026-02-08
> 状态：已完成（客户端对接完毕，服务端 API 已上线）
> 编译：TypeScript 无新增错误

---

## 一、功能概述

### 1.1 背景

OpenClawCN 需要在 UI 顶栏显示技术支持群二维码，用户鼠标悬浮即可扫码入群。这是核心商业转化入口。

**此前的问题**：

- 二维码仅来自本地文件（`{stateDir}/qrcodes/official/` 和 `test/`），需运维手动放置
- 内存缓存仅 5 分钟 TTL，没有持久化的过期管理
- 无法从服务端远程拉取最新二维码
- 二维码过期后用户看到的是旧图片，扫码无法入群
- 没有专门的预加载机制，用户可能 hover 时看不到二维码

### 1.2 解决方案

实现远程二维码拉取 + 7 天本地持久缓存 + chat 页面预加载机制：

- **远程拉取**：从 `POST /api/api/v1/support/qrcode` 获取最新二维码
- **7 天缓存**：本地磁盘持久存储，过期前不再拉取
- **304 支持**：通过 `currentVersion` 参数实现条件请求，版本未变时不传输大图片
- **预加载**：WebSocket 连接成功后自动触发，确保 hover 时立即可见
- **三级降级**：远程 API → 本地缓存 → 本地文件夹

---

## 二、服务端 API

### 接口地址

```
POST https://www.tecbinai.com/api/api/v1/support/qrcode
Content-Type: application/json
```

无需 HMAC 签名，直接 POST JSON。

### 请求

```json
{
  "key": "用户授权码",
  "deviceId": "设备ID",
  "keyType": "test | trial | standard",
  "currentVersion": "上次缓存的版本号（首次不传）"
}
```

### 响应 — 正常返回

```json
{
  "success": true,
  "data": {
    "base64": "data:image/png;base64,/9j/4QEi...",
    "groupName": "OpenClawCN 试用交流群 2",
    "version": "v20260208041336",
    "expiresAt": 1740000000000,
    "ttlSeconds": 86400
  }
}
```

- `expiresAt` 和 `ttlSeconds` 仅在服务端设置了过期时间时才返回，未设置时不存在
- `keyType` 决定分群：test/trial → 试用群，standard → 正式群
- 同一 `deviceId` 始终分配同一群码（SHA256 取模）

### 响应 — 304 未变更

```json
{
  "success": true,
  "notModified": true
}
```

### 响应 — 错误

```json
{
  "success": false,
  "error": "invalid key"
}
```

---

## 三、架构设计

### 3.1 数据流

```
WebSocket 连接成功 → onHello
    ↓
① license.status (已有)
    → enrichLicenseWithSupport() 注入本地文件二维码
    ↓
② support.qrcode.preload (新增，自动触发)
    ↓
┌─ 内存缓存有效?  → 直接返回
├─ 磁盘缓存有效?  → 加载到内存 → 返回
├─ 缓存过期?      → 返回过期数据 + 带 currentVersion 后台刷新
│                     服务端版本未变 → 304 → 延长本地缓存 7 天
│                     服务端版本已变 → 下载新图片 → 缓存到磁盘
├─ 无缓存?        → 同步拉取 POST /support/qrcode
│                     成功 → 缓存到磁盘+内存 → 返回
│                     失败 → 回退到本地文件夹
└─ 全部失败       → status: "failed"
    ↓
UI 更新 licenseState.license.supportQrcode
    ↓
用户 hover → 立即看到二维码（或加载动画）
```

### 3.2 缓存分层

| 层级 | 位置 | TTL | 说明 |
|------|------|-----|------|
| L1 | 内存变量 | 随进程 | 避免磁盘 IO |
| L2 | 磁盘文件 | 7 天（服务端可覆盖） | `{stateDir}/qrcodes/cache/metadata.json` + `qrcode.dat` |
| L3 | 远程 API | - | 过期时从服务端拉取 |
| 降级 | 本地文件夹 | 5 分钟 | 原有 `{stateDir}/qrcodes/official/` 机制 |

### 3.3 过期计算优先级

```
expiresAt（服务端 Unix ms） > ttlSeconds * 1000 > 默认 7 天
```

---

## 四、变更文件清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `src/license/support-qrcode-remote.ts` | 远程二维码拉取 + 7 天本地持久缓存核心模块 |
| `src/gateway/server-methods/support-qrcode.ts` | Gateway 方法：`support.qrcode.preload` + `support.qrcode.status` |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/license/index.ts` | 导出新模块的函数和类型 |
| `src/gateway/server-methods.ts` | 注册 `supportQrcodeHandlers` + 添加 READ 权限 |
| `src/gateway/server-methods-list.ts` | 注册方法名 `support.qrcode.preload`、`support.qrcode.status` |
| `ui/src/ui/app-gateway.ts` | 添加 `preloadQrcodeForChat()` 预加载函数，在 `loadLicenseStatus` 完成后触发 |
| `ui/src/ui/app-view-state.ts` | 添加 `qrcodePreloading`、`qrcodePreloaded`、`qrcodeExpiresAt` 状态字段 |
| `ui/src/ui/app.ts` | 添加 `@state()` 响应式属性声明 |
| `ui/src/ui/app-render.ts` | 抽取 `renderQrcodePopover()` 函数，支持加载态 spinner |
| `ui/src/styles/layout.css` | 添加 `.topbar-support__loading`、`.topbar-support__spinner` 动画样式 |
| `ui/src/ui/i18n/locales/zh-CN.ts` | 添加 `"support.loading": "二维码加载中..."` |
| `ui/src/ui/i18n/locales/en.ts` | 添加 `"support.loading": "Loading QR code..."` |

---

## 五、关键设计决策

### 5.1 为什么不合并到 license.status？

`license.status` 已经通过 `enrichLicenseWithSupport()` 注入本地文件二维码，这保证了即使远程 API 不可用也有降级方案。远程拉取作为独立的 `support.qrcode.preload` 方法，职责清晰：

- `license.status` → 快速返回，包含本地文件二维码（已有）
- `support.qrcode.preload` → 异步获取远程最新二维码（新增）

### 5.2 为什么用 304 机制？

二维码图片 base64 通常 50-200KB，7 天内频繁传输浪费带宽。通过 `currentVersion` 实现条件请求，版本未变时服务端只返回 `{ notModified: true }`（几十字节），客户端延长本地缓存即可。

### 5.3 并发防护

使用 `pendingFetch` 锁防止多个调用方同时触发远程拉取。第二个调用者会等待第一个完成后复用结果。

### 5.4 过期缓存降级

缓存过期时不阻塞 UI：先返回过期的二维码图片（用户仍可扫码尝试），同时后台静默刷新。只有完全无缓存时才同步等待。

---

## 六、测试要点

- [ ] 首次启动无缓存 → 同步拉取 → 显示二维码
- [ ] 缓存有效期内重启 → 从磁盘加载 → 不请求远程
- [ ] 缓存过期后启动 → 显示旧图 + 后台刷新
- [ ] 版本未变 → 304 → 延长 7 天
- [ ] 版本变更 → 下载新图 → 更新缓存
- [ ] 远程 API 不可用 → 降级到本地文件夹
- [ ] 无授权码 → 仅使用本地文件
- [ ] hover 交互 → 鼠标悬浮显示，移走消失
- [ ] 加载态 → 拉取中显示 spinner 动画
- [ ] 试用用户 → 显示"技术支持"+"升级正式版"
- [ ] 正式用户 → 显示"专属技术支持"
