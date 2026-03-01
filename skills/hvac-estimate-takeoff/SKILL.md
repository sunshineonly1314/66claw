---
name: hvac-estimate-takeoff
description: hvac-estimate-takeoff skill
description_zh: hvac-estimate-takeoff skill
---
name: hvac_estimate_takeoff
description: 从 PDF 图纸中进行 HVAC 工程量计算（设备数量统计与明细表）
trigger: file_upload
file_types: [pdf]
tools:
  - pymupdf-pdf
output: table