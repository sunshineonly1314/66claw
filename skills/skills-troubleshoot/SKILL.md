---
name: skills-troubleshoot
description: 诊断并修复 Skills 页面问题（卡顿、显示0个技能、无法点击、技能市场为空）。当用户反馈技能页面异常时使用此技能。
nameZh: "技能排错"
descriptionZh: "诊断并修复技能页面显示异常问题"
metadata: {"openclawcn":{"emoji":"🔧"}}
---

# Skills 页面故障排除

## 问题症状

- 页面显示"本地技能 (0)"或数量很少
- 页面卡住、无法点击
- 显示"加载中..."但一直不加载
- Skills 显示英文而非中文
- 技能市场显示 (0)
- 列表为空但标题显示有技能数量

---

## 核心原理

### Skills 加载流程

```
UI 请求 skills.status
    ↓
loadSkillEntries() 从多个目录加载:
    - bundledSkillsDir (环境变量或 skills/)
    - managedSkillsDir (~/.openclawcn/skills/)
    - workspaceSkillsDir (<workspace>/skills/)
    ↓
loadSkillsFromDir() (@mariozechner/pi-coding-agent)
    - 遍历目录查找 SKILL.md
    - 验证 name 字段
    ↓
返回 skills 列表给 UI
```

### 关键验证规则

`loadSkillsFromDir` 函数有严格的 name 验证：

```javascript
// 规则 1: name 必须是 [a-z0-9-]+
if (!/^[a-z0-9-]+$/.test(name)) {
  errors.push("name contains invalid characters");
}

// 规则 2: name 必须与目录名匹配
if (name !== parentDirName) {
  errors.push("name does not match parent directory");
}
```

**不符合规则的 skills 会被静默跳过！**

---

## 常见问题及解决方案

### 问题 1: 中文 Skills 数量很少或为 0

**根本原因**: 很多中文 skills 的 `name` 字段与目录名不匹配

**诊断**:
```powershell
node -e "
const fs = require('fs');
const path = require('path');
const dir = 'd:/path/to/skills';
let mismatch = 0;
fs.readdirSync(dir, {withFileTypes:true}).filter(e=>e.isDirectory()).forEach(entry => {
  const md = path.join(dir, entry.name, 'SKILL.md');
  if (!fs.existsSync(md)) return;
  const content = fs.readFileSync(md, 'utf-8');
  const match = content.match(/name:\s*(\S+)/);
  const name = match ? match[1].trim() : entry.name;
  if (name !== entry.name) { mismatch++; console.log(entry.name, '=>', name); }
});
console.log('Mismatch:', mismatch);
"
```

**解决方案**: 运行修复脚本
```powershell
node scripts/fix-skills-names.js --dry-run  # 预览
node scripts/fix-skills-names.js            # 执行修复
```

### 问题 2: 筛选框有内容导致列表空

**症状**: 标题显示"本地技能 (51)"但列表显示"未找到匹配的技能"

**原因**: 筛选框中有之前输入的文本（如 "D:\openclawcn-build"）

**解决方案**: 清除筛选框内容

### 问题 3: 技能市场显示 0

**原因**: Gitee 仓库不存在或无法访问

**诊断**:
```powershell
Invoke-WebRequest -Uri "https://gitee.com/tecbinai/skills/raw/master/index.json" -TimeoutSec 10
```

**解决方案**:
1. 确保 Gitee 仓库 `tecbinai/skills` 存在且公开
2. 仓库根目录需要有 `index.json` 文件
3. 或使用本地 fallback（需修改 `gitee-registry.ts`）

**生成 index.json**:
```powershell
node scripts/generate-skills-index.js
```

### 问题 4: 环境变量未传递

**症状**: 设置了 `OPENCLAWCN_BUNDLED_SKILLS_DIR` 但日志中没有显示

**解决方案**:
```powershell
# 方法 1: 在同一 shell 设置并启动
$env:OPENCLAWCN_BUNDLED_SKILLS_DIR = "d:\path\to\skills"
node dist\entry.js gateway run --port 18789

# 方法 2: 使用 cmd
cmd /c "set OPENCLAWCN_BUNDLED_SKILLS_DIR=d:\path\to\skills&& node dist\entry.js gateway run --port 18789"
```

### 问题 5: 页面卡顿

**原因**: 遍历大量目录（如 987 个）读取 SKILL.md 需要时间

**优化建议**:
- 首次加载后缓存结果
- 减少 skills 数量（只保留常用的）
- 考虑异步加载

---

## 快速诊断流程

1. **检查进程**: `Get-Process node`
2. **检查日志**: 查看是否有 `[skills] Using OPENCLAWCN_BUNDLED_SKILLS_DIR:` 和 `skills.status` 响应时间
3. **检查筛选框**: 确保为空
4. **检查 skills 目录**: name 是否与目录名匹配
5. **检查技能市场**: Gitee 仓库是否可访问

---

## 相关文件

| 文件 | 作用 |
|------|------|
| `src/agents/skills/bundled-dir.ts` | 解析 skills 目录 |
| `src/agents/skills/workspace.ts` | 加载 skills |
| `src/agents/skills/gitee-registry.ts` | 远程 skills 获取 |
| `src/gateway/server-methods/skills.ts` | API 处理 |
| `ui/src/ui/controllers/skills.ts` | 前端状态管理 |
| `scripts/fix-skills-names.js` | 修复 name 不匹配 |
| `scripts/generate-skills-index.js` | 生成 index.json |
