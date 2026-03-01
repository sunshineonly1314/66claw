---
name: job-auto-apply
name_zh: 求职自动投递
description: Clawdbot 的自动化求职搜索与申请系统。当用户希望搜索职位并自动申请符合其条件的岗位时启用。支持在 LinkedIn、Indeed、Glassdoor、ZipRecruiter 和 Wellfound 平台上搜索职位，生成定制化求职信，填写申请表单，并追踪申请状态。当用户表达“查找并申请职位”、“为[职位名称]自动申请”、“搜索[岗位]职位并申请”或“帮我自动申请多个职位”等意图时启用。
description_zh: Clawdbot 的自动化求职搜索与申请系统。当用户希望搜索职位并自动申请符合其条件的岗位时启用。支持在 LinkedIn、Indeed、Glassdoor、ZipRecruiter 和 Wellfound 平台上搜索职位，生成定制化求职信，填写申请表单，并追踪申请状态。当用户表达“查找并申请职位”、“为[职位名称]自动申请”、“搜索[岗位]职位并申请”或“帮我自动申请多个职位”等意图时启用。
---
# 求职自动申请 Skill

借助 Clawdbot，在多个求职平台间自动化执行职位搜索与申请提交。

## 概览

本 skill 支持自动化求职搜索与申请全流程。它根据用户设定的条件搜索职位、分析匹配度、生成定制化求职信，并自动提交申请（或在启用确认模式时由用户确认后提交）。

**支持平台：**  
- LinkedIn（含 Easy Apply）  
- Indeed  
- Glassdoor  
- ZipRecruiter  
- Wellfound（AngelList）  

## 快速入门

### 1. 创建用户档案

首先，使用模板创建用户档案：

```bash
# Copy the profile template
cp profile_template.json ~/job_profile.json

# Edit with user's information
# Fill in: name, email, phone, resume path, skills, preferences
```

### 2. 执行职位搜索与申请

```bash
# Basic usage - search and apply (dry run)
python job_search_apply.py \
  --title "Software Engineer" \
  --location "San Francisco, CA" \
  --remote \
  --max-applications 10 \
  --dry-run

# With profile file
python job_search_apply.py \
  --profile ~/job_profile.json \
  --title "Backend Engineer" \
  --platforms linkedin,indeed \
  --auto-apply

# Production mode (actual applications)
python job_search_apply.py \
  --profile ~/job_profile.json \
  --title "Senior Developer" \
  --no-dry-run \
  --require-confirmation
```

## 工作流步骤

### 第一步：档案配置

从模板加载用户档案，或以编程方式创建：

```python
from job_search_apply import ApplicantProfile

profile = ApplicantProfile(
    full_name="Jane Doe",
    email="jane@example.com",
    phone="+1234567890",
    resume_path="~/Documents/resume.pdf",
    linkedin_url="https://linkedin.com/in/janedoe",
    years_experience=5,
    authorized_to_work=True,
    requires_sponsorship=False
)
```

### 第二步：定义搜索参数

```python
from job_search_apply import JobSearchParams, JobPlatform

search_params = JobSearchParams(
    title="Software Engineer",
    location="Remote",
    remote=True,
    experience_level="mid",
    job_type="full-time",
    salary_min=100000,
    platforms=[JobPlatform.LINKEDIN, JobPlatform.INDEED]
)
```

### 第三步：运行自动化申请

```python
from job_search_apply import auto_apply_workflow

results = auto_apply_workflow(
    search_params=search_params,
    profile=profile,
    max_applications=10,
    min_match_score=0.75,
    dry_run=False,
    require_confirmation=True
)
```

## 与 Clawdbot 集成

### 作为 Clawdbot 工具使用

安装为 Clawdbot skill 后，可通过自然语言调用：

**示例提示语：**  
- “查找并申请旧金山的 Python 开发工程师职位”  
- “搜索远程后端工程师职位，并向匹配度最高的前 5 个职位申请”  
- “为年薪 10 万美元以上的高级软件工程师职位自动申请”  
- “在 Wellfound 上为科技初创公司申请职位”  

本 skill 将：  
1. 解析用户意图并提取搜索参数  
2. 从已保存配置中加载用户档案  
3. 在指定平台执行搜索  
4. 分析职位匹配度  
5. 为每份职位生成定制化求职信  
6. 提交申请（若启用确认模式，则先征得用户同意）  
7. 汇报结果并追踪申请状态  

### Clawdbot 中的配置方式

在您的 Clawdbot 配置中添加：

```json
{
  "skills": {
    "job-auto-apply": {
      "enabled": true,
      "profile_path": "~/job_profile.json",
      "default_platforms": ["linkedin", "indeed"],
      "max_daily_applications": 10,
      "require_confirmation": true,
      "dry_run": false
    }
  }
}
```

## 功能特性

### 1. 多平台搜索  
- 覆盖全部主流求职平台  
- 优先使用官方 API  
- 对无 API 支持的平台回退至网络爬虫  

### 2. 智能匹配  
- 分析职位描述，比对任职要求  
- 计算兼容性得分  
- 按最低匹配阈值过滤职位  

### 3. 申请定制化  
- 为每份职位生成定制化求职信  
- 根据职位要求调整简历重点内容  
- 处理各平台特有的申请表单  

### 4. 安全特性  
- **试运行模式（Dry Run Mode）**：模拟流程但不实际提交申请  
- **人工确认模式**：每份申请提交前均需用户确认  
- **速率限制**：防止对平台造成请求压力  
- **申请日志**：记录全部申请行为，便于追溯  

### 5. 表单自动化  
自动填写常见申请字段：  
- 个人信息  
- 工作许可状态  
- 教育与工作经验  
- Skills 及资质认证  
- 筛选问题（必要时由 AI 作答）  

## 高级用法

### 自定义求职信模板

创建含占位符的模板：

```text
Dear Hiring Manager at {company},

I am excited to apply for the {position} role. With {years} years of 
experience in {skills}, I believe I would be an excellent fit.

{custom_paragraph}

I look forward to discussing how I can contribute to {company}'s success.

Best regards,
{name}
```

### 申请追踪

结果将自动保存为 JSON 格式，包含每份申请的详细信息，如时间戳、匹配得分及当前状态。

## 内置资源

### 脚本
- `job_search_apply.py` —— 主自动化脚本，涵盖搜索、匹配与申请逻辑  

### 参考文档
- `platform_integration.md` —— API 集成、网络爬虫、表单自动化及各平台技术细节的完整说明  

### 资源文件
- `profile_template.json` —— 全面的档案模板，涵盖全部必需与可选字段  

## 安全与伦理规范

### 重要准则

1. **真实性**：绝不虚构资质或经验  
2. **真实兴趣**：仅申请您真正感兴趣的职位  
3. **速率限制**：尊重各平台的限制条款与服务协议  
4. **人工审核**：建议启用确认模式以保障质量  
5. **隐私保护**：对个人资料与凭证进行安全存储  

### 最佳实践

- 首先使用试运行模式验证行为  
- 设定合理申请上限（每日 5–10 份）  
- 使用较高匹配得分阈值（0.75+）  
- 对关键职位启用人工确认  
- 追踪结果以持续优化策略  