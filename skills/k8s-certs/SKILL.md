---
name: k8s-certs
name_zh: K8s 证书
description: 使用 cert-manager 进行 Kubernetes 证书管理。适用于管理 TLS 证书、配置签发者（Issuer），或排查证书相关问题。
description_zh: 使用 cert-manager 进行 Kubernetes 证书管理。适用于管理 TLS 证书、配置签发者（Issuer），或排查证书相关问题。
---
# 使用 cert-manager 进行证书管理

使用 kubectl-mcp-server 的 cert-manager 工具管理 TLS 证书。

## 检查安装状态

```python
certmanager_detect_tool()
```

## 证书（Certificates）

### 列出证书

```python
# List all certificates
certmanager_certificates_list_tool(namespace="default")

# Check certificate status
# - True: Certificate ready
# - False: Certificate not ready (check events)
```

### 获取证书详情

```python
certmanager_certificate_get_tool(
    name="my-tls",
    namespace="default"
)
# Shows:
# - Issuer reference
# - Secret name
# - DNS names
# - Expiry date
# - Renewal time
```

### 创建证书

```python
kubectl_apply(manifest="""
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: my-tls
  namespace: default
spec:
  secretName: my-tls-secret
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
  - app.example.com
  - www.example.com
""")
```

## 签发者（Issuers）

### 列出签发者

```python
# Namespace issuers
certmanager_issuers_list_tool(namespace="default")

# Cluster-wide issuers
certmanager_clusterissuers_list_tool()
```

### 获取签发者详情

```python
certmanager_issuer_get_tool(name="my-issuer", namespace="default")
certmanager_clusterissuer_get_tool(name="letsencrypt-prod")
```

### 创建 Let's Encrypt 签发者

```python
# Staging (for testing)
kubectl_apply(manifest="""
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-staging
spec:
  acme:
    server: https://acme-staging-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-staging-key
    solvers:
    - http01:
        ingress:
          class: nginx
""")

# Production
kubectl_apply(manifest="""
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
    - http01:
        ingress:
          class: nginx
""")
```

### 创建自签名签发者

```python
kubectl_apply(manifest="""
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: selfsigned
spec:
  selfSigned: {}
""")
```

## 证书请求（Certificate Requests）

```python
# List certificate requests
certmanager_certificaterequests_list_tool(namespace="default")

# Get request details (for debugging)
certmanager_certificaterequest_get_tool(
    name="my-tls-xxxxx",
    namespace="default"
)
```

## 故障排查

### 证书未就绪（Not Ready）

```python
1. certmanager_certificate_get_tool(name, namespace)  # Check status
2. certmanager_certificaterequests_list_tool(namespace)  # Check request
3. get_events(namespace)  # Check events
4. # Common issues:
   # - Issuer not ready
   # - DNS challenge failed
   # - Rate limited by Let's Encrypt
```

### 签发者未就绪（Not Ready）

```python
1. certmanager_clusterissuer_get_tool(name)  # Check status
2. get_events(namespace="cert-manager")  # Check events
3. # Common issues:
   # - Invalid credentials
   # - Network issues
   # - Invalid configuration
```

## Ingress 集成

```python
# Automatic certificate via ingress annotation
kubectl_apply(manifest="""
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - app.example.com
    secretName: app-tls
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-service
            port:
              number: 80
""")
```

## 相关 Skills

- [k8s-networking](../k8s-networking/SKILL.md) — Ingress 配置
- [k8s-security](../k8s-security/SKILL.md) — 安全最佳实践