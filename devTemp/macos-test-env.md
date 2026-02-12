# macOS 测试环境 - 远程连接信息

## 连接方式: SSH via 花生壳 (Oray) 内网穿透

| 项目 | 值 |
|------|-----|
| 外网域名 | 12io00807dp01.vicp.fun |
| 外网端口 | 19102 |
| 旧域名 | 31k4r80556.zicp.vip:16589 (已失效) |
| 协议 | TCP (SSH) |
| 用户名 | admin |
| 密码 | 86112112 |
| Host Key | SHA256:Kpox/4Vk55Hy439XlKbB8Lqi2q+spNQIeK7x4q8PfQs |

## 机器信息

| 项目 | 值 |
|------|-----|
| 主机名 | admindeMacBook-Pro |
| 系统 | macOS 15.7.3 (Sequoia) |
| 构建版本 | 24G419 |
| 架构 | x86_64 (Intel Mac) |
| 内核 | Darwin 24.6.0 |

## 连接命令

### Windows (PuTTY plink)
```bash
"C:\Program Files\PuTTY\plink.exe" -ssh -P 19102 -l admin -pw 86112112 -batch 12io00807dp01.vicp.fun "命令"
```

### 通用 SSH
```bash
ssh admin@12io00807dp01.vicp.fun -p 19102
# 密码: 86112112
```

## 注意事项

- 花生壳免费版隧道可能不稳定，如遇 ECONNRESET 需让对方重启花生壳客户端
- 非交互式 SSH (plink -batch) 需要指定 -hostkey 参数
- 对方 macOS 的 npm/node 未在默认 PATH 中，需使用完整路径
