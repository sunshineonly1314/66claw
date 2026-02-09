# ClawdSkillsProxy 新增二进制托管端点需求

> 提交日期: 2026-02-08
> 优先级: P1
> 服务器: 121.43.61.90 (Java 服务 + Nginx 网关)

---

## 一、背景

ClawdBot 客户端安装技能时需要下载工具二进制文件。这些文件托管在 GitHub Release，中国用户无法直接访问。

**现有已部署端点（正常运行中）：**

| 端点 | 工具 | 状态 |
|------|------|------|
| `/api/binaries/signal-cli` | signal-cli | 已部署 |
| `/api/binaries/sherpa-onnx` | sherpa-onnx TTS | 代码已加，服务器待部署 |
| `/api/binaries/ffmpeg` | ffmpeg | 代码已加，服务器待部署 |

**本次新增 5 个端点：**

| 端点 | 工具 | 说明 | 优先级 |
|------|------|------|--------|
| `/api/binaries/gh` | GitHub CLI | 13 MB/平台 | P1 |
| `/api/binaries/himalaya` | himalaya 邮件 | 10-13 MB/平台 | P1 |
| `/api/binaries/yt-dlp` | yt-dlp 视频下载 | 17-35 MB/平台 | P1 |
| `/api/binaries/uv` | uv Python 包管理 | 18-21 MB/平台 | P0 (影响 16 个技能) |
| `/api/binaries/rclone` | rclone 云存储 | 27-30 MB/平台 | P2 |

---

## 二、接口规范

### 2.1 URL 格式

```
GET /api/binaries/{tool}/{platform}/{filename}
```

**示例：**
```
GET /api/binaries/gh/windows-x64/gh_2.86.0_windows_amd64.zip
GET /api/binaries/uv/darwin-universal/uv-aarch64-apple-darwin.tar.gz
GET /api/binaries/yt-dlp/linux-x64/yt-dlp_linux
```

### 2.2 平台参数（platform）

客户端发送的 platform 值由以下逻辑决定（`skills-install.ts:866`）：

```
process.platform === "win32"  → "windows-x64"
process.platform === "darwin" → "darwin-universal"
其他                          → "linux-x64"
```

**建议服务端支持的 platform 目录：**

| platform 值 | 说明 | 备注 |
|-------------|------|------|
| `windows-x64` | Windows 64 位 | 必须 |
| `darwin-universal` | macOS (通用) | 必须 |
| `linux-x64` | Linux 64 位 | 必须 |

> **注意**: 客户端 macOS 统一发送 `darwin-universal`，服务端可以存放 arm64 或 x64 版本，客户端会自动适配。如果要区分 arm64/x64，可以把两个版本都放到 `darwin-universal/` 目录下，客户端通过文件名区分。

### 2.3 认证

```
Authorization: Bearer clawdbotCN778
```

与现有 signal-cli 端点保持一致。如果 Nginx 层已有统一鉴权，新端点走同样的规则即可。

### 2.4 响应

- **成功**: HTTP 200，`Content-Type: application/octet-stream`，返回文件内容
- **文件不存在**: HTTP 404
- **未认证**: HTTP 401

建议响应头带上：
```
Content-Length: {文件字节数}
Content-Disposition: attachment; filename="{原始文件名}"
Accept-Ranges: bytes
```

如果文件较大（>50 MB），建议支持 `Range` 请求以支持断点续传。

---

## 三、文件存储结构

### 3.1 推荐的服务器目录结构

```
/data/binaries/
├── gh/
│   ├── windows-x64/
│   │   └── gh_2.86.0_windows_amd64.zip          (13.2 MB)
│   ├── darwin-universal/
│   │   ├── gh_2.86.0_macOS_amd64.zip            (13.5 MB)
│   │   └── gh_2.86.0_macOS_arm64.zip            (12.4 MB)
│   └── linux-x64/
│       └── gh_2.86.0_linux_amd64.tar.gz         (13.0 MB)
│
├── himalaya/
│   ├── windows-x64/
│   │   └── himalaya.x86_64-windows.tgz          (12.8 MB)
│   ├── darwin-universal/
│   │   ├── himalaya.x86_64-darwin.tgz           (9.3 MB)
│   │   └── himalaya.aarch64-darwin.tgz          (9.0 MB)
│   └── linux-x64/
│       └── himalaya.x86_64-linux.tgz            (10.1 MB)
│
├── yt-dlp/
│   ├── windows-x64/
│   │   └── yt-dlp.exe                           (17.5 MB)
│   ├── darwin-universal/
│   │   └── yt-dlp_macos                         (35.1 MB)
│   └── linux-x64/
│       └── yt-dlp_linux                         (34.3 MB)
│
├── uv/
│   ├── windows-x64/
│   │   └── uv-x86_64-pc-windows-msvc.zip        (20.8 MB)
│   ├── darwin-universal/
│   │   ├── uv-x86_64-apple-darwin.tar.gz        (19.6 MB)
│   │   └── uv-aarch64-apple-darwin.tar.gz       (18.2 MB)
│   └── linux-x64/
│       └── uv-x86_64-unknown-linux-musl.tar.gz  (21.4 MB)
│
├── rclone/
│   ├── windows-x64/
│   │   └── rclone-v1.73.0-windows-amd64.zip     (26.8 MB)
│   ├── darwin-universal/
│   │   ├── rclone-v1.73.0-osx-amd64.zip         (29.9 MB)
│   │   └── rclone-v1.73.0-osx-arm64.zip         (27.9 MB)
│   └── linux-x64/
│       └── rclone-v1.73.0-linux-amd64.zip        (26.8 MB)
│
├── ffmpeg/          ← 已在 cn-mirrors.ts 中配置，待上传文件
│   ├── windows-x64/
│   │   └── ffmpeg-master-latest-win64-gpl-shared.zip    (90.6 MB)
│   └── linux-x64/
│       └── ffmpeg-master-latest-linux64-gpl-shared.tar.xz (63.3 MB)
│
└── sherpa-onnx/     ← 已在 cn-mirrors.ts 中配置，待上传文件
    ├── windows-x64/
    ├── darwin-universal/
    └── linux-x64/
```

### 3.2 磁盘空间需求

| 工具 | 文件数 | 总大小 |
|------|--------|--------|
| gh | 4 | 52.1 MB |
| himalaya | 4 | 41.2 MB |
| yt-dlp | 3 | 86.9 MB |
| uv | 4 | 80.0 MB |
| rclone | 4 | 111.4 MB |
| ffmpeg | 2 | 153.9 MB |
| sherpa-onnx | ~6 | ~175 MB (估计) |
| **合计** | **~27** | **~700 MB** |

---

## 四、实现方案建议

### 方案 A: Nginx 静态文件（推荐，最简单）

直接用 Nginx 提供静态文件服务，不经过 Java 应用：

```nginx
# /etc/nginx/conf.d/binaries.conf

location /api/binaries/ {
    # 鉴权（与现有端点一致）
    if ($http_authorization != "Bearer clawdbotCN778") {
        return 401;
    }

    # 静态文件根目录
    alias /data/binaries/;

    # 自动 MIME 类型
    default_type application/octet-stream;

    # 支持大文件传输
    sendfile on;
    tcp_nopush on;

    # 支持断点续传
    max_ranges 1;

    # 缓存控制
    add_header Cache-Control "public, max-age=86400";
    add_header X-Content-Type-Options nosniff;
}
```

**优点**: 零 Java 代码改动，Nginx 直接出文件，性能最好
**操作**: 只需 `nginx -s reload`

### 方案 B: Java 服务代理

如果需要通过 Java 服务处理（统计、日志等）：

```java
// 伪代码
@GetMapping("/api/binaries/{tool}/{platform}/{filename}")
public ResponseEntity<Resource> downloadBinary(
    @PathVariable String tool,
    @PathVariable String platform,
    @PathVariable String filename,
    @RequestHeader("Authorization") String auth
) {
    // 1. 验证 token
    if (!"Bearer clawdbotCN778".equals(auth)) {
        return ResponseEntity.status(401).build();
    }

    // 2. 安全检查：防止路径穿越
    if (tool.contains("..") || platform.contains("..") || filename.contains("..")) {
        return ResponseEntity.badRequest().build();
    }

    // 3. 查找文件
    Path filePath = Paths.get("/data/binaries", tool, platform, filename);
    if (!Files.exists(filePath)) {
        return ResponseEntity.notFound().build();
    }

    // 4. 返回文件流
    Resource resource = new FileSystemResource(filePath);
    return ResponseEntity.ok()
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .contentLength(Files.size(filePath))
        .header("Content-Disposition", "attachment; filename=\"" + filename + "\"")
        .body(resource);
}
```

### 方案 C: Nginx 转发到 Java（混合）

Nginx 对 `/api/binaries/` 路径优先尝试静态文件，找不到再 fallback 到 Java：

```nginx
location /api/binaries/ {
    if ($http_authorization != "Bearer clawdbotCN778") {
        return 401;
    }

    # 优先静态文件
    root /data;
    try_files $uri @java_backend;
}

location @java_backend {
    proxy_pass http://127.0.0.1:8080;
}
```

---

## 五、文件上传流程

### 5.1 文件已在本地准备好

所有二进制文件已下载到开发机：

```
d:\codeknowledge\clawdbot-main\clawdbot-main\build\download-output\proxy-binaries\
├── gh\         (4 文件, 52 MB)
├── himalaya\   (4 文件, 41 MB)
├── yt-dlp\     (3 文件, 87 MB)
├── uv\         (4 文件, 80 MB)
├── rclone\     (4 文件, 111 MB)
└── ffmpeg\     (2 文件, 154 MB)
```

### 5.2 上传到服务器

```bash
# 1. 创建目录结构
ssh root@121.43.61.90 "mkdir -p /data/binaries/{gh,himalaya,yt-dlp,uv,rclone,ffmpeg}/{windows-x64,darwin-universal,linux-x64}"

# 2. 上传文件（从本地 proxy-binaries/ 目录）
scp -r proxy-binaries/* root@121.43.61.90:/data/binaries/

# 3. 设置权限
ssh root@121.43.61.90 "chown -R www-data:www-data /data/binaries/ && chmod -R 644 /data/binaries/"
```

> **注意**: 文件总大小约 525 MB，上传时间取决于本机到服务器的带宽。

### 5.3 验证

```bash
# 验证文件存在
ssh root@121.43.61.90 "find /data/binaries -type f | sort"

# 测试端点
curl -H "Authorization: Bearer clawdbotCN778" \
  "http://121.43.61.90/api/binaries/gh/windows-x64/gh_2.86.0_windows_amd64.zip" \
  -o /dev/null -w "HTTP %{http_code}, Size: %{size_download}\n"

curl -H "Authorization: Bearer clawdbotCN778" \
  "http://121.43.61.90/api/binaries/uv/windows-x64/uv-x86_64-pc-windows-msvc.zip" \
  -o /dev/null -w "HTTP %{http_code}, Size: %{size_download}\n"
```

---

## 六、客户端调用流程说明

客户端请求链路：

```
1. 用户点击「安装技能」
2. 读取 SKILL.md 中的 download URL:
   https://github.com/cli/cli/releases/latest
3. skills-install.ts 检测到 URL 包含 "cli/cli" (在 LARGE_PACKAGE_PROXY_MAP 中)
4. 重写 URL:
   http://121.43.61.90/api/binaries/gh/windows-x64/gh_2.86.0_windows_amd64.zip
5. downloadFile() 发起 HTTP GET 下载
6. 解压到 ~/.clawdbot/bin/
```

**客户端代码位置**: `src/agents/skills-install.ts:857-874`

**平台映射逻辑** (L866-868):
```javascript
const platform = process.platform === "win32" ? "windows-x64"
  : process.platform === "darwin" ? "darwin-universal"
  : "linux-x64";
```

---

## 七、后续版本更新

工具版本更新时，只需：

1. 在有 GitHub 访问的机器上运行下载脚本：
   ```powershell
   .\build\scripts\windows\download-proxy-binaries.ps1
   ```

2. 将新版本文件 scp 到服务器对应目录

3. 删除旧版本文件（可选，看磁盘空间）

无需改客户端代码，因为客户端从 SKILL.md 的 `url` 字段提取文件名，服务端只要有对应文件即可。

---

## 八、时间评估

| 步骤 | 工作量 | 说明 |
|------|--------|------|
| Nginx 配置 (方案 A) | 10 分钟 | 加一段 location 配置 |
| 创建目录 + 上传文件 | 20 分钟 | scp ~525 MB |
| 验证 | 5 分钟 | curl 测试 5 个端点 |
| **合计** | **~35 分钟** | |

如果选方案 B (Java 服务)，需额外 1-2 小时编码 + 部署。
