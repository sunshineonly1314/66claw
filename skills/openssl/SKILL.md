---
name: openssl
name_zh: OpenSSL
description: 使用 OpenSSL 生成安全随机字符串、密码及加密令牌。适用于创建密码、API 密钥、密钥或其他任意安全随机数据场景。
description_zh: 使用 OpenSSL 生成安全随机字符串、密码及加密令牌。适用于创建密码、API 密钥、密钥或其他任意安全随机数据场景。
---
# OpenSSL 安全生成

使用 `openssl rand` 生成密码学安全的随机数据。

## 密码 / 密钥生成

```bash
# 32 random bytes as base64 (43 chars, URL-safe with tr)
openssl rand -base64 32 | tr '+/' '-_' | tr -d '='

# 24 random bytes as hex (48 chars)
openssl rand -hex 24

# alphanumeric password (32 chars)
openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 32
```

## 常用长度参考

| 使用场景 | 命令 |
|----------|---------|
| 强密码 | `openssl rand -base64 24` |
| API 密钥 | `openssl rand -hex 32` |
| 会话令牌 | `openssl rand -base64 48` |
| 短 PIN 码（8 位数字） | `openssl rand -hex 4 | xxd -r -p | od -An -tu4 | tr -d ' ' | head -c 8` |

## 注意事项

- `-base64` 输出的字符数约为字节数的 1.33 倍  
- `-hex` 输出的字符数为字节数的 2 倍  
- 可通过管道传入 `tr -dc` 过滤所需字符集  
- 密钥类数据应至少使用 16 字节（128 位）  