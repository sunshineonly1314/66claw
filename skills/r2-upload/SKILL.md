---
name: Send Me My Files - R2 upload with short lived signed urls
name_zh: R2上传
description: 将文件上传至 Cloudflare R2、AWS S3 或任意兼容 S3 的存储服务，并生成具有可配置有效期的安全预签名下载链接。
description_zh: 将文件上传至 Cloudflare R2、AWS S3 或任意兼容 S3 的存储服务，并生成具有可配置有效期的安全预签名下载链接。
summary: 一款基于 TypeScript 的 MCP skill，支持将文件上传至云存储（R2、S3、MinIO），并生成安全、临时的下载链接。具备多存储桶支持、交互式入门引导，以及默认 5 分钟有效期。
---
# Send Me My Files — R2 上传（含短期有效签名 URL）

将文件上传至 Cloudflare R2 或任意兼容 S3 的存储服务，并生成预签名下载链接。

## 功能特性

- 向 R2/S3 存储桶上传文件  
- 生成预签名下载 URL（有效期可配置）  
- 支持任意兼容 S3 的存储服务（R2、AWS S3、MinIO 等）  
- 支持多存储桶配置  
- 自动识别文件内容类型（Content-Type）  

## 配置说明

请创建 `~/.r2-upload.yml`（或设置环境变量 `R2_UPLOAD_CONFIG`）：

```yaml
# Default bucket (used when no bucket specified)
default: my-bucket

# Bucket configurations
buckets:
  my-bucket:
    endpoint: https://abc123.r2.cloudflarestorage.com
    access_key_id: your_access_key
    secret_access_key: your_secret_key
    bucket_name: my-bucket
    public_url: https://files.example.com  # Optional: custom domain
    region: auto  # For R2, use "auto"
    
  # Additional buckets
  personal:
    endpoint: https://xyz789.r2.cloudflarestorage.com
    access_key_id: ...
    secret_access_key: ...
    bucket_name: personal-files
    region: auto
```

### Cloudflare R2 配置流程

1. 访问 Cloudflare 控制台 → R2  
2. 创建一个存储桶  
3. 进入 R2 API Tokens 页面：`https://dash.cloudflare.com/<ACCOUNT_ID>/r2/api-tokens`  
4. 创建新的 API token  
   - **重要提示：** 请务必选择“仅限特定存储桶”（请选择您的存储桶）  
   - 权限设置：Object Read & Write（对象读取与写入）  
5. 复制 Access Key ID 与 Secret Access Key  
6. 使用端点格式：`https://<account_id>.r2.cloudflarestorage.com`  
7. 设置 `region: auto`  

### AWS S3 配置流程

```yaml
aws-bucket:
  endpoint: https://s3.us-east-1.amazonaws.com
  access_key_id: ...
  secret_access_key: ...
  bucket_name: my-aws-bucket
  region: us-east-1
```

## 使用方法

### 上传单个文件

```bash
r2-upload /path/to/file.pdf
# Returns: https://files.example.com/abc123/file.pdf?signature=...
```

### 指定自定义路径上传

```bash
r2-upload /path/to/file.pdf --key uploads/2026/file.pdf
```

### 上传至指定存储桶

```bash
r2-upload /path/to/file.pdf --bucket personal
```

### 自定义有效期（默认：5 分钟）

```bash
r2-upload /path/to/file.pdf --expires 24h
r2-upload /path/to/file.pdf --expires 1d
r2-upload /path/to/file.pdf --expires 300  # seconds
```

### 生成公开 URL（无需签名）

```bash
r2-upload /path/to/file.pdf --public
```

## 提供的工具

- `r2_upload` — 上传文件并获取预签名 URL  
- `r2_list` — 列出最近上传的文件  
- `r2_delete` — 删除指定文件  

## 环境变量

- `R2_UPLOAD_CONFIG` — 配置文件路径（默认：`~/.r2-upload.yml`）  
- `R2_DEFAULT_BUCKET` — 覆盖默认存储桶  
- `R2_DEFAULT_EXPIRES` — 默认有效期（单位：秒，默认：300 = 5 分钟）  

## 注意事项

- 上传文件默认保留原始文件名，除非指定了 `--key`  
- 自动添加 UUID 前缀以防止文件名冲突（例如：`abc123/file.pdf`）  
- Content-Type 根据文件扩展名自动检测  
- 预签名 URL 在配置的有效期结束后自动失效  