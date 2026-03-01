---
name: printer
name_zh: 打印机
description: 通过 macOS 上的 CUPS 管理打印机（发现、添加、打印、队列、状态、唤醒）
description_zh: 通过 macOS 上的 CUPS 管理打印机（发现、添加、打印、队列、状态、唤醒）
metadata: {"clawdbot":{"emoji":"🖨️","os":["darwin"],"requires":{"bins":["lp","lpstat","lpadmin"]}}}
---
# Printer（打印机）（CUPS）

使用 macOS 内置 CUPS 命令控制打印机。无需额外 CLI 工具。

## 发现打印机

```bash
# Network printers (Bonjour/AirPrint)
dns-sd -B _ipp._tcp . 2>/dev/null & sleep 3; kill $! 2>/dev/null

# Get printer details (host, port, resource path)
dns-sd -L "Printer Name" _ipp._tcp . 2>/dev/null & sleep 3; kill $! 2>/dev/null

# CUPS-native discovery
lpstat -e                         # available network destinations
lpinfo --include-schemes dnssd -v # dnssd backends

# IPP discovery
ippfind --timeout 5
```

## 添加打印机（免驱动 IPP Everywhere 方式）

```bash
# Recommended: driverless queue
lpadmin -p MyPrinter -E -v "ipp://printer.local:631/ipp/print" -m everywhere

# Set as default
lpadmin -d MyPrinter

# Enable SNMP supply reporting (toner levels)
sudo lpadmin -p MyPrinter -o cupsSNMPSupplies=true
```

## 打印文件

```bash
lp filename.pdf                      # to default printer
lp -d MyPrinter filename.pdf         # specific printer
lp -d MyPrinter -n 2 file.pdf        # 2 copies
lp -d MyPrinter -o sides=two-sided-long-edge file.pdf  # duplex
lp -d MyPrinter -o media=letter file.pdf
lp -d MyPrinter -o ColorModel=Gray file.pdf  # grayscale

# Print text directly
echo "Hello World" | lp -d MyPrinter
```

## 打印队列管理

```bash
# Check status
lpstat -p MyPrinter        # printer status
lpstat -o MyPrinter        # queued jobs
lpstat -t                  # everything
lpq -P MyPrinter           # BSD-style queue view

# Cancel jobs
cancel JOB_ID
cancel -a MyPrinter        # cancel all

# Enable/disable
cupsenable MyPrinter       # resume printing
cupsdisable MyPrinter      # pause printer
cupsaccept MyPrinter       # accept new jobs
cupsreject MyPrinter       # reject new jobs
```

## 打印机选项设置

```bash
# List available options for a printer
lpoptions -p MyPrinter -l

# Set default options (per-user)
lpoptions -p MyPrinter -o sides=two-sided-long-edge

# Set server-side defaults
sudo lpadmin -p MyPrinter -o sides-default=two-sided-long-edge
```

## 状态与诊断

```bash
# IPP status query (detailed)
ipptool -t ipp://PRINTER_IP/ipp/print get-printer-attributes.test

# Filter for key info
ipptool -t ipp://PRINTER_IP/ipp/print get-printer-attributes.test \
  | grep -iE 'printer-state|marker|supply|media|error'
```

## 从休眠状态唤醒打印机

```bash
# IPP poke (usually wakes the printer)
ipptool -q -T 5 ipp://PRINTER_IP/ipp/print get-printer-attributes.test

# HTTP poke (wakes web UI stack)
curl -s -m 5 http://PRINTER_IP/ >/dev/null

# TCP connect test
nc -zw2 PRINTER_IP 631
```

## 保持活跃（防止深度休眠）

```bash
# Poll every 5 minutes (runs in foreground)
ipptool -q -T 3 -i 300 ipp://PRINTER_IP/ipp/print get-printer-attributes.test
```

如需持久化保持活跃，请创建一个 launchd agent。

## 通过 SNMP 查询墨粉余量

需启用 `brew install net-snmp`：

```bash
snmpwalk -v2c -c public PRINTER_IP 1.3.6.1.2.1.43.11.1.1
```

注意：打印机可能已禁用 SNMP。请检查其远程 Web UI 中的相关设置。

## 远程 Web UI（网页界面）

大多数网络打印机在 `http://PRINTER_IP/` 地址提供 Web UI，用于：
- 休眠/定时设置（设置 > 定时设置 > 自动休眠时间）  
- 网络协议配置（启用/禁用 IPP、SNMP、原始端口 9100）  
- 耗材状态查询  

## 故障排查

```bash
# Printer stuck/disabled? Re-enable it
cupsenable MyPrinter

# Check device URI
lpstat -v MyPrinter

# Remove and re-add printer
lpadmin -x MyPrinter
lpadmin -p MyPrinter -E -v "ipp://..." -m everywhere

# CUPS error log
tail -f /var/log/cups/error_log
```

## 注意事项

- 优先选用 `ipp://` 或 `ipps://` URI，而非原始端口 9100 或 LPD  
- `-m everywhere` 可依据打印机的 IPP 功能自动完成配置  
- 打印机型号不同，选项名称各异；请使用 `lpoptions -l` 命令发现可用选项  
- 休眠设置建议通过打印机的远程 Web UI 进行配置  
- 自动休眠（默认 1 分钟）可维持服务运行——打印任务会自动唤醒打印机  
- **若打印机完全无响应**（IPP 端口关闭、HTTP 超时），则很可能处于深度休眠或已关机。请提示用户进行物理检查或手动唤醒打印机  