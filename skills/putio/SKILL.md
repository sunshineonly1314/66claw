---
name: putio
name_zh: Put.io
description: 通过 kaput CLI 管理 put.io 账户（传输任务、文件、搜索）——扬起主帆，添加磁力链接/URL，并检查传输状态；建议与 chill-institute skill 搭配使用。
description_zh: 通过 kaput CLI 管理 put.io 账户（传输任务、文件、搜索）——扬起主帆，添加磁力链接/URL，并检查传输状态；建议与 chill-institute skill 搭配使用。
---
# put.io（kaput CLI）

本 skill 使用非官方 **kaput** CLI 工具，实现从命令行操作 put.io。

若您同时安装了 **chill-institute** skill，则可以：
- 使用 chill.institute *启动* 一项传输任务（“发送至 put.io”），然后
- 使用本 skill *验证并监控* 该传输任务的实际进度（即“货物是否真正抵达”）。

## 安装

- 需要 Rust + Cargo。
- 安装命令：
  ```bash
  cargo install kaput-cli
  ```
- 确保 `kaput` 已加入您的 PATH（通常位于 `~/.cargo/bin`）。

## 认证（设备码流程）

1. 运行：
   ```bash
   kaput login
   ```
2. 终端将打印一个链接和一个短代码（例如：`https://put.io/link` + `ABC123`）；
3. 用户在浏览器中输入该代码；
4. CLI 完成认证并将 token 本地存储。

检查认证状态：
```bash
bash skills/putio/scripts/check_auth.sh
```

## 常用操作（脚本）

所有脚本均自动定位 `kaput`（支持 `KAPUT_BIN=/path/to/kaput`）。

- 列出传输任务：
  ```bash
  bash skills/putio/scripts/list_transfers.sh
  ```

- 添加传输任务（磁力链接 / 种子 URL / 直链 URL）：
  ```bash
  bash skills/putio/scripts/add_transfer.sh "magnet:?xt=urn:btih:..."
  ```

- 搜索文件：
  ```bash
  bash skills/putio/scripts/search_files.sh "query"
  ```

- 查看状态（传输任务；可选：账户整体状态）：
  ```bash
  bash skills/putio/scripts/status.sh
  SHOW_ACCOUNT=1 bash skills/putio/scripts/status.sh
  ```

## 原生命令行接口（Raw CLI）

用于高级操作：
```bash
kaput --help
kaput transfers --help
kaput files --help
```

## 安全须知

- **切勿在聊天窗口中粘贴密码**。请使用 `kaput login` 设备码流程。
- kaput 将凭据本地存储（token 文件）。请将其视为敏感信息，切勿分享。
- 避免在共享日志或截图中运行 `kaput debug`（可能泄露本地配置细节）。