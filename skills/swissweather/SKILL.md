---
name: swissweather
name_zh: 瑞士天气
description: 从 MeteoSwiss（瑞士官方气象服务机构）获取当前天气与预报。适用于查询瑞士天气数据、本地瑞士气象站实测数据或瑞士专属天气预报。提供来自 100 多个瑞士气象站的实时实测数据（温度、湿度、风、降水、气压），以及按邮政编码划分的多日天气预报。专为瑞士地区优化——相比通用天气服务，在瑞士境内精度更高。
description_zh: 从 MeteoSwiss（瑞士官方气象服务机构）获取当前天气与预报。适用于查询瑞士天气数据、本地瑞士气象站实测数据或瑞士专属天气预报。提供来自 100 多个瑞士气象站的实时实测数据（温度、湿度、风、降水、气压），以及按邮政编码划分的多日天气预报。专为瑞士地区优化——相比通用天气服务，在瑞士境内精度更高。
---
# SwissWeather

从瑞士联邦气象与气候办公室（MeteoSwiss）获取当前天气实测数据与天气预报。

## 为何选用本 skill

- **官方瑞士数据**：直接源自 MeteoSwiss 政府服务  
- **真实测量值**：覆盖瑞士全境的 100 多个自动化气象站  
- **无需 API 密钥**：完全免费的公开数据  
- **瑞士专属优化**：在瑞士境内覆盖更广、精度更高，优于通用天气服务  
- **全面指标**：涵盖温度、湿度、风、降水、气压、日照、辐射等  

## 快速开始

### 按测站获取当前天气

获取特定瑞士气象站的实时实测数据：

**选项 1：Shell 脚本（无需依赖）**  
```bash
scripts/current_weather_curl.sh --station RAG
```  

**选项 2：Python 脚本（需安装：pip3 install requests）**  
```bash
scripts/current_weather.py --station RAG
```  

示例输出：  
```
Station: RAG
Time: 2026-01-15 11:40 UTC
Temperature (°C)........................ 8.6
Rel. humidity (%)...................... 56.3
Wind speed (km/h)...................... 6.8
Precipitation (mm)..................... 0.0
```  

常用测站：  
- **RAG** —— 拉珀斯维尔（苏黎世地区）  
- **BER** —— 伯尔尼  
- **ZRH** —— 苏黎世机场  
- **BAS** —— 巴塞尔  
- **GVE** —— 日内瓦  
- **LUG** —— 卢加诺  

### 列出全部测站

```bash
scripts/current_weather_curl.sh --list
# or
scripts/current_weather.py --list
```  

返回 100 多个瑞士气象站及其代码与最后更新时间。

### 按邮政编码获取天气预报

获取多日天气预报：

```bash
scripts/forecast.py 8640            # Rapperswil-Jona
scripts/forecast.py 8001 --days 7   # Zurich, 7-day forecast
```  

**注意**：预报 API 偶尔可能不稳定。若调用失败，请回退至当前天气实测数据。

## 可用数据

### 当前天气实测数据

每 10 分钟由自动化测站更新：

- **温度（°C）** —— 2 米高度气温  
- **湿度（%）** —— 相对湿度  
- **风** —— 风速（km/h）、风向（°）、阵风峰值  
- **降水（mm）** —— 最近降雨量  
- **气压（hPa）** —— 测站气压、海平面气压  
- **日照（分钟）** —— 日照持续时间  
- **辐射（W/m²）** —— 全球太阳辐射量  
- **露点（°C）**  

### 天气预报

按瑞士邮政编码提供的多日天气预报：

- 每日气温（最低/最高）  
- 天气状况及对应图标  
- 降水量与降水概率  
- 小时级预报（如可用）  

## 测站选择

请选择离您所在地最近的测站：

- **主要城市**：BER（伯尔尼）、ZRH（苏黎世）、BAS（巴塞尔）、GVE（日内瓦）、LUG（卢加诺）  
- **苏黎世地区**：KLO（克洛滕）、RAG（拉珀斯维尔）、TAE（泰尼孔）  
- **中部地区**：LUZ（卢塞恩）、ALT（阿尔特多夫）、ENG（恩格尔贝格）  
- **山地测站**：SMA（桑蒂斯山）、JUN（少女峰）、PIL（皮拉图斯山）  

**提示**：因海拔差异显著，山谷地区请避免选用山地测站。

完整测站列表及详情请参见 `references/api_info.md`。

## JSON 输出

所有脚本均支持 `--json` 参数，便于程序化调用：

```bash
scripts/current_weather.py --station RAG --json
scripts/forecast.py 8640 --json
```

## 高级用法

### 多测站查询

显示所有测站当前实测数据：

```bash
scripts/current_weather.py --all
```

### 查找最近测站

1. 列出全部测站：`scripts/current_weather.py --list`  
2. 根据名称或地理位置识别最近测站  
3. 使用该测站代码进行查询  

### 缓存策略

数据每 10 分钟更新一次，请合理设置缓存：

```bash
# Cache current weather for 5-10 minutes
# Cache forecasts for 1-2 hours
```

## API 参考

详见 `references/api_info.md`：  
- 完整 API 文档  
- 所有可用数据字段说明  
- 天气图标代码对照表  
- 预警等级与类型定义  
- 替代数据源清单  
- 技术细节说明  

## 依赖项

```bash
pip3 install requests
```

## 数据来源

- **提供方**：MeteoSwiss（瑞士联邦气象与气候办公室）  
- **权威性**：瑞士政府官方天气服务机构  
- **更新频率**：每 10 分钟（当前天气）  
- **覆盖范围**：瑞士境内 100 多个自动化气象站  
- **URL**：https://data.geo.admin.ch / https://www.meteoschweiz.admin.ch  

## 故障排除

**预报 API 失败**：MeteoSwiss App API 偶尔会发生变更。若 `forecast.py` 调用失败，请改用当前天气实测数据，或查阅 `references/api_info.md` 获取替代方案。

**测站未找到**：运行 `--list` 查看可用测站列表。测站代码为三位字母缩写（不区分大小写）。

**数据缺失**：部分测站未采集全部参数。请留意输出中的 `-` 或 `N/A` 标记。

## 相关 skill

- **swiss-transport**：瑞士公共交通时刻表与换乘信息  
- **weather**：通用天气服务（wttr.in）——在瑞士境内请优先使用 swissweather  