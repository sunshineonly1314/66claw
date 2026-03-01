---
name: k8s-autoscaling
name_zh: K8 自动扩缩容
description: 使用 HPA、VPA 和 KEDA 配置 Kubernetes 自动扩缩容。适用于水平/垂直 Pod 自动扩缩、事件驱动型扩缩及容量管理。
description_zh: 使用 HPA、VPA 和 KEDA 配置 Kubernetes 自动扩缩容。适用于水平/垂直 Pod 自动扩缩、事件驱动型扩缩及容量管理。
---
# Kubernetes 自动扩缩容

结合 HPA、VPA 与 KEDA，并借助 kubectl-mcp-server 工具实现全面的自动扩缩容。

## 快速参考

### HPA（Horizontal Pod Autoscaler）

基于 CPU 的基础扩缩：
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

应用并验证：
```
apply_manifest(hpa_yaml, namespace)
get_hpa(namespace)
```

### VPA（Vertical Pod Autoscaler）

优化资源请求值：
```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: my-app-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  updatePolicy:
    updateMode: "Auto"
```

## KEDA（事件驱动型自动扩缩）

### 检测 KEDA 是否已安装
```
keda_detect_tool()
```

### 列出 ScaledObjects
```
keda_scaledobjects_list_tool(namespace)
keda_scaledobject_get_tool(name, namespace)
```

### 列出 ScaledJobs
```
keda_scaledjobs_list_tool(namespace)
```

### 触发器认证（Trigger Authentication）
```
keda_triggerauths_list_tool(namespace)
keda_triggerauth_get_tool(name, namespace)
```

### KEDA 托管的 HPA
```
keda_hpa_list_tool(namespace)
```

触发器配置详见 [KEDA-TRIGGERS.md](KEDA-TRIGGERS.md)。

## 常用 KEDA 触发器

### 基于队列的扩缩（AWS SQS）
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: sqs-scaler
spec:
  scaleTargetRef:
    name: queue-processor
  minReplicaCount: 0  # Scale to zero!
  maxReplicaCount: 100
  triggers:
  - type: aws-sqs-queue
    metadata:
      queueURL: https://sqs.region.amazonaws.com/...
      queueLength: "5"
```

### 基于 Cron 的扩缩
```yaml
triggers:
- type: cron
  metadata:
    timezone: America/New_York
    start: 0 8 * * 1-5   # 8 AM weekdays
    end: 0 18 * * 1-5    # 6 PM weekdays
    desiredReplicas: "10"
```

### Prometheus 指标
```yaml
triggers:
- type: prometheus
  metadata:
    serverAddress: http://prometheus:9090
    metricName: http_requests_total
    query: sum(rate(http_requests_total{app="myapp"}[2m]))
    threshold: "100"
```

## 扩缩策略对比

| 策略 | 工具 | 适用场景 |
|------|------|----------|
| CPU/内存 | HPA | 流量稳定的场景 |
| 自定义指标 | HPA v2 | 业务指标驱动 |
| 事件驱动 | KEDA | 队列处理、定时任务 |
| 垂直扩缩 | VPA | 优化资源请求值 |
| 缩容至零 | KEDA | 成本节约、空闲工作负载 |

## 成本优化型自动扩缩

### 使用 KEDA 缩容至零
降低空闲工作负载成本：
```
keda_scaledobjects_list_tool(namespace)
# ScaledObjects with minReplicaCount: 0 can scale to zero
```

### 使用 VPA 优化资源配置
获取建议并应用：
```
get_resource_recommendations(namespace)
# Apply VPA recommendations
```

### 预测式扩缩
利用 Cron 触发器应对已知周期性流量：
```yaml
# Scale up before traffic spike
triggers:
- type: cron
  metadata:
    start: 0 7 * * *  # 7 AM
    end: 0 9 * * *    # 9 AM
    desiredReplicas: "20"
```

## 多集群自动扩缩

跨集群配置 KEDA：
```
keda_scaledobjects_list_tool(namespace, context="production")
keda_scaledobjects_list_tool(namespace, context="staging")
```

## 故障排查

### HPA 未触发扩缩
```
get_hpa(namespace)
get_pod_metrics(name, namespace)  # Metrics available?
describe_pod(name, namespace)     # Resource requests set?
```

### KEDA 未触发扩缩
```
keda_scaledobject_get_tool(name, namespace)  # Check status
get_events(namespace)                        # Check events
```

### 常见问题

| 现象 | 检查项 | 解决方案 |
|------|--------|-----------|
| HPA 显示 unknown | Metrics Server | 安装 metrics-server |
| KEDA 无扩缩行为 | 触发器认证 | 检查 TriggerAuthentication |
| VPA 未更新 | 更新模式 | 设置 updateMode: Auto |
| 缩容缓慢 | 稳定窗口 | 调整 stabilizationWindowSeconds |

## 最佳实践

1. **始终设置资源请求值（requests）**  
   - HPA 需依赖 requests 计算资源利用率  

2. **组合使用多种指标**  
   - 同时采用 CPU + 自定义指标提升准确性  

3. **配置稳定窗口（Stabilization Windows）**  
   - 使用 scaleDown 稳定窗口防止抖动  

4. **谨慎使用缩容至零**  
   - 考虑冷启动延迟  
   - 启用 activation threshold（激活阈值）  

## 相关 Skills
- [k8s-cost](../k8s-cost/SKILL.md) —— 成本优化  
- [k8s-troubleshoot](../k8s-troubleshoot/SKILL.md) —— 扩缩问题调试  