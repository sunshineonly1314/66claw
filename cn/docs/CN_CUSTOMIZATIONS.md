# OpenClawCN 定制代码保护清单

> **用途**: 每次从 OpenClaw 上游合并代码前，必须先读取本文件。
> 以下列出的所有文件/目录均为 CN 版独有或已被 CN 定制修改，合并时必须保护，不可被上游覆盖。
> **最后更新**: 2026-02-15

---

## 一、CN 全新文件（上游不存在，绝对不能丢失）

### 1.1 核心配置模块 (`src/config/`)
| 文件 | 说明 |
|------|------|
| `src/config/region-cn.ts` | CN 区域检测、国产 AI 提供商目录、CN 安全默认值 (~1100 行) |
| `src/config/cn-mirrors.ts` | 国内镜像源 (npm/pip/go/cargo/brew/GitHub 代理等 ~1860 行) |
| `src/config/zod-schema.providers-cn.ts` | 飞书/钉钉/企业微信 provider schema |
| `src/config/defaults-cn.test.ts` | CN 默认值测试 |
| `src/config/region-cn.test.ts` | CN 区域检测测试 |

### 1.2 CN 提供商认证 (`src/commands/`)
| 文件 | 说明 |
|------|------|
| `src/commands/auth-choice.apply.cn-providers.ts` | 硅基流动/DeepSeek/智谱/通义千问/火山引擎/腾讯混元 认证处理 |

### 1.3 CN AI 模型 (`src/agents/`)
| 文件 | 说明 |
|------|------|
| `src/agents/siliconflow-models.ts` | SiliconFlow 模型发现与目录 |

### 1.4 微信/小红书工具 (`src/agents/tools/`)
| 文件 | 说明 |
|------|------|
| `src/agents/tools/wechat-send.ts` | 微信消息发送自动化 |
| `src/agents/tools/wechat-check.ts` | 微信状态检查 |

### 1.5 智能调度系统 (`src/dispatch/`)
| 文件 | 说明 |
|------|------|
| `src/dispatch/` (整个目录) | 智能请求调度引擎 (intent-classifier, cost-estimator, tier-selector, modality-router, provider-health, smooth-fallback 等) |
| `dispatch.yaml` | 调度配置文件 (根目录) |

### 1.6 钉钉连接器
| 文件 | 说明 |
|------|------|
| `src/dingtalk-moltbot-connector-main/` (整个目录) | 钉钉平台集成连接器 |

### 1.7 CN 专属渠道扩展 (`extensions/`)
| 目录 | 说明 |
|------|------|
| `extensions/feishu/` | 飞书渠道插件 |
| `extensions/dingtalk/` | 钉钉渠道插件 |
| `extensions/wecom/` | 企业微信渠道插件 |
| `extensions/qqbot/` | QQ Bot 渠道插件 |

### 1.8 CN 渠道 UI 视图 (`ui/src/ui/views/`)
| 文件 | 说明 |
|------|------|
| `ui/src/ui/views/channels.feishu.ts` | 飞书配置界面 |
| `ui/src/ui/views/channels.dingtalk.ts` | 钉钉配置界面 |
| `ui/src/ui/views/channels.wecom.ts` | 企业微信配置界面 |

### 1.9 CN 文档
| 文件 | 说明 |
|------|------|
| `docs/china-localization.md` | CN 本地化总纲 |
| `docs/channels/china-quickstart.md` | CN 渠道快速入门 |
| `docs/channels/feishu.md` | 飞书渠道文档 |
| `docs/channels/dingtalk.md` | 钉钉渠道文档 |
| `docs/channels/wecom.md` | 企业微信渠道文档 |
| `docs/channels/qqbot.md` | QQ Bot 渠道文档 |
| `docs/skills-china-mirrors.md` | 技能镜像配置文档 |
| `docs/skills-cn-download-audit.md` | CN 技能下载审计 |
| `docs/cn-defaults-requirements.md` | CN 默认值需求规格 |
| `docs/macos-cn-packaging-plan.md` | macOS CN 打包方案 |
| `docs/macos-cn-packaging-final.md` | macOS CN 打包实施 |
| `docs/ops-runbook-license-cn-fallback.md` | CN License 回退运维手册 |
| `docs/ops-runbook-obplugins-cn-proxy.md` | CN 代理运维手册 |
| `docs/requirements/cn-user-experience-todo.md` | CN 用户体验待办 |
| `docs/archive/2025-0208-cn-defaults-and-bugfixes.md` | CN 默认值历史归档 |
| `docs/archive/2025-0208-cn-defaults-full-parameter-reference.md` | CN 完整参数参考 |
| `docs-cn/` | CN 专用文档目录 (预留) |

### 1.10 CN 配置示例
| 文件 | 说明 |
|------|------|
| `config.china.example.json5` | CN 部署配置样例 (Qwen/Doubao/DeepSeek) |

### 1.11 构建 & 部署 (`build/`, `scripts/`, `.github/`)
| 文件/目录 | 说明 |
|------|------|
| `build/scripts/build-macos-cn.sh` | macOS CN 28 线程并行构建脚本 |
| `build/templates/macos/clawbotcn.template` | CN 版 DMG 模板 |
| `build/windows/deploy/docs/` | Windows CN 部署文档 |
| `scripts/install-mac-cn.sh` | macOS CN 安装脚本 |
| `scripts/install-macos-cn.sh` | macOS CN 安装脚本 (变体) |
| `scripts/linux/install-china.sh` | Linux CN 安装脚本 |
| `scripts/fix-tags-cn.mjs` | 标签本地化后处理 |
| `scripts/translate-clawdhub-skills-cn.mjs` | 技能翻译为中文 |
| `scripts/translate-docs-cn.mjs` | 文档翻译为中文 |
| `.github/workflows/build-macos-cn.yml` | macOS CN 构建 CI 工作流 |

### 1.12 Tauri 桌面端 (新增功能)
| 目录 | 说明 |
|------|------|
| `apps/desktop/` (整个目录) | Tauri 跨平台桌面应用 |
| `scripts/desktop/` (整个目录) | 桌面端构建脚本 |
| `DESKTOP_INSTALLATION.md` | 桌面端安装指南 |

### 1.13 语音/ASR 集成
| 文件 | 说明 |
|------|------|
| `src/agents/tools/asr-tool.ts` | 语音识别工具 |
| `src/agents/tools/tts-tool.ts` | 语音合成工具 |
| `src/gateway/server-methods/asr.ts` | ASR 服务端方法 |
| `src/gateway/server-methods/tts.ts` | TTS 服务端方法 |
| `src/gateway/server-methods/voicewake.ts` | 语音唤醒 |
| `src/infra/voicewake.ts` | 语音唤醒基础设施 |

### 1.14 原生插件 & 安全模块
| 目录 | 说明 |
|------|------|
| `native/` (整个目录) | C++ 原生插件 (canvas, 安全模块) |

### 1.15 国际化
| 文件 | 说明 |
|------|------|
| `src/i18n/locales/zh-CN.ts` | 后端中文字符串 |
| `ui/src/ui/i18n/locales/zh-CN.ts` | 前端中文字符串 |
| `ui/src/docscn/` | CN 文档索引目录 |

### 1.16 开发临时 & 技能翻译
| 目录 | 说明 |
|------|------|
| `devTemp/` | 开发临时文件 (含 cn-model-providers-guide.md) |
| `cn/skills-qc/` | 技能翻译输出目录 |
| `docs/roadmap/` | 开发待办目录 (原 todo/) |
| `docs/bugs/` | Bug 追踪目录 (原 bugtodo/) |
| `docs/prd/` | PRD 文档目录 (原 prdresult/) |

### 1.17 迭代日志 & 项目文档
| 文件 | 说明 |
|------|------|
| `ITERATION.md` | CN 每日功能迭代日志 |
| `upstream_changelog.md` | 上游变更追踪 |
| `CN_CUSTOMIZATIONS.md` | 本文件 (定制保护清单) |

---

## 二、已修改的上游文件（合并时需手动解决冲突）

这些文件上游也有，但 CN 版在其中加入了 CN 逻辑，合并时需要**保留 CN 修改**。

| 文件 | CN 修改内容 |
|------|-------------|
| `src/config/defaults.ts` | 调用 `applyCnDefaults()` 函数，注入 CN 区域默认值 |
| `src/config/auto-detect-env.ts` | 引入 CN 区域自动检测 |
| `src/agents/models-config.ts` | 引用 CN 提供商 |
| `src/agents/models-config.providers.ts` | 集成 CN 提供商列表 |
| `package.json` | CN 版本号、CN 构建脚本 |
| `AGENTS.md` | 引用 ITERATION.md、CN 开发规范 |
| `CHANGELOG.md` | CN 版变更日志 |
| `src/auto-reply/reply/get-reply.ts` | 注入模态感知智能路由 (routeByModality) |
| `src/agents/model-fallback.ts` | 注入 Provider 健康状态记录 (recordProviderSuccess/Failure) |
| `src/media-understanding/providers/openai/index.ts` | 修复 OpenAI 音频能力声明 (添加 "audio") |
| `src/media-understanding/defaults.ts` | 扩展 AUTO_VIDEO_KEY_PROVIDERS (添加 openai, zai) |
| `src/media-understanding/attachments.ts` | 补充文档类型检测 (resolveAttachmentKind 支持 document) |
| `src/config/types.agent-defaults.ts` | 添加 preferDomestic 配置项 (模态路由国内模型优先) |
| `ui/src/ui/app-gateway.ts` | UI 网关定制 (当前未提交) |
| `ui/src/ui/storage.ts` | 存储定制 (当前未提交) |

---

## 三、CN 关键环境变量

合并时确保这些环境变量的检测逻辑不被覆盖:

| 变量 | 用途 |
|------|------|
| `OPENCLAWCN_REGION=cn` | 强制启用 CN 区域 |
| `OPENCLAWCN_USE_CN_MIRROR` | 启用国内镜像 |
| `TZ=Asia/Shanghai` | 时区检测触发 CN 模式 |
| `LANG=zh_CN.*` | 语言环境检测触发 CN 模式 |

---

## 四、CN 关键 API 端点

合并时确保这些端点配置不丢失:

| 服务 | 端点 |
|------|------|
| 硅基流动 | `api.siliconflow.cn/v1` |
| 通义千问 | `dashscope.aliyuncs.com/compatible-mode/v1` |
| 火山引擎 | `ark.cn-beijing.volces.com/api/v3` |
| 智谱 GLM | `open.bigmodel.cn/api/paas/v4` |
| 月之暗面 | `api.moonshot.cn/v1` |
| 腾讯混元 | `hunyuan.tencentcloudapi.com` |
| 魔搭 | `api-inference.modelscope.cn/v1` |
| 技能代理 | `http://121.43.61.90/api` (ClawdSkillsProxy) |

---

## 五、合并操作守则

### 合并前
1. **必读本文件** — 了解哪些文件不能被覆盖
2. `git stash` 保存未提交修改
3. 在独立分支上操作: `git checkout -b merge/upstream-YYYY-MM-DD`

### 合并中
4. 对 "第一节 (全新文件)" 使用 `--ours` 策略 — 保留 CN 版本
5. 对 "第二节 (修改文件)" 手动解决冲突 — 保留 CN 注入点
6. 对上游新增文件 — 正常接受

### 合并后
7. `pnpm lint && pnpm build && pnpm test` — 全量门禁检查
8. 检查 CN 区域检测: `OPENCLAWCN_REGION=cn node -e "..."`
9. 更新本文件的 "最后更新" 日期
10. 更新 `upstream_changelog.md` 记录本次合并内容
