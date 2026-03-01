---
name: instruments-profiling
name_zh: 性能分析
description: 在使用 Instruments/xctrace 对原生 macOS 或 iOS 应用进行性能分析时使用。涵盖正确二进制文件的选择、CLI 参数、导出方法及常见陷阱。
description_zh: 在使用 Instruments/xctrace 对原生 macOS 或 iOS 应用进行性能分析时使用。涵盖正确二进制文件的选择、CLI 参数、导出方法及常见陷阱。
metadata:
  short-description: macOS/iOS 应用的 Instruments 性能分析
---
# Instruments 性能分析（macOS/iOS）

当用户希望对原生应用进行性能分析或调用栈分析时，请使用此 skill。  
重点：时间分析器（Time Profiler）、`xctrace` CLI，以及正确选择二进制文件/应用实例。

## 快速入门（CLI）

- 列出模板：`xcrun xctrace list templates`  
- 录制时间分析器（启动模式）：  
  - `xcrun xctrace record --template 'Time Profiler' --time-limit 60s --output /tmp/App.trace --launch -- /path/To/App.app`  
- 录制时间分析器（附加模式）：  
  - 自行启动应用，获取其进程 ID（PID），然后执行：  
  - `xcrun xctrace record --template 'Time Profiler' --time-limit 60s --output /tmp/App.trace --attach <pid>`  
- 在 Instruments 中打开 trace 文件：  
  - `open -a Instruments /tmp/App.trace`  

注意：`xcrun xctrace --help` 并非有效子命令。请使用 `xcrun xctrace help record`。

## 正确选择二进制文件（关键）

**陷阱：Instruments 可能分析了错误的应用**（例如位于 `/Applications` 中的应用），原因在于 LaunchServices 解析到了另一个 bundle。  
请遵循以下规则：

- 优先使用直接二进制路径以确保确定性启动：  
  - `xcrun xctrace record ... --launch -- /path/App.app/Contents/MacOS/App`  
- 若启动 `.app`，请确保其为目标 bundle：  
  - `open -n /path/App.app`  
  - 使用 `ps -p <pid> -o comm= -o command=` 进行验证  
- 若同时存在 `/Applications/App.app` 和本地构建版本，请显式指定本地构建路径。  
- 启动后，在信任 trace 数据前，请先确认进程路径。

## 命令参数（xctrace）

- `--template 'Time Profiler'`：来自 `xctrace list templates` 的模板名称。  
- `--launch -- <cmd>`：`--` 之后的所有内容均为目标命令（二进制文件或应用 bundle）。  
- `--attach <pid|name>`：附加至正在运行的进程。  
- `--output <path>`：`.trace` 输出。若未指定，则文件保存于当前工作目录（CWD）。  
- `--time-limit 60s|5m`：设置采集持续时间。  
- `--device <name|UDID>`：iOS 设备运行所必需。  
- `--target-stdout -`：将已启动进程的标准输出（stdout）流式传输至终端（对 CLI 工具非常有用）。

## 导出调用栈（CLI）

- 检查 trace 表格：  
  - `xcrun xctrace export --input /tmp/App.trace --toc`  
- 导出原始时间分析样本：  
  - `xcrun xctrace export --input /tmp/App.trace --xpath '/trace-toc/run[@number="1"]/data/table[@schema="time-profile"]' --output /tmp/time-profile.xml`  
- 在脚本（Python/Rust）中进行后处理，以聚合调用栈。

## Instruments 图形界面（UI）工作流程

- 模板：时间分析器（Time Profiler）  
- 使用“录制”功能捕获慢路径（启动阶段 vs 稳态运行）  
- 调用树（Call Tree）使用技巧：  
  - 隐藏系统库（Hide System Libraries）  
  - 反转调用树（Invert Call Tree）  
  - 按线程分离（Separate by Thread）  
  - 关注热点帧（hot frames）和调用次数

## 常见陷阱与修复方案

- **分析了错误的应用**：LaunchServices 解析了已安装应用而非本地构建版本。  
  - 修复：使用直接二进制路径，或使用已知 PID 的 `--attach` 进行附加。  
- **无采样数据 / trace 为空**：应用快速退出，或从未执行实际工作。  
  - 修复：延长采集时间，并在录制过程中主动触发工作负载。  
- **隐私提示弹窗**：`xctrace` 可能需要开发者工具权限。  
  - 修复：前往“系统设置 → 隐私与安全性 → 开发者工具”，允许 Terminal/Xcode。  
- **大型 XML 导出文件**：`time-profile` 导出文件体积巨大。  
  - 修复：使用 XPath 过滤并在离线状态下聚合；切勿直接打印至终端。

## iOS 特定说明

- 设备端：使用 `xcrun xctrace list devices` 和 `--device <UDID>`。  
- 如有需要，可通过 Xcode 启动应用；使用 `xctrace --attach` 进行附加。  
- 确保具备调试符号（debug symbols），以获得有意义的调用栈。

## 验证检查清单

- 确认 trace 进程路径与目标构建版本一致。  
- 确认调用栈显示预期的应用帧。  
- 确认采集覆盖了慢操作（如启动/刷新）。  
- 如需优化，导出调用栈以供自动化比对。