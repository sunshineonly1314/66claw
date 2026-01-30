# GitHub Actions 工作流说明

## 可用的工作流

### 1. Docker Build Test (`docker-build-test.yml`)

Docker 镜像打包测试工作流。

#### 触发方式

1. **手动触发**（推荐测试时使用）
2. **推送代码**到 main/master 分支
3. **Pull Request** 到 main/master 分支

#### 手动触发步骤

1. 进入仓库页面：https://github.com/kevinGoGoGo123/clawdbotCNDocker
2. 点击顶部的 **Actions** 标签
3. 左侧选择 **Docker Build Test**
4. 点击右侧的 **Run workflow** 按钮
5. 填写参数：
   - **版本号**: 如 `2026.1.30`
   - **是否推送镜像**: 选择 `true` 或 `false`
6. 点击 **Run workflow** 开始构建

#### 构建产物

- Docker 镜像 tar.gz 包
- 保留 7 天
- 可在 Actions 页面下载

---

## 配置 Secrets

如果需要推送镜像到私有仓库，需要配置以下 Secrets：

### 配置步骤

1. 进入仓库 **Settings**
2. 左侧菜单选择 **Secrets and variables** → **Actions**
3. 点击 **New repository secret**

### 需要的 Secrets

| Secret 名称 | 说明 | 必需 |
|------------|------|------|
| `GITHUB_TOKEN` | 自动提供，无需配置 | - |
| `ALIYUN_REGISTRY_USERNAME` | 阿里云镜像仓库用户名 | 可选 |
| `ALIYUN_REGISTRY_PASSWORD` | 阿里云镜像仓库密码 | 可选 |

---

## 获取 GitHub Token

### 用途

- 推送镜像到 GitHub Container Registry (ghcr.io)
- API 调用（手动触发等）

### 获取步骤

1. 登录 GitHub
2. 点击右上角头像 → **Settings**
3. 滚动到底部，点击 **Developer settings**
4. 点击 **Personal access tokens** → **Tokens (classic)**
5. 点击 **Generate new token (classic)**
6. 配置：
   - **Note**: `clawdbot-docker-build`
   - **Expiration**: 90 days
   - **Scopes**: 勾选
     - ✅ `repo`
     - ✅ `workflow`
     - ✅ `write:packages`
7. 点击 **Generate token**
8. **立即复制保存！**

### 在仓库中配置 Token

如果需要从其他地方触发工作流：

1. 进入仓库 Settings → Secrets → Actions
2. 添加 Secret：
   - Name: `PAT_TOKEN`
   - Value: 粘贴你的 Token

---

## 常见问题

### Q: Actions 页面看不到工作流？

确保 `.github/workflows/` 目录下的 yml 文件已经推送到仓库。

### Q: 手动触发按钮在哪？

1. 进入 Actions 页面
2. 左侧选择工作流名称
3. 右侧会显示 "Run workflow" 按钮

### Q: 构建失败怎么办？

1. 点击失败的运行记录
2. 查看具体失败的步骤
3. 展开查看详细日志

### Q: 如何下载构建产物？

1. 点击成功的运行记录
2. 滚动到页面底部 "Artifacts" 部分
3. 点击下载
