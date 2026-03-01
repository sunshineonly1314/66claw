---
name: shorten
name_zh: 网址缩短
description: 使用 is.gd（无需认证）缩短 URL。返回永久性短链接。
description_zh: 使用 is.gd（无需认证）缩短 URL。返回永久性短链接。
---
# 缩短链接（Shorten）

使用 [is.gd](https://is.gd) 服务快速缩短 URL。无需 API 密钥或账户。

## 使用方法（Usage）

```bash
/home/art/clawd/skills/shorten/shorten.sh "https://example.com/very/long/url"
```

## 示例（Examples）

**标准用法：**  
```bash
shorten "https://google.com"
# Output: https://is.gd/O5d2Xq
```

**自定义别名（若后续脚本扩展支持）：**  
当前仅支持基础缩短功能。

## 注意事项（Notes）
- 链接为永久性链接。  
- 不提供分析仪表板（仅为简单重定向）。  
- 存在速率限制（请合理使用）。  