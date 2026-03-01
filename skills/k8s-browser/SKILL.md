---
name: k8s-browser
name_zh: K8s 浏览器
description: 面向 Kubernetes 仪表板及 Web UI 的浏览器自动化。适用于与 Kubernetes Dashboard、Grafana、ArgoCD UI 或其他 Web 界面交互。需设置 MCP_BROWSER_ENABLED=true。
description_zh: 面向 Kubernetes 仪表板及 Web UI 的浏览器自动化。适用于与 Kubernetes Dashboard、Grafana、ArgoCD UI 或其他 Web 界面交互。需设置 MCP_BROWSER_ENABLED=true。
---
# Kubernetes 浏览器自动化

使用 kubectl-mcp-server 的浏览器工具（共 26 个工具）自动化 Kubernetes Web UI。

## 启用浏览器工具

```bash
export MCP_BROWSER_ENABLED=true

# Optional: Cloud provider
export MCP_BROWSER_PROVIDER=browserbase  # or browseruse
export BROWSERBASE_API_KEY=bb_...
```

## 基础导航

```python
# Open URL
browser_open(url="http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/")

# Open with auth headers
browser_open_with_headers(
    url="https://grafana.example.com",
    headers={"Authorization": "Bearer token123"}
)

# Navigate
browser_navigate(url="https://argocd.example.com/applications")

# Go back/forward
browser_back()
browser_forward()

# Refresh
browser_refresh()
```

## 截图与页面内容

```python
# Take screenshot
browser_screenshot(path="dashboard.png")

# Full page screenshot
browser_screenshot(path="full-page.png", full_page=True)

# Get page content
browser_content()

# Get page title
browser_title()

# Get current URL
browser_url()
```

## 交互操作

```python
# Click element
browser_click(selector="button.submit")
browser_click(selector="text=Deploy")
browser_click(selector="#sync-button")

# Type text
browser_type(selector="input[name=search]", text="my-deployment")
browser_type(selector=".search-box", text="nginx")

# Fill form
browser_fill(selector="#namespace", text="production")

# Select dropdown
browser_select(selector="select#cluster", value="prod-cluster")

# Press key
browser_press(key="Enter")
browser_press(key="Escape")
```

## 等待机制

```python
# Wait for element
browser_wait_for_selector(selector=".loading", state="hidden")
browser_wait_for_selector(selector=".data-table", state="visible")

# Wait for navigation
browser_wait_for_navigation()

# Wait for network idle
browser_wait_for_load_state(state="networkidle")
```

## 会话管理

```python
# List sessions
browser_session_list()

# Switch session
browser_session_switch(session_id="my-session")

# Close browser
browser_close()
```

## 视口与设备模拟

```python
# Set viewport size
browser_set_viewport(width=1920, height=1080)

# Emulate device
browser_set_viewport(device="iPhone 12")
```

## Kubernetes Dashboard 工作流

```python
# 1. Start kubectl proxy
# kubectl proxy &

# 2. Open dashboard
browser_open(url="http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/")

# 3. Navigate to workloads
browser_click(selector="text=Workloads")

# 4. Take screenshot
browser_screenshot(path="workloads.png")

# 5. Search for deployment
browser_type(selector="input[placeholder*=search]", text="nginx")
browser_press(key="Enter")
```

## Grafana 仪表板工作流

```python
# 1. Open Grafana
browser_open_with_headers(
    url="https://grafana.example.com/d/k8s-cluster",
    headers={"Authorization": "Bearer admin-token"}
)

# 2. Set time range
browser_click(selector="button[aria-label='Time picker']")
browser_click(selector="text=Last 1 hour")

# 3. Screenshot dashboard
browser_screenshot(path="grafana-cluster.png", full_page=True)
```

## ArgoCD UI 工作流

```python
# 1. Open ArgoCD
browser_open(url="https://argocd.example.com")

# 2. Login
browser_fill(selector="input[name=username]", text="admin")
browser_fill(selector="input[name=password]", text="password")
browser_click(selector="button[type=submit]")

# 3. Navigate to app
browser_wait_for_selector(selector=".applications-list")
browser_click(selector="text=my-application")

# 4. Sync application
browser_click(selector="button.sync-button")
browser_click(selector="text=Synchronize")
```

## 相关 Skills

- [k8s-gitops](../k8s-gitops/SKILL.md) — ArgoCD CLI 工具
- [k8s-diagnostics](../k8s-diagnostics/SKILL.md) — 集群分析