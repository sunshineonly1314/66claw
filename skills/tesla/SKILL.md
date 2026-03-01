---
name: tesla
name_zh: 特斯拉
description: 控制您的特斯拉车辆——上锁/解锁、调节空调、查询位置与充电状态等。支持多车管理。
description_zh: 控制您的特斯拉车辆——上锁/解锁、调节空调、查询位置与充电状态等。支持多车管理。
homepage: https://tesla-api.timdorr.com
metadata: {"clawdbot":{"emoji":"🚗","requires":{"env":["TESLA_EMAIL"]}}}
---
# 特斯拉（Tesla）

通过 Clawdbot 控制您的特斯拉车辆。支持同一账户下的多辆车。

## 配置

### 首次身份验证：

```bash
TESLA_EMAIL="you@email.com" python3 {baseDir}/scripts/tesla.py auth
```

该流程将：  
1. 显示特斯拉登录网址  
2. 您在浏览器中登录并授权  
3. 将回调 URL 粘贴回终端  
4. 缓存访问令牌供后续使用（有效期约 30 天，支持自动刷新）  

### 环境变量：

- `TESLA_EMAIL` — 您的特斯拉账户邮箱  
- 令牌缓存在 `~/.tesla_cache.json`  

## 多车支持

使用 `--car` 或 `-c` 指定目标车辆：

```bash
# List all vehicles
python3 {baseDir}/scripts/tesla.py list

# Commands for specific car
python3 {baseDir}/scripts/tesla.py --car "Snowflake" status
python3 {baseDir}/scripts/tesla.py -c "Stella" lock
```

若不指定 `--car`，所有命令默认作用于您的第一辆车。

## 命令列表

```bash
# List all vehicles
python3 {baseDir}/scripts/tesla.py list

# Get vehicle status
python3 {baseDir}/scripts/tesla.py status
python3 {baseDir}/scripts/tesla.py --car "Stella" status

# Lock/unlock
python3 {baseDir}/scripts/tesla.py lock
python3 {baseDir}/scripts/tesla.py unlock

# Climate
python3 {baseDir}/scripts/tesla.py climate on
python3 {baseDir}/scripts/tesla.py climate off
python3 {baseDir}/scripts/tesla.py climate temp 72

# Charging
python3 {baseDir}/scripts/tesla.py charge status
python3 {baseDir}/scripts/tesla.py charge start
python3 {baseDir}/scripts/tesla.py charge stop

# Location
python3 {baseDir}/scripts/tesla.py location

# Honk & flash
python3 {baseDir}/scripts/tesla.py honk
python3 {baseDir}/scripts/tesla.py flash

# Wake up (if asleep)
python3 {baseDir}/scripts/tesla.py wake
```

## 示例对话用法

- “我的特斯拉锁上了吗？”  
- “给 Stella 上锁”  
- “Snowflake 的电池电量是多少？”  
- “我的 Model X 在哪儿？”  
- “打开 Stella 的空调”  
- “让 Snowflake 喇叭响一下”  

## API 参考

本 skill 使用非官方的特斯拉车主 API，文档详见：  
https://tesla-api.timdorr.com  

## 隐私与安全

- 凭据仅本地存储  
- 刷新令牌缓存在 `~/.tesla_cache.json`  
- 不向任何第三方传输数据  
- 令牌支持自动刷新，有效期约 30 天  