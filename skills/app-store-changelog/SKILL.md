---
name: app-store-changelog
name_zh: 应用商店更新日志
description: 通过收集并汇总自上一个 git tag（或指定的 ref）以来所有影响用户的变化，生成面向用户的 App Store 发布说明。当被要求基于 git 历史或标签生成全面的发布变更日志、App Store “新增内容”文案或发布说明时，请使用该 skill。
description_zh: 通过收集并汇总自上一个 git tag（或指定的 ref）以来所有影响用户的变化，生成面向用户的 App Store 发布说明。当被要求基于 git 历史或标签生成全面的发布变更日志、App Store “新增内容”文案或发布说明时，请使用该 skill。
---
# App Store Changelog

## 概述  
从上一个 tag 起的 git 历史中生成一份全面、面向用户的变更日志，再将提交记录转化为清晰易懂的 App Store 发布说明。

## 工作流程  

### 1) 收集变更  
- 在仓库根目录下运行 `scripts/collect_release_changes.sh`，以收集提交记录及涉及的文件。  
- 如有需要，可传入特定 tag 或 ref：`scripts/collect_release_changes.sh v1.2.3 HEAD`。  
- 若仓库中不存在任何 tag，则脚本将回退至完整历史范围。

### 2) 筛选用户影响项  
- 扫描提交记录与文件，识别对用户可见的变更。  
- 按主题（新增、改进、修复）对变更进行归类，并去重重叠项。  
- 排除仅限内部使用的修改（如构建脚本、代码重构、依赖版本升级、CI 配置等）。

### 3) 起草 App Store 说明  
- 针每项面向用户的变更，撰写简短、以用户收益为导向的条目。  
- 使用明确的动词和平实的语言；避免内部术语。  
- 默认建议条目数为 5 至 10 条；若用户另行指定长度，则依其要求调整。

### 4) 校验  
- 确保每一条目均可追溯至所涉范围内的真实变更。  
- 检查是否存在重复条目或过于技术化的措辞。  
- 若任一变更含义模糊，或疑似仅为内部用途，需主动请求澄清。

## 输出格式  
- 标题（可选）：“What’s New” 或产品名称 + 版本号。  
- 仅输出项目符号列表；每条为一句完整句子。  
- 若用户提供 App Store 商店页面的字数/长度限制，则须严格遵守。

## 相关资源  
- `scripts/collect_release_changes.sh`：收集自上一个 tag 起的提交记录及涉及的文件。  
- `references/release-notes-guidelines.md`：App Store 说明所用语言、过滤规则及质量保障规范。