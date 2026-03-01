---
name: cad-agent
description: CAD Agent 是一个渲染服务器，使 AI 智能体能够“看见”自己正在构建的内容。发送建模指令 → 接收渲染图像 → 进行可视化迭代。
description_zh: CAD Agent 是一个渲染服务器，使 AI 智能体能够“看见”自己正在构建的内容。发送建模指令 → 接收渲染图像 → 进行可视化迭代。
---
# CAD Agent

> Give your AI agent eyes for CAD work.

## 描述

CAD Agent 是一个渲染服务器，使 AI 智能体能够“看见”自己正在构建的内容。发送建模指令 → 接收渲染图像 → 进行可视化迭代。

**适用场景：** 设计可 3D 打印的零件、参数化 CAD、机械设计、build123d 建模

## 架构

**关键原则：** 所有 CAD 逻辑均在容器内运行。你（即 agent）仅需执行以下操作：
1. 通过 HTTP 发送指令
2. 查看返回的图像
3. 决定下一步操作

```
YOU (agent)                     CAD AGENT CONTAINER
─────────────                   ───────────────────
Send build123d code      →      Executes modeling
                         ←      Returns JSON status
Request render           →      VTK renders the model
                         ←      Returns PNG image
*Look at the image*
Decide: iterate or done
```

**切勿**在容器外部执行 STL 操作、网格处理或渲染。所有工作均由容器完成——你只需下达指令并观察结果。

## 安装配置

### 1. 克隆代码仓库

```bash
git clone https://github.com/clawd-maf/cad-agent.git
cd cad-agent
```

### 2. 构建 Docker 镜像

```bash
docker build -t cad-agent:latest .
```

或使用 docker-compose：

```bash
docker-compose build
```

### 3. 启动服务器

```bash
# Using docker-compose (recommended)
docker-compose up -d

# Or using docker directly
docker run -d --name cad-agent -p 8123:8123 cad-agent:latest serve
```

### 4. 验证安装

```bash
curl http://localhost:8123/health
# Should return: {"status": "healthy", ...}
```

> **Docker-in-Docker caveat:** In nested container environments (e.g., Clawdbot sandbox), host networking may not work—`curl localhost:8123` will fail even though the server binds to `0.0.0.0:8123`. Use `docker exec cad-agent python3 -c "..."` commands instead. On a normal Docker host, localhost access works fine.

## 工作流程

### 1. 创建模型

```bash
curl -X POST http://localhost:8123/model/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my_part",
    "code": "from build123d import *\nresult = Box(60, 40, 30)"
  }'
```

### 2. 渲染与查看

```bash
# Get multi-view (front/right/top/iso)
curl -X POST http://localhost:8123/render/multiview \
  -d '{"model_name": "my_part"}' -o views.png

# Or 3D isometric
curl -X POST http://localhost:8123/render/3d \
  -d '{"model_name": "my_part", "view": "isometric"}' -o iso.png
```

**请仔细查看图像。** 它是否符合预期？若不符合，请修改后重新渲染。

### 3. 迭代优化

```bash
curl -X POST http://localhost:8123/model/modify \
  -d '{
    "name": "my_part", 
    "code": "result = result - Cylinder(5, 50).locate(Pos(20, 10, 0))"
  }'

# Re-render to check
curl -X POST http://localhost:8123/render/3d \
  -d '{"model_name": "my_part"}' -o updated.png
```

### 4. 导出模型

```bash
curl -X POST http://localhost:8123/export \
  -d '{"model_name": "my_part", "format": "stl"}' -o part.stl
```

## API 端点

| 端点 | 功能说明 |
|----------|--------------|
| `POST /model/create` | 运行 build123d 代码，创建模型 |
| `POST /model/modify` | 修改已有模型 |
| `GET /model/list` | 列出当前会话中的所有模型 |
| `GET /model/{name}/measure` | 获取模型尺寸信息 |
| `POST /render/3d` | 生成三维着色渲染图（基于 VTK） |
| `POST /render/2d` | 生成二维工程图纸 |
| `POST /render/multiview` | 生成四视图组合图 |
| `POST /export` | 导出为 STL/STEP/3MF 格式 |
| `POST /analyze/printability` | 检查模型是否具备可打印性 |

## build123d 快速参考指南

```python
from build123d import *

# Primitives
Box(width, depth, height)
Cylinder(radius, height)
Sphere(radius)

# Boolean
a + b   # union
a - b   # subtract
a & b   # intersect

# Position
part.locate(Pos(x, y, z))
part.rotate(Axis.Z, 45)

# Edges
fillet(part.edges(), radius)
chamfer(part.edges(), length)
```

## 重要提示

- **切勿绕过容器。** 禁止使用 matplotlib、外部 STL 库或任何网格篡改操作。
- **渲染图即你的“眼睛”。** 每次修改后务必请求一次渲染。
- **以可视化方式进行迭代。** 整个设计流程的核心价值，正在于你能实时看到自己正在构建的内容。

## 设计文件安全性

本项目内置多重防护机制，防止意外提交 CAD 输出文件：
- `.gitignore` 已屏蔽 *.stl、*.step、*.3mf 等输出文件类型
- 预提交钩子（pre-commit hook）将拒绝提交设计文件
- 用户的设计文件始终保留在本地，不会纳入版本控制

## 相关链接

- [代码仓库](https://github.com/clawd-maf/cad-agent)
- [build123d 文档](https://build123d.readthedocs.io/)
- [VTK](https://vtk.org/)