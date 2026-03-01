---
name: mineru-pdf
name_zh: Mineru PDF解析技能
description: 使用 MinerU 在本地（CPU）将 PDF 解析为 Markdown/JSON。假定 MinerU 为每份文档创建独立输出文件夹；支持表格与图像提取。
description_zh: 使用 MinerU 在本地（CPU）将 PDF 解析为 Markdown/JSON。假定 MinerU 为每份文档创建独立输出文件夹；支持表格与图像提取。
---
# MinerU PDF

## 概述
使用 MinerU（CPU）在本地解析 PDF。默认输出为 Markdown + JSON。仅在明确请求时启用表格与图像提取。

## 快速入门（单个 PDF）
```bash
# Run from the skill directory
./scripts/mineru_parse.sh /path/to/file.pdf
```

可选示例：
```bash
./scripts/mineru_parse.sh /path/to/file.pdf --format json
./scripts/mineru_parse.sh /path/to/file.pdf --tables --images
```

## 何时查阅参考文档
若命令行参数与您所用封装器不一致，或需调整高级默认值（后端/方法/设备/线程数/格式映射），请参阅：
- `references/mineru-cli.md`

## 输出约定
- 输出根目录默认为 `./mineru-output/`。
- MinerU 将在输出根目录下为每份文档创建独立子文件夹（例如：`./mineru-output/<basename>/...`）。

## 批处理
默认仅支持单 PDF 解析。仅当明确要求时，才实现文件夹批量解析。