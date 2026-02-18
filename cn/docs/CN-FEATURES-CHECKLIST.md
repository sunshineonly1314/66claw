# ClawdbotCN 未合并到上游的特有功能清单

> 生成时间：2026-02-15
> 对比版本：本地 master vs upstream/main (OpenClaw)

## 📊 总体统计

- **本地领先上游提交数**: 75 个
- **中国版扩展文件数**: 1,093 个
- **中国版扩展代码变化**: +10,485 行插入 / -6,534 行删除
- **UI 中国版改动**: +53,972 行插入 / -8,961 行删除
- **总文件变化**: 8,071 个文件
- **上游新提交**: 1,016 个（需要适配）

## ✅ ClawdbotCN 特有功能模块

### 1. 🇨🇳 中国版通讯渠道扩展 (Extensions)

#### 飞书 (Feishu) ✅ 完整实现
- **文件数**: 487 个 TypeScript 文件
- **功能**:
  - 飞书机器人完整集成
  - 飞书文档读取
  - 飞书互动卡片
  - 飞书表情包和贴纸
  - 飞书消息桥接
- **代码位置**: `extensions/feishu/`
- **状态**: ✅ 完整，需要保留

#### 钉钉 (DingTalk) ✅ 完整实现
- **文件数**: 441 个 TypeScript 文件
- **功能**:
  - 钉钉 Stream 模式
  - 钉钉 AI 卡片
  - 钉钉媒体上传
  - 钉钉会话管理
- **代码位置**: `extensions/dingtalk/`
- **状态**: ✅ 完整，需要保留

#### 企业微信 (WeCom) ✅ 基础实现
- **文件数**: 7 个 TypeScript 文件
- **功能**:
  - 企业微信 Webhook 集成
  - 基础消息收发
- **代码位置**: `extensions/wecom/`
- **状态**: ✅ 基础功能完整

#### QQ Bot ✅ 基础实现
- **文件数**: 7 个 TypeScript 文件
- **功能**:
  - QQ 官方 Bot API
  - 基础消息处理
- **代码位置**: `extensions/qqbot/`
- **状态**: ✅ 基础功能完整

---

### 2. 🛠️ 中国版核心功能

#### 中国镜像支持 ✅
- **文件**:
  - `src/config/cn-mirrors.ts` - 国内镜像配置
  - `src/agents/skills/mirror-download-engine.ts` - 镜像下载引擎
  - `src/config/region-cn.ts` - 中国区域配置
- **功能**: Skills 从国内镜像下载，加速中国用户体验
- **状态**: ✅ 完整

#### 中国版 AI 提供商 ✅
- **文件**:
  - `src/config/zod-schema.providers-cn.ts` - 中国 AI 提供商配置
  - `src/commands/auth-choice.apply.cn-providers.ts` - 中国版授权
- **支持提供商**:
  - 阿里云通义千问
  - 百度文心一言
  - 智谱 GLM
  - Kimi (月之暗面)
  - DeepSeek
  - MiniMax
- **状态**: ✅ 完整

---

### 3. 🎨 UI 中国版增强

#### 中文本地化 ✅
- **文件**: `ui/src/ui/i18n/locales/zh-CN.ts`
- **覆盖**: 全界面中文翻译
- **状态**: ✅ 完整

#### 中国版 UI 组件 ✅
- **新增组件**:
  - 微信 QR 码支持卡片
  - Skills 批量安装进度条
  - 语音吉祥物界面
  - 欢迎发现页
- **改动文件**:
  - `ui/src/ui/views/skills.ts` (大幅重写)
  - `ui/src/ui/views/welcome-discovery.ts` (新增)
  - `ui/src/ui/views/voice-mascot.ts` (新增)
- **状态**: ✅ 完整

---

### 4. 🔧 构建和部署

#### Windows 构建优化 ✅
- **文件**:
  - `.github/workflows/build-macos-cn.yml`
  - `scripts/windows/` 下的所有构建脚本
  - `devTemp/windowsbuild.md` - 详细构建文档
- **功能**:
  - 一键安装包（Lite / Pro 双版本）
  - 沙盒配置
  - Docker 环境包
- **状态**: ✅ 完整

#### macOS 构建支持 ✅
- **文件**: `.github/workflows/build-macos-cn.yml`
- **功能**: macOS 一键安装助手
- **状态**: ✅ 完整

---

### 5. 📚 中国版文档

#### 中文文档 ✅
- **文件**:
  - `docs/channels/feishu.md` - 飞书接入文档
  - `docs/channels/wecom.md` - 企业微信文档
  - `devTemp/*.md` - 大量中国版开发文档
- **状态**: ✅ 完整

---

### 6. 🎯 技能生态 (Skills)

#### 中国版特有 Skills ✅
- **飞书系列**:
  - `feishu-bridge` - 飞书桥接
  - `feishu-doc-reader` - 飞书文档阅读
  - `feishu-interactive-cards` - 飞书互动卡片
  - `feishu-messaging` - 飞书消息
  - `feishu-native-emoji` - 飞书原生表情
  - `feishu-sticker` - 飞书贴纸
- **状态**: ✅ 完整

#### 国内镜像 Skills ✅
- **数量**: 3000+ Skills 的国内镜像
- **位置**: `cn/skills-mirror/`
- **状态**: ✅ 完整

---

### 7. 🔐 安全增强

#### 中国版安全特性 ✅
- **提交记录显示**:
  - SEC-06: PATH injection fix
  - CH-05: metadata injection protection
  - 凭证脱敏
  - 沙盒路径验证
- **状态**: ✅ 已合并

---

## ⚠️ 潜在问题分析

### 高风险：代码冲突区域

1. **Extensions 目录**
   - 上游可能有通用 extension 架构变化
   - 中国版 4 个扩展（飞书/钉钉/企微/QQ）需要适配新架构
   - **风险等级**: 🔴 高

2. **UI 代码**
   - UI 改动 +53,972 行，上游也在重构 UI
   - Skills 页面、Chat 界面可能有大量冲突
   - **风险等级**: 🔴 高

3. **配置系统**
   - 中国版新增 `cn-mirrors.ts`, `region-cn.ts` 等配置
   - 上游配置系统可能重构
   - **风险等级**: 🟡 中

4. **构建脚本**
   - Windows 构建完全重写
   - macOS 构建新增中国版特性
   - **风险等级**: 🟡 中

---

## ✅ 安全合并区域

1. **中国版扩展目录** 🟢
   - `extensions/feishu/`
   - `extensions/dingtalk/`
   - `extensions/wecom/`
   - `extensions/qqbot/`
   - **不会有冲突**，直接保留

2. **中国版配置文件** 🟢
   - `config.china.example.json5`
   - `src/config/cn-mirrors.ts`
   - `src/config/region-cn.ts`
   - **新增文件**，不会冲突

3. **中文文档** 🟢
   - `docs/` 下的中文文档
   - `devTemp/` 开发文档
   - **独立文件**，保留即可

---

## 🎯 合并策略建议

### Phase 1: 保留核心特性（必须）
```bash
# 合并时强制保留这些目录
git checkout --ours extensions/feishu/
git checkout --ours extensions/dingtalk/
git checkout --ours extensions/wecom/
git checkout --ours extensions/qqbot/
git checkout --ours src/config/cn-mirrors.ts
git checkout --ours src/config/region-cn.ts
```

### Phase 2: 手动适配冲突（重点）
- ✅ UI 代码：逐文件对比，保留中国版 UI 增强
- ✅ Extensions 架构：适配上游新接口，保留中国版实现
- ✅ 配置系统：合并上游改进，保留中国版配置

### Phase 3: 测试验证（关键）
- ✅ 飞书/钉钉/企微/QQ 消息收发
- ✅ 国内镜像下载
- ✅ 中文 UI 显示
- ✅ Windows/macOS 构建

---

## 📋 合并前检查清单

- [ ] 飞书扩展 (487 文件) 完整保留
- [ ] 钉钉扩展 (441 文件) 完整保留
- [ ] 企业微信扩展 (7 文件) 完整保留
- [ ] QQ Bot 扩展 (7 文件) 完整保留
- [ ] 中国镜像配置保留
- [ ] 中国版 AI 提供商配置保留
- [ ] UI 中文本地化保留
- [ ] UI 中国版组件保留
- [ ] Windows/macOS 构建脚本保留
- [ ] 中文文档保留
- [ ] 飞书 Skills 保留
- [ ] 安全增强保留

---

## 🚨 结论

### 回答您的问题：**别最后合成了一个半成品！**

✅ **放心，不会变成半成品！**

**原因：**
1. **中国版特性独立性强**：4 个中国扩展完全独立于上游，不会被覆盖
2. **文件数量庞大**：1,093 个文件，占项目很大比重，合并时容易识别
3. **功能完整**：飞书/钉钉/企微/QQ 都是完整实现，不是半成品
4. **有明确标识**：文件名、目录名都有明确的中国版标识

**需要注意：**
- ⚠️ UI 代码改动大 (+53,972 行)，需要仔细合并
- ⚠️ 配置系统可能冲突，需要手动适配
- ⚠️ 构建脚本完全重写，需要保留中国版

**建议：**
1. 合并时使用 `git merge --no-commit`，先预览冲突
2. 冲突文件逐个处理，不要盲目 `git checkout --ours`
3. 合并后完整测试所有中国版特性
4. 保留本地备份分支 `backup/before-upstream-merge`

---

**总结：只要仔细处理冲突，保留中国版特性，不会变成半成品！** ✅
