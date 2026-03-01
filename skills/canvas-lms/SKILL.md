---
name: canvas-lms
name_zh: Canvas LMS
description: 访问 Canvas LMS（Instructure）中的课程数据、作业、成绩和提交记录。适用于查询截止日期、查看成绩、列出课程或从 Canvas 获取课程资料等场景。
description_zh: 访问 Canvas LMS（Instructure）中的课程数据、作业、成绩和提交记录。适用于查询截止日期、查看成绩、列出课程或从 Canvas 获取课程资料等场景。
---
# Canvas LMS Skill

通过 REST API 访问 Canvas LMS 数据。

## 设置

1. 在 Canvas 中生成 API Token：Account → Settings → New Access Token  
2. 将 Token 存储于环境变量或 `.env` 文件中：  
   ```bash
   export CANVAS_TOKEN="your_token_here"
   export CANVAS_URL="https://your-school.instructure.com"  # or canvas.yourschool.edu
   ```  

## 认证

所有请求均需携带 Token：  
```bash
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/..."
```  

## 常用端点

### 课程与个人资料  
```bash
# User profile
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/users/self/profile"

# Active courses
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/courses?enrollment_state=active&per_page=50"

# Dashboard cards (quick overview)
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/dashboard/dashboard_cards"
```  

### 作业与截止日期  
```bash
# To-do items (upcoming work)
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/users/self/todo"

# Upcoming events
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/users/self/upcoming_events"

# Missing/overdue submissions
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/users/self/missing_submissions"

# Course assignments
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/courses/{course_id}/assignments?per_page=50"

# Assignment details
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/courses/{course_id}/assignments/{id}"

# Submission status
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/courses/{course_id}/assignments/{id}/submissions/self"
```  

### 成绩  
```bash
# Enrollments with scores
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/users/self/enrollments?include[]=current_grading_period_scores&per_page=50"
```  
提取某项成绩：`.grades.current_score`  

### 课程内容  
```bash
# Announcements
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/announcements?context_codes[]=course_{course_id}&per_page=20"

# Modules
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/courses/{course_id}/modules?include[]=items&per_page=50"

# Files
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/courses/{course_id}/files?per_page=50"

# Discussion topics
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/courses/{course_id}/discussion_topics?per_page=50"

# Inbox
curl -s -H "Authorization: Bearer $CANVAS_TOKEN" "$CANVAS_URL/api/v1/conversations?per_page=20"
```  

## 响应处理

- 列表类端点返回数组  
- 分页：检查 `Link` 响应头中的 `rel="next"`  
- 日期格式为 ISO 8601（UTC 时区）  
- 对响应较慢的端点，可使用 `--max-time 30`  

使用 jq 解析：  
```bash
curl -s ... | jq '.[] | {name: .name, due: .due_at}'
```  

若系统未安装 jq，可改用 Python：  
```bash
curl -s ... | python3 -c "import sys,json; data=json.load(sys.stdin); print(json.dumps(data, indent=2))"
```  

## 使用提示

- 课程 ID 出现在待办事项（todo）或作业响应中  
- 文件下载 URL 位于文件对象的 `url` 字段中  
- 始终指定 `per_page=50` 参数以获取更多结果（默认通常仅返回 10 条）  