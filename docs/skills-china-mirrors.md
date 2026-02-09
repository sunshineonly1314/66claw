# Skills 中国镜像与依赖管理方案

> 最后更新: 2026-02-08 | 实测环境: 华北地区

---

## 一、镜像源测速排名（3 源回退）

每种依赖类型配置 3 个镜像，按速度从快到慢排序。下载失败自动切换下一个。

### Go 模块 (`go install`)

| 优先级 | 镜像 | URL | 延迟 | 状态 |
|--------|------|-----|------|------|
| 1 | 七牛 goproxy.cn | `https://goproxy.cn` | 0.46s | 200 OK |
| 2 | goproxy.io | `https://goproxy.io` | 0.58s | 200 OK |
| 3 | proxy.golang.com.cn | `https://proxy.golang.com.cn` | 0.73s | 200 OK |

**使用方式**: 安装时设置 `GOPROXY=https://goproxy.cn,https://goproxy.io,https://proxy.golang.com.cn,direct`

### npm 包 (`npm install -g`)

| 优先级 | 镜像 | Registry URL | 延迟 | 状态 |
|--------|------|-------------|------|------|
| 1 | 淘宝 npmmirror | `https://registry.npmmirror.com` | 0.19s | 200 OK |
| 2 | 腾讯云 | `https://mirrors.cloud.tencent.com/npm/` | 0.66s | 200 OK |
| 3 | 华为云 | `https://mirrors.huaweicloud.com/repository/npm/` | 4.0s | 200 OK |

**使用方式**: `npm install --registry=https://registry.npmmirror.com`

### PyPI 包 (`uv pip install` / `pip install`)

| 优先级 | 镜像 | URL | 延迟 | 状态 |
|--------|------|-----|------|------|
| 1 | 中科大 USTC | `https://pypi.mirrors.ustc.edu.cn/simple/` | 0.06s | 301 OK |
| 2 | 阿里云 | `https://mirrors.aliyun.com/pypi/simple/` | 0.12s | 200 OK |
| 3 | 清华 TUNA | `https://pypi.tuna.tsinghua.edu.cn/simple/` | 0.21s | 200 OK |

**使用方式**: `pip install -i https://pypi.mirrors.ustc.edu.cn/simple/ --trusted-host pypi.mirrors.ustc.edu.cn`

### Homebrew Bottles (macOS)

| 优先级 | 镜像 | URL | 延迟 | 状态 |
|--------|------|-----|------|------|
| 1 | 阿里云 | `https://mirrors.aliyun.com/homebrew/homebrew-bottles/` | 0.04s | 200 OK |
| 2 | 中科大 USTC | `https://mirrors.ustc.edu.cn/homebrew-bottles/` | 0.16s | 200 OK |
| 3 | 清华 TUNA | `https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/` | 1.33s | 200 OK |

**使用方式**: `export HOMEBREW_BOTTLE_DOMAIN=https://mirrors.aliyun.com/homebrew/homebrew-bottles`

**注意**: `steipete/tap` 的自定义 formula 不走 bottles，需要 GitHub Release 代理或自建。

### GitHub Release 代理（二进制下载）

| 优先级 | 镜像 | URL 模式 | 延迟 | 状态 |
|--------|------|---------|------|------|
| 1 | gh-proxy.com | `https://gh-proxy.com/{github_url}` | 0.69s | 200 OK |
| 2 | ghfast.top | `https://ghfast.top/{github_url}` | 1.05s | 200 OK |
| 3 | ghproxy.net | `https://ghproxy.net/{github_url}` | 1.94s | 200 OK |

**使用方式**: 替换 `https://github.com/` 为 `https://gh-proxy.com/https://github.com/`

---

## 二、Skills 依赖分类

### 按安装方式分类

#### Brew (steipete/tap) — 需 GitHub 代理或自建镜像
| Skill | Formula | 二进制名 | OS |
|-------|---------|---------|-----|
| gog | steipete/tap/gogcli | gog | macOS |
| summarize | steipete/tap/summarize | summarize | macOS |
| camsnap | steipete/tap/camsnap | camsnap | 全平台 |
| sag | steipete/tap/sag | sag | 全平台 |
| openhue | steipete/tap/openhue | openhue | 全平台 |
| songsee | steipete/tap/songsee | songsee | 全平台 |
| himalaya | steipete/tap/himalaya | himalaya | 全平台 |
| 1password | steipete/tap/1password | op-cli-wrapper | 全平台 |
| openai-whisper | steipete/tap/openai-whisper | openai-whisper | 全平台 |
| peekaboo | steipete/tap/peekaboo | peekaboo | macOS |
| gifgrep | steipete/tap/gifgrep | gifgrep | 全平台 |
| wacli | steipete/tap/wacli | wacli | 全平台 |
| ordercli | steipete/tap/ordercli | ordercli | 全平台 |

**这些是最大的缺口** — steipete/tap 没有中国镜像，brew install 会直接从 GitHub 下载。解决方案：通过 GitHub 代理下载预编译二进制，或 TecbinAI 自建镜像。

#### Node/npm — 镜像覆盖完整
| Skill | Package | 二进制名 |
|-------|---------|---------|
| oracle | @steipete/oracle | oracle |
| mcporter | @nicolo/mcporter | mcporter |
| bird | @nicolo/bird | bird |
| model-usage | @nicolo/model-usage | model-usage |
| discord | (npm package) | discord |
| slack | (npm package) | slack |

#### Go Install — 镜像覆盖完整
| Skill | Module | 二进制名 |
|-------|--------|---------|
| blogwatcher | github.com/Hyaxia/blogwatcher | blogwatcher |
| blucli | github.com/steipete/blucli | blu |
| bear-notes | github.com/tylerwince/grizzly | grizzly |
| eightctl | github.com/steipete/eightctl | eightctl |
| food-order | github.com/steipete/ordercli | ordercli |
| things-mac | github.com/ossianhempel/things3-cli | things |
| sonoscli | github.com/steipete/sonoscli | sonos |
| wacli (go) | github.com/steipete/wacli | wacli |
| gifgrep (go) | github.com/steipete/gifgrep | gifgrep |

#### Python/uv — 镜像覆盖完整
| Skill | Package | 二进制名 |
|-------|---------|---------|
| nano-pdf | nano-pdf | nano-pdf |

#### 直接下载
| Skill | 说明 |
|-------|------|
| sherpa-onnx-tts | 模型文件直接下载 |

#### 无需安装（纯 API / 系统内置）
session-logs, video-frames (需 ffmpeg/jq/rg), tmux, github (需 gh), canvas, coding-agent, skill-creator, weather, gemini, local-places, openai-image-gen, openai-whisper-api, nano-banana-pro, software-protection, packaging, skills-troubleshoot

---

## 三、按需打包大小（仅打包无镜像的）

| 平台 | 需打包内容 | 大小 |
|------|-----------|------|
| **Windows** | jq, rg, ffmpeg, steipete/tap 二进制 (Windows 版) | ~103 MB |
| **macOS** | steipete/tap 二进制 (arm64+x86_64) | ~209 MB |
| **Linux** | jq, rg, steipete/tap 二进制 | ~58 MB |

**不需要打包的（镜像可下）**: Go 工具 (goproxy.cn)、npm 工具 (npmmirror)、Python 工具 (ustc/aliyun)

---

## 四、mirrors-manifest.json 设计

```jsonc
{
  "$schema": "https://clawdbot.tecbin.ai/schemas/mirrors-manifest-v1.json",
  "version": "1.0.0",
  "updated": "2026-02-08T00:00:00Z",

  // 全局镜像配置：每种包管理器的 3 个源（按速度排序）
  "mirrors": {
    "go": {
      "env": "GOPROXY",
      "sources": [
        { "name": "goproxy.cn", "url": "https://goproxy.cn", "region": "cn-east" },
        { "name": "goproxy.io", "url": "https://goproxy.io", "region": "global" },
        { "name": "proxy.golang.com.cn", "url": "https://proxy.golang.com.cn", "region": "cn" }
      ],
      "fallback": "https://proxy.golang.org"
    },
    "npm": {
      "env": "NPM_CONFIG_REGISTRY",
      "sources": [
        { "name": "npmmirror", "url": "https://registry.npmmirror.com", "region": "cn" },
        { "name": "tencent", "url": "https://mirrors.cloud.tencent.com/npm/", "region": "cn-south" },
        { "name": "huawei", "url": "https://mirrors.huaweicloud.com/repository/npm/", "region": "cn-north" }
      ],
      "fallback": "https://registry.npmjs.org"
    },
    "pypi": {
      "env": "PIP_INDEX_URL",
      "sources": [
        { "name": "ustc", "url": "https://pypi.mirrors.ustc.edu.cn/simple/", "region": "cn-east" },
        { "name": "aliyun", "url": "https://mirrors.aliyun.com/pypi/simple/", "region": "cn" },
        { "name": "tuna", "url": "https://pypi.tuna.tsinghua.edu.cn/simple/", "region": "cn-north" }
      ],
      "fallback": "https://pypi.org/simple/"
    },
    "brew_bottles": {
      "env": "HOMEBREW_BOTTLE_DOMAIN",
      "sources": [
        { "name": "aliyun", "url": "https://mirrors.aliyun.com/homebrew/homebrew-bottles", "region": "cn" },
        { "name": "ustc", "url": "https://mirrors.ustc.edu.cn/homebrew-bottles", "region": "cn-east" },
        { "name": "tuna", "url": "https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles", "region": "cn-north" }
      ],
      "fallback": "https://ghcr.io/v2/homebrew/core"
    },
    "github_release": {
      "sources": [
        { "name": "gh-proxy", "url": "https://gh-proxy.com", "pattern": "{proxy}/{original_url}", "region": "cn" },
        { "name": "ghfast", "url": "https://ghfast.top", "pattern": "{proxy}/{original_url}", "region": "cn" },
        { "name": "ghproxy.net", "url": "https://ghproxy.net", "pattern": "{proxy}/{original_url}", "region": "cn" }
      ],
      "fallback": null
    }
  },

  // 下载引擎配置
  "download": {
    "concurrency": 3,
    "timeout_per_file_ms": 60000,
    "retry_count": 2,
    "retry_delay_ms": 1000,
    "bandwidth_limit_percent": 80,
    "chunk_size_bytes": 1048576,
    "resume_support": true,
    "verify": "sha256"
  },

  // 每个 Skill 的依赖声明
  "skills": {
    "gog": {
      "name": "gogcli",
      "description": "管理 Gmail、Google Calendar、Drive 和通讯录",
      "category": "生产力",
      "os": ["darwin"],
      "install": {
        "darwin": {
          "method": "github_release",
          "repo": "steipete/gogcli",
          "asset_pattern": "gogcli_{version}_darwin_{arch}.tar.gz",
          "bins": ["gog"],
          "version": "1.2.0",
          "sha256": {
            "arm64": "abc123...",
            "amd64": "def456..."
          },
          "size_bytes": 15200000
        }
      }
    },
    "summarize": {
      "name": "summarize",
      "description": "用AI一键摘要网页、视频和播客内容",
      "category": "生产力",
      "os": ["darwin"],
      "install": {
        "darwin": {
          "method": "github_release",
          "repo": "steipete/summarize",
          "asset_pattern": "summarize_{version}_darwin_{arch}.tar.gz",
          "bins": ["summarize"],
          "version": "0.8.0",
          "sha256": { "arm64": "...", "amd64": "..." },
          "size_bytes": 12000000
        }
      }
    },
    "oracle": {
      "name": "oracle",
      "description": "代码发给第二个AI做交叉审查",
      "category": "开发工具",
      "install": {
        "_all": {
          "method": "npm",
          "package": "@steipete/oracle",
          "bins": ["oracle"]
        }
      }
    },
    "mcporter": {
      "name": "mcporter",
      "description": "调用 MCP 服务器工具，调试和集成",
      "category": "开发工具",
      "install": {
        "_all": {
          "method": "npm",
          "package": "@nicolo/mcporter",
          "bins": ["mcporter"]
        }
      }
    },
    "blogwatcher": {
      "name": "blogwatcher",
      "description": "监控博客更新",
      "category": "开发工具",
      "install": {
        "_all": {
          "method": "go",
          "module": "github.com/Hyaxia/blogwatcher/cmd/blogwatcher@latest",
          "bins": ["blogwatcher"]
        }
      }
    },
    "nano-pdf": {
      "name": "nano-pdf",
      "description": "PDF文档处理",
      "category": "生产力",
      "install": {
        "_all": {
          "method": "pypi",
          "package": "nano-pdf",
          "bins": ["nano-pdf"]
        }
      }
    },
    "openhue": {
      "name": "openhue",
      "description": "控制飞利浦 Hue 智能灯光和场景",
      "category": "智能硬件",
      "install": {
        "darwin": {
          "method": "github_release",
          "repo": "steipete/openhue",
          "asset_pattern": "openhue_{version}_darwin_{arch}.tar.gz",
          "bins": ["openhue"]
        },
        "win32": {
          "method": "github_release",
          "repo": "steipete/openhue",
          "asset_pattern": "openhue_{version}_windows_amd64.zip",
          "bins": ["openhue.exe"]
        },
        "linux": {
          "method": "github_release",
          "repo": "steipete/openhue",
          "asset_pattern": "openhue_{version}_linux_{arch}.tar.gz",
          "bins": ["openhue"]
        }
      }
    }
  },

  // 系统级工具（非 Skill 依赖，但多个 Skill 需要）
  "system_deps": {
    "jq": {
      "description": "JSON 处理工具",
      "required_by": ["session-logs"],
      "install": {
        "win32": {
          "method": "github_release",
          "repo": "jqlang/jq",
          "asset_pattern": "jq-windows-amd64.exe",
          "rename_to": "jq.exe",
          "version": "1.7.1",
          "sha256": "...",
          "size_bytes": 3500000
        },
        "darwin": {
          "method": "brew",
          "formula": "jq"
        },
        "linux": {
          "method": "github_release",
          "repo": "jqlang/jq",
          "asset_pattern": "jq-linux-amd64",
          "rename_to": "jq",
          "version": "1.7.1",
          "sha256": "...",
          "size_bytes": 2700000
        }
      }
    },
    "rg": {
      "description": "高速文本搜索工具",
      "required_by": ["session-logs"],
      "install": {
        "win32": {
          "method": "github_release",
          "repo": "BurntSushi/ripgrep",
          "asset_pattern": "ripgrep-{version}-x86_64-pc-windows-msvc.zip",
          "bins": ["rg.exe"],
          "version": "14.1.1",
          "size_bytes": 4200000
        }
      }
    },
    "ffmpeg": {
      "description": "音视频处理工具",
      "required_by": ["video-frames", "camsnap"],
      "install": {
        "win32": {
          "method": "github_release",
          "repo": "BtbN/FFmpeg-Builds",
          "asset_pattern": "ffmpeg-master-latest-win64-gpl.zip",
          "bins": ["ffmpeg.exe", "ffprobe.exe"],
          "size_bytes": 67000000
        }
      }
    }
  },

  // 失败上报配置
  "telemetry": {
    "report_url": "https://api.tecbin.ai/v1/mirror-failures",
    "enabled": true,
    "fields": ["skill_name", "mirror_name", "mirror_url", "error_code", "error_message", "os", "arch", "timestamp", "latency_ms"],
    "batch_interval_ms": 5000,
    "privacy_note": "仅上报镜像连接失败信息，不含用户个人数据"
  }
}
```

---

## 五、下载引擎回退算法

```
对于每个待安装的 Skill:
  1. 根据 install.method 查找 mirrors[method].sources
  2. 按优先级 (index 0 → 1 → 2) 尝试下载:
     a. 连接超时 5s → 标记失败，切下一个
     b. 下载中断 → 从断点续传 (Range header)
     c. HTTP 4xx/5xx → 标记失败，切下一个
     d. 下载完成 → SHA256 校验
        - 校验通过 → 安装，标记成功
        - 校验失败 → 删除文件，切下一个
  3. 三个镜像全失败 → 尝试 fallback (直连)
  4. 全部失败 → 记录到失败列表，上报 TecbinAI
```

---

## 六、环境变量注入方式

下载引擎在调用各包管理器前，自动注入镜像环境变量：

```bash
# Go
GOPROXY=https://goproxy.cn,https://goproxy.io,https://proxy.golang.com.cn,direct
GONOSUMDB=*

# npm
NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

# PyPI (pip/uv)
PIP_INDEX_URL=https://pypi.mirrors.ustc.edu.cn/simple/
PIP_TRUSTED_HOST=pypi.mirrors.ustc.edu.cn
UV_INDEX_URL=https://pypi.mirrors.ustc.edu.cn/simple/

# Homebrew
HOMEBREW_BOTTLE_DOMAIN=https://mirrors.aliyun.com/homebrew/homebrew-bottles
HOMEBREW_API_DOMAIN=https://mirrors.tuna.tsinghua.edu.cn/homebrew-bottles/api
HOMEBREW_BREW_GIT_REMOTE=https://mirrors.aliyun.com/homebrew/brew.git
```

对于 `github_release` 类型，下载引擎自动将原始 URL 替换为代理 URL：
```
原始: https://github.com/{repo}/releases/download/{version}/{asset}
代理: https://gh-proxy.com/https://github.com/{repo}/releases/download/{version}/{asset}
```

---

## 七、steipete/tap 二进制处理方案

这是最大的缺口。`brew install steipete/tap/xxx` 实际上是从 GitHub Release 下载预编译二进制。

**CN 方案**：跳过 brew，直接通过 GitHub 代理下载二进制并放入 PATH。

流程：
1. 从 manifest 读取 repo + version + asset_pattern
2. 拼接 GitHub Release URL
3. 通过 3 个 GitHub 代理依次尝试下载
4. SHA256 校验
5. 解压到 `~/.clawdbot/bin/` 并加入 PATH

---

## 八、已确认不可用的镜像（避坑）

| 镜像 | 类型 | 状态 | 说明 |
|------|------|------|------|
| mirrors.aliyun.com/goproxy | Go | 404 | 已下线，网上教程过时 |
| mirror.ghproxy.com | GitHub | TLS 失败 | SSL 证书错误 |
| hub-mirror.c.163.com | Docker | 502 | 已停服 |
| docker.mirrors.ustc.edu.cn | Docker | TLS 失败 | 已停服 |
| docker.nju.edu.cn | Docker | 403 | 已关闭 |
| registry.docker-cn.com | Docker | 超时 | 已关闭 |
