# Release Notify API 接口规范

> 给 tecbinhome 服务端的需求文档

## 背景

ClawdbotCN 桌面应用同时支持 Windows 和 macOS。两个平台的 CI 各自构建、生成增量包并上传到 OSS，但 `latest.json`（客户端检查更新时读取的文件）需要包含**所有平台**的数据。

为了让两个平台可以并行上传不互相阻塞，采用以下方案：
1. 每个平台上传到 OSS 的**平台子目录**（如 `releases/2026.2.20/windows/`）
2. 每个平台上传完后调用服务端 API **通知合并**
3. 服务端从 OSS 读取各平台的 `platform-manifest.json`，合并生成最终 `latest.json`

## OSS 目录结构

```
releases/
├── latest.json                              ← 服务端合并生成
├── 2026.2.20/
│   ├── windows/
│   │   ├── platform-manifest.json           ← Windows CI 上传
│   │   ├── full.tar.gz
│   │   ├── full.tar.gz.sha256
│   │   ├── manifest.json
│   │   ├── checksums.json
│   │   └── delta-from-2026.2.19.tar.gz
│   ├── macos/
│   │   ├── platform-manifest.json           ← macOS CI 上传
│   │   ├── full.tar.gz
│   │   ├── full.tar.gz.sha256
│   │   ├── manifest.json
│   │   ├── checksums.json
│   │   └── delta-from-2026.2.19.tar.gz
│   └── installers/
│       ├── ClawdbotCN-Setup-2026.2.20-x64.exe    ← Windows CI 上传
│       └── ClawdbotCN-macOS-universal-2026.2.20.dmg  ← macOS CI 上传
```

## 新增 API

### `POST /api/v1/release/notify`

CI 上传完成后调用此接口，通知服务端合并 `latest.json`。

**请求体**:
```json
{
  "version": "2026.2.20",
  "platform": "windows",
  "ossDomain": "dl.obplugins.cn",
  "ossPrefix": "releases",
  "secret": "cicd-deploy-secret"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| version | string | 是 | 版本号 |
| platform | string | 是 | 构建平台: `windows` 或 `macos` |
| ossDomain | string | 是 | OSS 域名 |
| ossPrefix | string | 是 | OSS key 前缀（通常是 `releases`） |
| secret | string | 是 | 鉴权密钥（环境变量 `RELEASE_NOTIFY_SECRET`） |

**服务端处理逻辑**:

1. **验证 secret** — 与服务端配置的密钥比对
2. **从 OSS 读取该平台的 manifest** — `GET https://{ossDomain}/{ossPrefix}/{version}/{platform}/platform-manifest.json`
3. **扫描其他平台** — 尝试读取 `releases/{version}/windows/platform-manifest.json` 和 `releases/{version}/macos/platform-manifest.json`
4. **合并生成 latest.json** — 参见下面的合并逻辑
5. **上传 latest.json** — `PUT` 到 OSS `releases/latest.json`

**成功响应** (200):
```json
{
  "ok": true,
  "mergedPlatforms": ["windows", "macos"],
  "latestJsonUrl": "https://dl.obplugins.cn/releases/latest.json"
}
```

**失败响应** (4xx/5xx):
```json
{
  "ok": false,
  "error": "错误描述"
}
```

## latest.json 合并逻辑

### platform-manifest.json 格式（每个平台各自生成）

```json
{
  "platform": "windows",
  "version": "2026.2.20",
  "buildTime": "2026-02-19T10:00:00.000Z",
  "gitCommit": "abc1234",
  "nodeVersion": "v22.14.0",
  "url": {
    "full": "https://dl.obplugins.cn/releases/2026.2.20/windows/full.tar.gz",
    "manifest": "https://dl.obplugins.cn/releases/2026.2.20/windows/manifest.json",
    "checksums": "https://dl.obplugins.cn/releases/2026.2.20/windows/checksums.json"
  },
  "deltas": [
    {
      "from": "2026.2.19",
      "url": "https://dl.obplugins.cn/releases/2026.2.20/windows/delta-from-2026.2.19.tar.gz",
      "size": 1234567,
      "sha256": "abc123..."
    }
  ],
  "fullSize": 98765432,
  "fullSha256": "def456...",
  "installers": {
    "windows-nsis": {
      "url": "https://dl.obplugins.cn/releases/2026.2.20/installers/ClawdbotCN-Setup-2026.2.20-x64.exe",
      "size": 123456789,
      "sha256": "...",
      "filename": "ClawdbotCN-Setup-2026.2.20-x64.exe"
    }
  },
  "changelog": {
    "zh-CN": "## v2026.2.20\n- 新增功能...",
    "en-US": "## v2026.2.20\n- New feature..."
  }
}
```

### 合并后的 latest.json 格式

```json
{
  "version": "2026.2.20",
  "buildTime": "2026-02-19T10:00:00.000Z",
  "gitCommit": "abc1234",
  "nodeVersion": "v22.14.0",
  "platforms": {
    "windows": {
      "url": {
        "full": "https://dl.obplugins.cn/releases/2026.2.20/windows/full.tar.gz",
        "manifest": "https://dl.obplugins.cn/releases/2026.2.20/windows/manifest.json",
        "checksums": "https://dl.obplugins.cn/releases/2026.2.20/windows/checksums.json"
      },
      "deltas": [
        {
          "from": "2026.2.19",
          "url": "https://dl.obplugins.cn/releases/2026.2.20/windows/delta-from-2026.2.19.tar.gz",
          "size": 1234567,
          "sha256": "abc123..."
        }
      ],
      "fullSize": 98765432,
      "fullSha256": "def456..."
    },
    "macos": {
      "url": {
        "full": "https://dl.obplugins.cn/releases/2026.2.20/macos/full.tar.gz",
        "manifest": "https://dl.obplugins.cn/releases/2026.2.20/macos/manifest.json",
        "checksums": "https://dl.obplugins.cn/releases/2026.2.20/macos/checksums.json"
      },
      "deltas": [
        {
          "from": "2026.2.19",
          "url": "https://dl.obplugins.cn/releases/2026.2.20/macos/delta-from-2026.2.19.tar.gz",
          "size": 2345678,
          "sha256": "ghi789..."
        }
      ],
      "fullSize": 87654321,
      "fullSha256": "jkl012..."
    }
  },
  "installers": {
    "windows-nsis": {
      "url": "https://dl.obplugins.cn/releases/2026.2.20/installers/ClawdbotCN-Setup-2026.2.20-x64.exe",
      "size": 123456789,
      "sha256": "...",
      "filename": "ClawdbotCN-Setup-2026.2.20-x64.exe"
    },
    "macos": {
      "url": "https://dl.obplugins.cn/releases/2026.2.20/installers/ClawdbotCN-macOS-universal-2026.2.20.dmg",
      "size": 234567890,
      "sha256": "...",
      "filename": "ClawdbotCN-macOS-universal-2026.2.20.dmg"
    }
  },
  "changelog": {
    "zh-CN": "## v2026.2.20\n- 新增功能...",
    "en-US": "## v2026.2.20\n- New feature..."
  }
}
```

### 合并伪代码

```python
def handle_release_notify(request):
    # 1. 验证
    if request.secret != CONFIG.release_notify_secret:
        return {"ok": False, "error": "invalid secret"}, 403

    version = request.version
    platforms = ["windows", "macos"]
    merged_platforms = []
    all_installers = {}
    platform_data = {}
    meta = {}  # buildTime, gitCommit, nodeVersion, changelog

    # 2. 扫描各平台 manifest
    for plat in platforms:
        url = f"https://{request.ossDomain}/{request.ossPrefix}/{version}/{plat}/platform-manifest.json"
        try:
            manifest = http_get_json(url)
        except:
            continue  # 该平台还没上传

        merged_platforms.append(plat)

        # 提取平台更新数据
        platform_data[plat] = {
            "url": manifest["url"],
            "deltas": manifest["deltas"],
            "fullSize": manifest["fullSize"],
            "fullSha256": manifest["fullSha256"],
        }

        # 合并 installers（各平台可能贡献不同的安装包）
        all_installers.update(manifest.get("installers", {}))

        # 取最新的 meta 信息
        meta = {
            "buildTime": manifest["buildTime"],
            "gitCommit": manifest["gitCommit"],
            "nodeVersion": manifest["nodeVersion"],
            "changelog": manifest["changelog"],
        }

    if not merged_platforms:
        return {"ok": False, "error": "no platform manifest found"}, 404

    # 3. 生成合并后的 latest.json
    latest = {
        "version": version,
        "buildTime": meta["buildTime"],
        "gitCommit": meta["gitCommit"],
        "nodeVersion": meta["nodeVersion"],
        "platforms": platform_data,
        "installers": all_installers,
        "changelog": meta["changelog"],
    }

    # 4. 上传到 OSS
    oss_put(f"{request.ossPrefix}/latest.json", json.dumps(latest))

    return {
        "ok": True,
        "mergedPlatforms": merged_platforms,
        "latestJsonUrl": f"https://{request.ossDomain}/{request.ossPrefix}/latest.json",
    }
```

## 环境变量

服务端需要配置：
- `RELEASE_NOTIFY_SECRET` — 通知 API 鉴权密钥
- `OSS_ACCESS_KEY_ID` — 用于读写 OSS
- `OSS_ACCESS_KEY_SECRET`
- `OSS_BUCKET` — 默认 `chuhai-tecbin`
- `OSS_REGION` — 默认 `oss-cn-hangzhou`

## 时序图

```
Windows CI                    OSS                      服务端                    macOS CI
    |                          |                         |                         |
    |-- 上传 windows/ 目录 --->|                         |                         |
    |-- 上传 installers/ ---->|                         |                         |
    |                          |                         |                         |
    |-- POST /release/notify --|----------------------->|                         |
    |                          |                         |-- GET windows/pm.json ->|
    |                          |                         |-- GET macos/pm.json --->| (可能 404)
    |                          |                         |                         |
    |                          |<-- PUT latest.json -----|                         |
    |<-- 200 OK (merged: [windows]) ---|                 |                         |
    |                          |                         |                         |
    |                          |                         |                         |
    |                          |<----- 上传 macos/ 目录 -|-------------------------|
    |                          |<----- 上传 installers/ -|-------------------------|
    |                          |                         |                         |
    |                          |                         |<-- POST /release/notify-|
    |                          |<-- GET windows/pm.json -|                         |
    |                          |<-- GET macos/pm.json ---|                         |
    |                          |<-- PUT latest.json -----|                         |
    |                          |                         |--- 200 OK (merged: [windows, macos])
```

先完成上传的平台生成的 `latest.json` 只包含一个平台的数据。后完成的平台会触发重新合并，`latest.json` 更新为包含两个平台的完整数据。客户端始终能获取到至少一个平台的更新信息。
