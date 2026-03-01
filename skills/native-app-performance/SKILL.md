---
name: native-app-performance
name_zh: 原生应用性能
description: 通过 xctrace/Time Profiler 对原生 macOS/iOS 应用进行性能分析，并仅使用命令行工具分析 Instruments 的 .trace 文件。当被要求对应用进行性能分析、附加进程、录制或分析 Instruments .trace 文件、定位热点（hotspots）或在不打开 Instruments 图形界面的前提下优化原生应用性能时，请使用本 skill。
description_zh: 通过 xctrace/Time Profiler 对原生 macOS/iOS 应用进行性能分析，并仅使用命令行工具分析 Instruments 的 .trace 文件。当被要求对应用进行性能分析、附加进程、录制或分析 Instruments .trace 文件、定位热点（hotspots）或在不打开 Instruments 图形界面的前提下优化原生应用性能时，请使用本 skill。
---
# 原生应用性能分析（仅限 CLI）

目标：通过 `xctrace` 录制 Time Profiler，提取采样数据，完成符号化（symbolicate），并识别热点（hotspots），全程无需打开 Instruments 图形界面。

## 快速开始（命令行）

1) 录制 Time Profiler（附加到已有进程）：

```bash
# Start app yourself, then attach
xcrun xctrace record --template 'Time Profiler' --time-limit 90s --output /tmp/App.trace --attach <pid>
```

2) 录制 Time Profiler（启动新进程）：

```bash
xcrun xctrace record --template 'Time Profiler' --time-limit 90s --output /tmp/App.trace --launch -- /path/App.app/Contents/MacOS/App
```

3) 提取时间采样数据：

```bash
scripts/extract_time_samples.py --trace /tmp/App.trace --output /tmp/time-sample.xml
```

4) 获取用于符号化的加载地址（load address）：

```bash
# While app is running
vmmap <pid> | rg -m1 "__TEXT" -n
```

5) 符号化 + 排序并列出热点函数：

```bash
scripts/top_hotspots.py --samples /tmp/time-sample.xml \
  --binary /path/App.app/Contents/MacOS/App \
  --load-address 0x100000000 --top 30
```

## 工作流说明

- 务必确认正在分析的目标二进制文件是正确的（本地构建版本 vs /Applications 中的版本）。对于 `--launch`，建议直接指定二进制文件路径。
- 在录制过程中，务必触发待分析的慢路径（例如：菜单展开/收起、刷新操作等）。
- 若调用栈（stacks）为空，请延长录制时间，或避免在空闲时段进行录制。
- `xcrun xctrace help record` 和 `xcrun xctrace help export` 中列出了正确的命令行参数标志。

## 包含的脚本

- `scripts/record_time_profiler.sh`：支持以附加（attach）或启动（launch）方式录制。
- `scripts/extract_time_samples.py`：从 .trace 文件中导出时间采样 XML 数据。
- `scripts/top_hotspots.py`：对应用顶层帧（top app frames）执行符号化并排序。

## 注意事项（Gotchas）

- 由于启用了 ASLR（地址空间布局随机化），必须使用 `vmmap` 中报告的运行时 `__TEXT` 加载地址。
- 若使用新构建的二进制文件，请更新 `--binary` 路径；符号文件必须与 .trace 文件匹配。
- 纯命令行流程：只要通过 `atos` 完成了调用栈符号化，则无需打开 Instruments。