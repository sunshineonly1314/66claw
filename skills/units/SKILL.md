---
name: units
name_zh: 单位换算
description: 使用 GNU Units 执行单位换算与计算。
description_zh: 使用 GNU Units 执行单位换算与计算。
metadata: {"clawdbot":{"emoji":"📏","requires":{"bins":["units"]}}}
---
# GNU Units skill

使用 GNU `units` 通过命令行执行单位换算与计算。可通过 brew 和 apt（软件包名为 “units”）安装。

## 使用方法

使用 `bash` 工具运行 `units` 命令。使用 `-t`（简洁）标志仅获取纯数字结果。

```bash
units -t 'from-unit' 'to-unit'
```

### 示例

**基础换算：**  
```bash
units -t '10 kg' 'lbs'
# Output: 22.046226
```

**复合单位：**  
```bash
units -t '60 miles/hour' 'm/s'
# Output: 26.8224
```

**温度（非线性）：**  
温度换算需使用特定语法：`tempF(x)`、`tempC(x)`、`tempK(x)`。  
```bash
units -t 'tempF(98.6)' 'tempC'
# Output: 37
```

**时间：**  
```bash
units -t '2 weeks' 'seconds'
```

**输出四舍五入：**  
如需将结果四舍五入至指定小数位（例如 3 位），请使用 `-o "%.3f"`：  
```bash
units -t -o "%.3f" '10 kg' 'lbs'
# Output: 22.046
```

**单位定义查询：**  
如需查看某单位的定义（不进行换算），请省略第二个参数（不加 `-t` 的输出更详细，更适合查定义）：  
```bash
units '1 acre'
```

## 注意事项

- **货币：** `units` 支持货币单位（USD、EUR 等），但汇率可能过时，因其静态存储于定义文件中。
- **安全性：** 始终用引号包裹单位，以防 shell 展开问题（例如 `units -t '1/2 inch' 'mm'`）。