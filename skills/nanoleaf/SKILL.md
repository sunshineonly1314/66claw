---
name: nanoleaf
name_zh: Nanoleaf
description: 通过 Picoleaf CLI 控制 Nanoleaf 灯板。可用于开启/关闭 Nanoleaf、调节亮度、设置颜色（RGB/HSL）、调整色温，或执行任意 Nanoleaf 灯光控制操作。
description_zh: 通过 Picoleaf CLI 控制 Nanoleaf 灯板。可用于开启/关闭 Nanoleaf、调节亮度、设置颜色（RGB/HSL）、调整色温，或执行任意 Nanoleaf 灯光控制操作。
homepage: https://github.com/tessro/picoleaf
metadata: {"clawdbot":{"emoji":"🌈","requires":{"bins":["picoleaf"]},"install":[{"id":"brew","kind":"brew","tap":"paulrosania/command-home","formula":"paulrosania/command-home/picoleaf","bins":["picoleaf"],"label":"安装 Picoleaf CLI（brew）"},{"id":"binary","kind":"download","command":"curl -sL https://github.com/tessro/picoleaf/releases/latest/download/picoleaf_1.4.0_linux_amd64.tar.gz | tar xz -C ~/.local/bin","bins":["picoleaf"],"label":"安装 Picoleaf（二进制）"}]}}
---
# Picoleaf CLI

使用 `picoleaf` 控制 Nanoleaf 灯板。

设置步骤  
1. 查找 Nanoleaf IP 地址：检查路由器，或使用 mDNS：`dns-sd -Z _nanoleafapi`  
2. 生成 token：长按电源按钮 5–7 秒直至 LED 闪烁，然后在 30 秒内运行：  
   `curl -iLX POST http://<ip>:16021/api/v1/new`  
3. 创建配置文件 `~/.picoleafrc`：  
   ```ini
   host=<ip>:16021
   access_token=<token>
   ```  

开关控制  
- `picoleaf on` — 开启  
- `picoleaf off` — 关闭  

亮度  
- `picoleaf brightness <0-100>` — 设置亮度百分比  

颜色  
- `picoleaf rgb <r> <g> <b>` — 设置 RGB 颜色（各通道取值范围：0–255）  
- `picoleaf hsl <hue> <sat> <light>` — 设置 HSL 颜色  
- `picoleaf temp <1200-6500>` — 设置色温（单位：开尔文，Kelvin）  

示例  
- 暖色调微光：`picoleaf on && picoleaf brightness 30 && picoleaf temp 2700`  
- 明亮蓝色：`picoleaf on && picoleaf brightness 100 && picoleaf rgb 0 100 255`  
- 关闭灯光：`picoleaf off`  

注意事项  
- 默认端口为 16021  
- 生成 token 需要物理接触 Nanoleaf 控制器  
- 可使用 `&&` 连续执行多个命令