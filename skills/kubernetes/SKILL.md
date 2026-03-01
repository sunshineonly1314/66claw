---
name: kubernetes
name_zh: Kubernetes
description: |
description_zh: |
  全面的 Kubernetes 与 OpenShift 集群管理 skill，涵盖运维、排障、清单生成、安全加固及 GitOps。适用于以下场景：
  (1) 集群运维：升级、备份、节点管理、扩缩容、监控配置  
  (2) 故障排查：Pod 失败、网络问题、存储异常、性能分析  
  (3) 清单生成：Deployment、StatefulSet、Service、Ingress、NetworkPolicy、RBAC  
  (4) 安全：审计、Pod 安全标准（PSS）、RBAC、密钥管理、漏洞扫描  
  (5) GitOps：ArgoCD、Flux、Kustomize、Helm、CI/CD 流水线、渐进式交付  
  (6) OpenShift 特有功能：SCC、Route、Operator、Build、ImageStream  
  (7) 多云环境：AKS、EKS、GKE、ARO、ROSA 运维  
metadata:
  author: cluster-skills
  version: "1.0.0"
---
# Kubernetes 与 OpenShift 集群管理

面向 Kubernetes 与 OpenShift 集群的综合性 skill，覆盖运维、排障、清单、安全及 GitOps 全流程。

## 当前版本（2026 年 1 月）

| 平台 | 版本 | 文档 |
|------|------|------|
| **Kubernetes** | 1.31.x | https://kubernetes.io/docs/ |
| **OpenShift** | 4.17.x | https://docs.openshift.com/ |
| **EKS** | 1.31 | https://docs.aws.amazon.com/eks/ |
| **AKS** | 1.31 | https://learn.microsoft.com/azure/aks/ |
| **GKE** | 1.31 | https://cloud.google.com/kubernetes-engine/docs/ |

### 关键工具

| 工具 | 版本 | 用途 |
|------|------|------|
| **ArgoCD** | v2.13.x | GitOps 部署 |
| **Flux** | v2.4.x | GitOps 工具集 |
| **Kustomize** | v5.5.x | 清单定制化 |
| **Helm** | v3.16.x | 包管理 |
| **Velero** | 1.15.x | 备份/恢复 |
| **Trivy** | 0.58.x | 安全扫描 |
| **Kyverno** | 1.13.x | 策略引擎 |

## 命令约定

**重要提示**：对标准 Kubernetes 使用 `kubectl`；对 OpenShift/ARO 使用 `oc`。

---

## 1. 集群运维（CLUSTER OPERATIONS）

### 节点管理

```bash
# View nodes
kubectl get nodes -o wide

# Drain node for maintenance
kubectl drain ${NODE} --ignore-daemonsets --delete-emptydir-data --grace-period=60

# Uncordon after maintenance
kubectl uncordon ${NODE}

# View node resources
kubectl top nodes
```

### 集群升级

**AKS：**  
```bash
az aks get-upgrades -g ${RG} -n ${CLUSTER} -o table
az aks upgrade -g ${RG} -n ${CLUSTER} --kubernetes-version ${VERSION}
```

**EKS：**  
```bash
aws eks update-cluster-version --name ${CLUSTER} --kubernetes-version ${VERSION}
```

**GKE：**  
```bash
gcloud container clusters upgrade ${CLUSTER} --master --cluster-version ${VERSION}
```

**OpenShift：**  
```bash
oc adm upgrade --to=${VERSION}
oc get clusterversion
```

### 使用 Velero 备份

```bash
# Install Velero
velero install --provider ${PROVIDER} --bucket ${BUCKET} --secret-file ${CREDS}

# Create backup
velero backup create ${BACKUP_NAME} --include-namespaces ${NS}

# Restore
velero restore create --from-backup ${BACKUP_NAME}
```

---

## 2. 故障排查（TROUBLESHOOTING）

### 健康评估

运行内置脚本进行综合健康检查：  
```bash
bash scripts/cluster-health-check.sh
```

### Pod 状态解读

| 状态 | 含义 | 建议操作 |
|------|------|----------|
| `Pending` | 调度失败 | 检查资源配额、nodeSelector、容忍度（tolerations） |
| `CrashLoopBackOff` | 容器崩溃重启 | 查看日志：`kubectl logs ${POD} --previous` |
| `ImagePullBackOff` | 镜像不可用 | 核实镜像名称及镜像仓库访问权限 |
| `OOMKilled` | 内存耗尽（OOM） | 增加内存限制（memory limits） |
| `Evicted` | 节点资源压力 | 检查节点资源使用情况 |

### 排查命令

```bash
# Pod logs (current and previous)
kubectl logs ${POD} -c ${CONTAINER} --previous

# Multi-pod logs with stern
stern ${LABEL_SELECTOR} -n ${NS}

# Exec into pod
kubectl exec -it ${POD} -- /bin/sh

# Pod events
kubectl describe pod ${POD} | grep -A 20 Events

# Cluster events (sorted by time)
kubectl get events -A --sort-by='.lastTimestamp' | tail -50
```

### 网络排障

```bash
# Test DNS
kubectl run -it --rm debug --image=busybox -- nslookup kubernetes.default

# Test service connectivity
kubectl run -it --rm debug --image=curlimages/curl -- curl -v http://${SVC}.${NS}:${PORT}

# Check endpoints
kubectl get endpoints ${SVC}
```

---

## 3. 清单生成（MANIFEST GENERATION）

### 生产级 Deployment 模板

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${APP_NAME}
  namespace: ${NAMESPACE}
  labels:
    app.kubernetes.io/name: ${APP_NAME}
    app.kubernetes.io/version: "${VERSION}"
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app.kubernetes.io/name: ${APP_NAME}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${APP_NAME}
    spec:
      serviceAccountName: ${APP_NAME}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: ${APP_NAME}
          image: ${IMAGE}:${TAG}
          ports:
            - name: http
              containerPort: 8080
          securityContext:
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /healthz
              port: http
            initialDelaySeconds: 10
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app.kubernetes.io/name: ${APP_NAME}
                topologyKey: kubernetes.io/hostname
```

### Service 与 Ingress

```yaml
apiVersion: v1
kind: Service
metadata:
  name: ${APP_NAME}
spec:
  selector:
    app.kubernetes.io/name: ${APP_NAME}
  ports:
    - name: http
      port: 80
      targetPort: http
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${APP_NAME}
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - ${HOST}
      secretName: ${APP_NAME}-tls
  rules:
    - host: ${HOST}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${APP_NAME}
                port:
                  name: http
```

### OpenShift Route

```yaml
apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: ${APP_NAME}
spec:
  to:
    kind: Service
    name: ${APP_NAME}
  port:
    targetPort: http
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect
```

使用内置脚本生成清单：  
```bash
bash scripts/generate-manifest.sh deployment myapp production
```

---

## 4. 安全（SECURITY）

### 安全审计

运行内置脚本：  
```bash
bash scripts/security-audit.sh [namespace]
```

### Pod 安全标准（Pod Security Standards）

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: ${NAMESPACE}
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: baseline
    pod-security.kubernetes.io/warn: restricted
```

### NetworkPolicy（零信任网络）

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ${APP_NAME}-policy
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: ${APP_NAME}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: frontend
      ports:
        - protocol: TCP
          port: 8080
  egress:
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: database
      ports:
        - protocol: TCP
          port: 5432
    # Allow DNS
    - to:
        - namespaceSelector: {}
          podSelector:
            matchLabels:
              k8s-app: kube-dns
      ports:
        - protocol: UDP
          port: 53
```

### RBAC 最佳实践

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${APP_NAME}
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ${APP_NAME}-role
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ${APP_NAME}-binding
subjects:
  - kind: ServiceAccount
    name: ${APP_NAME}
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: ${APP_NAME}-role
```

### 镜像扫描

```bash
# Scan image with Trivy
trivy image ${IMAGE}:${TAG}

# Scan with severity filter
trivy image --severity HIGH,CRITICAL ${IMAGE}:${TAG}

# Generate SBOM
trivy image --format spdx-json -o sbom.json ${IMAGE}:${TAG}
```

---

## 5. GitOps

### ArgoCD Application

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${APP_NAME}
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: ${GIT_REPO}
    targetRevision: main
    path: k8s/overlays/${ENV}
  destination:
    server: https://kubernetes.default.svc
    namespace: ${NAMESPACE}
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

### Kustomize 目录结构

```
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   └── service.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml
    ├── staging/
    │   └── kustomization.yaml
    └── prod/
        └── kustomization.yaml
```

**base/kustomization.yaml：**  
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
```

**overlays/prod/kustomization.yaml：**  
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - ../../base
namePrefix: prod-
namespace: production
replicas:
  - name: myapp
    count: 5
images:
  - name: myregistry/myapp
    newTag: v1.2.3
```

### GitHub Actions CI/CD

```yaml
name: Build and Deploy
on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build and push image
        uses: docker/build-push-action@v5
        with:
          push: true
          tags: ${{ secrets.REGISTRY }}/${{ github.event.repository.name }}:${{ github.sha }}
      
      - name: Update Kustomize image
        run: |
          cd k8s/overlays/prod
          kustomize edit set image myapp=${{ secrets.REGISTRY }}/${{ github.event.repository.name }}:${{ github.sha }}
          
      - name: Commit and push
        run: |
          git config user.name "github-actions"
          git config user.email "github-actions@github.com"
          git add .
          git commit -m "Update image to ${{ github.sha }}"
          git push
```

使用内置脚本同步 ArgoCD：  
```bash
bash scripts/argocd-app-sync.sh ${APP_NAME} --prune
```

---

## 辅助脚本

本 skill 在 `scripts/` 目录中提供自动化脚本：

| 脚本 | 用途 |
|------|------|
| `cluster-health-check.sh` | 综合集群健康评估（含评分） |
| `security-audit.sh` | 安全态势审计（特权、root 权限、RBAC、NetworkPolicy） |
| `node-maintenance.sh` | 安全节点排空与维护准备 |
| `pre-upgrade-check.sh` | 升级前验证检查清单 |
| `generate-manifest.sh` | 生成生产就绪的 Kubernetes 清单 |
| `argocd-app-sync.sh` | ArgoCD 应用同步辅助工具 |

运行任意脚本：  
```bash
bash scripts/<script-name>.sh [arguments]
```