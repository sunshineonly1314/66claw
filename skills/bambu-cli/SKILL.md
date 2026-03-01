---
name: bambu-cli
name_zh: Bambu CLI
description: 使用 bambu-cli 工具操作与排障 BambuLab 打印机（状态/监控、打印启动/暂停/恢复/停止、文件管理、摄像头、G-code、AMS、校准、运动控制、风扇、灯光、配置、诊断）。当用户请求控制或监控 BambuLab 打印机、设置配置文件或访问码，或将某项任务转化为安全的 bambu-cli 命令（含正确标志、输出格式与确认机制）时使用。
description_zh: 使用 bambu-cli 工具操作与排障 BambuLab 打印机（状态/监控、打印启动/暂停/恢复/停止、文件管理、摄像头、G-code、AMS、校准、运动控制、风扇、灯光、配置、诊断）。当用户请求控制或监控 BambuLab 打印机、设置配置文件或访问码，或将某项任务转化为安全的 bambu-cli 命令（含正确标志、输出格式与确认机制）时使用。
---
# Bambu CLI

## 概述
使用 bambu-cli 通过 MQTT/FTPS/摄像头协议配置、监控和控制 BambuLab 打印机，生成精确命令并采用安全默认值。

## 默认行为与安全性
- 确认目标打印机（配置文件或 IP/序列号），并明确解析优先级：命令行标志 > 环境变量 > 项目配置 > 用户配置。
- 避免在命令行标志中传递访问码；仅使用 `--access-code-file` 或 `--access-code-stdin`。
- 对破坏性操作（停止打印、删除文件、发送 G-code、校准、重启）必须要求确认；仅在用户明确同意时才使用 `--force`/`--confirm`。
- 如支持，应提供 `--dry-run` 功能以预览操作。
- 输出格式默认为人可读格式；`--json` 用于结构化输出；`--plain` 用于 key=value 格式输出。

## 快速入门
- 配置配置文件： `bambu-cli config set --printer <name> --ip <ip> --serial <serial> --access-code-file <path> --default`
- 查看状态： `bambu-cli status`
- 实时监控： `bambu-cli watch --interval 5`
- 启动打印： `bambu-cli print start <file.3mf|file.gcode> --plate 1`
- 暂停/恢复/停止： `bambu-cli print pause|resume|stop`
- 拍摄摄像头快照： `bambu-cli camera snapshot --out snapshot.jpg`

## 任务指导
### 设置与配置
- 使用 `config set/list/get/remove` 管理配置文件。
- 在脚本中使用环境变量避免命令行标志：`BAMBU_PROFILE`, `BAMBU_IP`, `BAMBU_SERIAL`, `BAMBU_ACCESS_CODE_FILE`, `BAMBU_TIMEOUT`, `BAMBU_NO_CAMERA`, `BAMBU_MQTT_PORT`, `BAMBU_FTP_PORT`, `BAMBU_CAMERA_PORT`。
- 注意配置文件位置：用户级 `~/.config/bambu/config.json`，项目级 `./.bambu.json`。

### 监控
- 使用 `status` 获取一次性快照；使用 `watch` 获取周期性更新（`--interval`, `--refresh`）。
- 使用 `--json`/`--plain` 进行脚本化调用。

### 打印
- 使用 `print start <file>` 并配合 `.3mf` 或 `.gcode`。
- 使用 `--plate <n|path>` 选择 3mf 文件内的托盘编号或 G-code 路径。
- 仅当文件已存在于打印机上时才使用 `--no-upload`；不得将其与 `.gcode` 输入一起使用。
- 控制 AMS：`--no-ams`, `--ams-mapping "0,1"`, `--skip-objects "1,3"`。
- 如用户要求，使用 `--flow-calibration=false` 禁用流量校准。

### 文件与摄像头
- 使用 `files list [--dir <path>]`, `files upload <local> [--as <remote>]`。
- 使用 `files download <remote> --out <path|->`；使用 `--force` 允许向 TTY 写入二进制数据。
- `files delete <remote>` 仅可在获得确认后使用。
- 使用 `camera snapshot --out <path|->`；使用 `--force` 允许向 TTY 输出 stdout。

### 运动、温度、风扇与灯光
- 使用 `home`, `move z --height <0-256>`。
- 使用 `temps get|set`（`--bed`, `--nozzle`, `--chamber`；至少需指定一项）。
- 使用 `fans set` 并配合 `--part/--aux/--chamber` 值 `0-255` 或 `0-1`。
- 使用 `light on|off|status`。

### G-code 与校准
- 使用 `gcode send <line...>` 或 `gcode send --stdin`（需确认；`--no-check` 可跳过验证）。
- 避免同时使用 `--access-code-stdin` 与 `gcode send --stdin`；请改用访问码文件。
- 如有需要，使用 `calibrate` 并配合 `--no-bed-level`, `--no-motor-noise`, `--no-vibration`。

### 故障排查
- 使用 `doctor` 检查与 MQTT/FTPS/摄像头端口的 TCP 连通性；若摄像头端口不可达，建议使用 `--no-camera`。
- 默认端口为：MQTT 8883、FTPS 990、摄像头 6000，除非另行配置。

## 参考资料
请阅读 `references/commands.md` 获取完整的命令与标志参考。