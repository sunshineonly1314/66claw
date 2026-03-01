---
name: gitload
name_zh: Gitload
description: >
description_zh: >
  当用户提出如下请求时，应使用本 skill：“从 GitHub 下载文件”、“从仓库获取某个文件夹”、“从 GitHub 抓取代码”、“下载 GitHub 仓库”、“从 GitHub URL 获取文件”、“仅克隆某个文件夹”，或需要在不完整克隆整个仓库的前提下，下载 GitHub 上的特定文件/文件夹。
---
# gitload

使用 gitload CLI，通过 GitHub URL 下载文件、文件夹或整个仓库。

## 使用时机

请在以下情形中使用 gitload：
- 仅需下载仓库中的某个特定文件夹（而非整个仓库）  
- 仅需获取 GitHub 上的单个文件  
- 下载仓库内容但无需保留 Git 历史记录  
- 创建 GitHub 内容的 ZIP 归档包  
- 访问需身份验证的私有仓库  

请勿在以下情形中使用 gitload：
- 需要完整 Git 历史记录（请改用 `git clone`）  
- 仓库已本地克隆  
- 操作非 GitHub 的仓库  

## 前置条件

通过 npx 运行 gitload（无需预先安装）：
```bash
npx gitload-cli https://github.com/user/repo
```

或全局安装：
```bash
npm install -g gitload-cli
```

## 基础用法

### 下载整个仓库
```bash
gitload https://github.com/user/repo
```  
在当前目录下创建名为 `repo/` 的文件夹。

### 下载特定文件夹
```bash
gitload https://github.com/user/repo/tree/main/src/components
```  
创建名为 `components/` 的文件夹，其中仅包含该文件夹的内容。

### 下载单个文件
```bash
gitload https://github.com/user/repo/blob/main/README.md
```

### 下载至自定义路径
```bash
gitload https://github.com/user/repo/tree/main/src -o ./my-source
```

### 将内容扁平化下载至当前目录
```bash
gitload https://github.com/user/repo/tree/main/templates -o .
```

### 下载为 ZIP 文件
```bash
gitload https://github.com/user/repo -z ./repo.zip
```

## 身份验证（用于私有仓库或规避速率限制）

### 使用 gh CLI（推荐）
```bash
gitload https://github.com/user/private-repo --gh
```  
需提前完成 `gh auth login`。

### 显式提供令牌
```bash
gitload https://github.com/user/repo --token ghp_xxxx
```

### 使用环境变量
```bash
export GITHUB_TOKEN=ghp_xxxx
gitload https://github.com/user/repo
```

**令牌优先级顺序**：`--token` > `GITHUB_TOKEN` > `--gh`

## URL 格式

gitload 支持标准 GitHub URL：
- **仓库根目录**：`https://github.com/user/repo`  
- **文件夹**：`https://github.com/user/repo/tree/branch/path/to/folder`  
- **文件**：`https://github.com/user/repo/blob/branch/path/to/file.ext`  

## 常见模式

### 基于模板文件夹搭建项目
```bash
gitload https://github.com/org/templates/tree/main/react-starter -o ./my-app
cd my-app && npm install
```

### 获取示例代码
```bash
gitload https://github.com/org/examples/tree/main/authentication
```

### 下载文档以供离线阅读
```bash
gitload https://github.com/org/project/tree/main/docs -z ./docs.zip
```

### 获取单个配置文件
```bash
gitload https://github.com/org/configs/blob/main/.eslintrc.json -o .
```

## 选项参考

| 选项 | 说明 |
|------|------|
| `-o, --output <dir>` | 输出目录（默认：以 URL 路径命名的文件夹） |
| `-z, --zip <path>` | 将输出保存为指定路径的 ZIP 文件 |
| `-t, --token <token>` | GitHub 个人访问令牌（PAT） |
| `--gh` | 使用 gh CLI 中已配置的令牌 |
| `--no-color` | 禁用彩色输出 |
| `-h, --help` | 显示帮助信息 |
| `-V, --version` | 显示版本号 |

## 错误处理

若 gitload 执行失败：
1. **404 错误**：请确认 URL 存在且可公开访问  
2. **速率限制错误**：请通过 `--gh` 或 `--token` 添加身份验证  
3. **权限错误**：对于私有仓库，请确保令牌具备 `repo` 作用域  
4. **网络错误**：请检查网络连接状况  

## 注意事项

- gitload 通过 GitHub API 下载内容，而非 Git 协议  
- 不保留任何 Git 历史记录（如需历史记录，请使用 `git clone`）  
- 大型仓库下载耗时较长；建议仅下载所需的具体文件夹  
- 若输出目录不存在，gitload 将自动创建  