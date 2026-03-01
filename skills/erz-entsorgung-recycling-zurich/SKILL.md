---
name: openerz
name_zh: 苏黎世ERZ回收
description: 通过 OpenERZ API 获取苏黎世地区垃圾清运日历。当用户询问苏黎世地区的垃圾、纸板、纸张、有机垃圾、特殊废弃物或清运时间时使用。
description_zh: 通过 OpenERZ API 获取苏黎世地区垃圾清运日历。当用户询问苏黎世地区的垃圾、纸板、纸张、有机垃圾、特殊废弃物或清运时间时使用。
---
# OpenERZ – 苏黎世垃圾清运日历

苏黎世地区垃圾清运时间查询 API。

## 用户默认设置

- 地区：`zurich`  
- 区域/邮编：`8003`

## API 端点

```
https://openerz.metaodi.ch/api/calendar
```

## 参数

| 参数 | 描述 | 示例 |
|-----------|--------------|----------|
| `region` | 地区（苏黎世市始终为 `zurich`） | `zurich` |
| `area` | 邮编或区域 | `8003` |
| `types` | 逗号分隔列表：waste, cardboard, paper, organic, special, mobile, incombustibles, chipping, metal, etram, cargotram, textile | `paper,cardboard` |
| `start` | 开始日期（YYYY-MM-DD） | `2026-01-14` |
| `end` | 结束日期（YYYY-MM-DD） | `2026-01-31` |
| `sort` | 排序方式（date, -date） | `date` |
| `limit` | 最大返回结果数 | `10` |

## 废弃物类型

| 类型 | 描述 |
|-----|--------------|
| `waste` | 垃圾（普通生活垃圾） |
| `cardboard` | 纸板 |
| `paper` | 纸张 |
| `organic` | 有机垃圾/厨余垃圾 |
| `special` | 特殊废弃物（集中收集点） |
| `mobile` | 移动式特殊废弃物收集 |
| `incombustibles` | 不可燃垃圾 |
| `chipping` | 碎枝服务 |
| `metal` | 废金属 |
| `etram` | 电动有轨电车（E-Tram）回收 |
| `cargotram` | 货运有轨电车（Cargo-Tram）回收 |
| `textile` | 纺织品 |

## 示例请求

最近的清运安排：
```bash
curl "https://openerz.metaodi.ch/api/calendar?region=zurich&area=8003&start=$(date +%Y-%m-%d)&limit=5&sort=date"
```

仅查询纸张/纸板：
```bash
curl "https://openerz.metaodi.ch/api/calendar?region=zurich&area=8003&types=paper,cardboard&start=$(date +%Y-%m-%d)&limit=5"
```

## 响应格式

```json
{
  "_metadata": {"total_count": 5, "row_count": 5},
  "result": [
    {
      "date": "2026-01-15",
      "waste_type": "waste",
      "zip": 8003,
      "area": "8003",
      "station": "",
      "region": "zurich",
      "description": ""
    }
  ]
}
```

当响应中包含 `mobile` 或 `special` 字段时，`station` 表示收集地点。