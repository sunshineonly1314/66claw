---
name: travel-concierge
name_zh: 旅行管家
description: 查找住宿房源（Airbnb、Booking.com、VRBO、Expedia）的联系方式
description_zh: 查找住宿房源（Airbnb、Booking.com、VRBO、Expedia）的联系方式
version: 1.0.0
triggers:
  - find contact
  - hotel contact
  - accommodation contact
  - property contact
  - airbnb contact
  - booking contact
  - vrbo contact
  - expedia contact
  - direct booking
  - property email
  - property phone
---
# 旅行管家

查找住宿房源的联系方式（电话、邮箱、WhatsApp、Instagram 等），以支持直接预订。

## 使用方法

当用户提供预订网址，或请求查找某住宿房源的联系方式时：

1. 运行 CLI 提取联系信息：
   ```bash
   travel-concierge find-contact "<url>"
   ```

2. 向用户提供完整联系档案，涵盖所有已发现的联系方式。

## 支持平台

- **Airbnb**：`airbnb.com/rooms/...`
- **Booking.com**：`booking.com/hotel/...`
- **VRBO**：`vrbo.com/...`
- **Expedia**：`expedia.com/...Hotel...`

## 示例

### 查找 Airbnb 房源的联系方式
用户：“查找此 Airbnb 房源的联系方式：https://www.airbnb.com/rooms/12345”  
操作：运行 `travel-concierge find-contact "https://www.airbnb.com/rooms/12345"`

### 查找 Booking.com 酒店的联系方式
用户：“我如何直接联系这家酒店？”（附 Booking.com 网址）  
操作：运行 `travel-concierge find-contact "<booking-url>"`

### 供脚本调用的 JSON 输出
```bash
travel-concierge find-contact --json "https://..."
```

### 显示搜索进度的详细输出
```bash
travel-concierge find-contact --verbose "https://..."
```

## 配置说明

该工具无需 API 密钥，通过网页抓取即可运行。如需增强结果质量，可配置以下可选 API：

```bash
# Set Google Places API key for verified phone/website data
travel-concierge config set googlePlacesApiKey "your-key"

# View current config
travel-concierge config show
```

## 输出格式

CLI 返回的联系档案包含：
- **房源信息**：名称、所属平台、地理位置、房东姓名
- **联系方式**：
  - 电话号码
  - 电子邮箱地址
  - WhatsApp（如可用）
  - Instagram 主页
  - Facebook 页面
  - 官方网站
  - Google 地图链接
- **信息来源**：每项联系信息的出处及其可信度等级

## 注意事项

- 本工具仅提取公开可获取的信息
- 对于 JavaScript 渲染的房源页面，可能需要借助浏览器自动化（通过 `agent-browser`）完成抓取
- 部分平台对爬虫限制严格，结果可能存在差异
- 如已配置 Google Places API，则其提供的联系信息最为可靠