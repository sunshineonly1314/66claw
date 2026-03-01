---
name: pdf-form-filler
name_zh: PDF表单填充
description: 以编程方式向 PDF 表单填充文本值和复选框。当您需要使用数据填充可填写的 PDF 表单（如政府表格、申请表、调查问卷等）时使用。支持设置文本字段和复选框，并为其配置正确的外观状态（appearance states），以确保在 PDF 查看器中正确渲染。
description_zh: 以编程方式向 PDF 表单填充文本值和复选框。当您需要使用数据填充可填写的 PDF 表单（如政府表格、申请表、调查问卷等）时使用。支持设置文本字段和复选框，并为其配置正确的外观状态（appearance states），以确保在 PDF 查看器中正确渲染。
version: 0.2.0
---
# PDF 表单填充器

以编程方式向 PDF 表单填充文本值和复选框。使用 pdfrw 设置表单字段值，同时保留外观流（appearance streams），以确保 PDF 查看器能正确渲染。

## 快速开始

使用字段名与值构成的字典填充 PDF 表单：

```python
from pdf_form_filler import fill_pdf_form

fill_pdf_form(
    input_pdf="form.pdf",
    output_pdf="form_filled.pdf",
    data={
        "Name": "John Doe",
        "Email": "john@example.com",
        "Herr": True,  # Checkbox
        "Dienstreise": True,
    }
)
```

## 功能特性

- **文本字段**：可设置任意文本值（姓名、日期、地址等）
- **复选框**：可设置布尔值（True 表示勾选，False/None 表示未勾选）
- **外观状态**：正确设置 `/On` 和 `/Off` 状态，以保障 PDF 查看器渲染效果
- **保留结构**：不剥离表单功能——填充后的表单仍可进一步编辑
- **无额外依赖**：仅依赖 pdfrw（轻量级、纯 Python 实现）

## 工作原理

1. 打开 PDF 模板  
2. 遍历表单字段  
3. 为匹配字段名的字段设置对应值  
4. 对复选框，同时设置 `/V`（值）和 `/AS`（外观状态）  
5. 保存已填充的 PDF

## 字段名匹配规则

字段名必须与 PDF 表单中实际显示的名称完全一致。常见命名模式如下：

- 德语表单：`Herr`, `Frau`, `Dienstreise`, `Geschäftsnummer LfF`  
- 英语表单：`Full Name`, `Email`, `Agree`, `Submit`  
- 日期字段：`Date`, `DOB`, `Start Date`  

如需探查 PDF 中的实际字段名，请使用 `list_pdf_fields()`：

```python
from pdf_form_filler import list_pdf_fields

fields = list_pdf_fields("form.pdf")
for field_name, field_type in fields:
    print(f"{field_name}: {field_type}")
```

字段类型说明：
- `text`：文本输入字段  
- `checkbox`：布尔型复选框  
- `radio`：单选按钮  
- `dropdown`：下拉选择框  
- `signature`：签名字段  

## 示例：求职申请表

```python
fill_pdf_form(
    input_pdf="job_application.pdf",
    output_pdf="job_application_filled.pdf",
    data={
        "Full Name": "Jane Smith",
        "Email": "jane.smith@example.com",
        "Phone": "555-1234",
        "Position": "Software Engineer",
        "Years Experience": "5",
        
        # Checkboxes
        "Willing to relocate": True,
        "Available immediately": False,
        "Background check consent": True,
    }
)
```

## 高级用法

### 局部填充（Partial fills）

仅填充特定字段，其余字段留空：

```python
data = {"Name": "Jane Doe"}  # Only Name is set
fill_pdf_form("form.pdf", "form_filled.pdf", data)
```

### 动态字段识别

获取全部字段并交互式提示输入值：

```python
from pdf_form_filler import list_pdf_fields

fields = list_pdf_fields("form.pdf")
data = {}
for field_name, field_type in fields:
    if field_type == "text":
        data[field_name] = input(f"Enter {field_name}: ")
    elif field_type == "checkbox":
        data[field_name] = input(f"Check {field_name}? (y/n): ").lower() == 'y'

fill_pdf_form("form.pdf", "form_filled.pdf", data)
```

### 批量填充（Batch fills）

使用相同数据批量填充多个 PDF 文件：

```python
import os
from pdf_form_filler import fill_pdf_form

data = {"Name": "John Doe", "Date": "2026-01-24"}

for filename in os.listdir("forms/"):
    if filename.endswith(".pdf"):
        fill_pdf_form(
            f"forms/{filename}",
            f"forms_filled/{filename}",
            data
        )
```

## 故障排查

### 复选框未视觉呈现

部分 PDF 查看器不会立即渲染复选框。虽然值已正确设置（`/On` 或 `/Off`），但外观状态未重新生成。建议尝试以下查看器：
- Adobe Reader（将自动渲染）  
- Firefox（表单支持更佳）  
- Linux 下的 evince 或 okular（通常可正常工作）

### 未找到字段名

请使用 `list_pdf_fields()` 确认字段名是否完全准确。PDF 表单字段命名可能较复杂：
- 某些表单使用非描述性名称（例如 `Field_1` 而非语义化名称）  
- 某些表单存在嵌套字段结构  

### 文本被截断

某些 PDF 的文本字段宽度较窄。可采取以下任一措施：
1. 使用更短的值  
2. 在 PDF 模板中减小字体大小  
3. 填充后手动编辑  

## 内置脚本

详见 `scripts/fill_pdf_form.py`，其中提供了基于 pdfrw 的完整实现。