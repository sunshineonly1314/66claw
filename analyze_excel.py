#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Excel 文件分析脚本 - 演示 OpenClawCN 表格处理能力
"""

import pandas as pd
import sys
import json

def analyze_excel(file_path):
    """分析 Excel 文件并生成结构化报告"""

    try:
        # 读取 Excel 文件
        df = pd.read_excel(file_path)

        # 基本信息
        basic_info = {
            "文件路径": file_path,
            "数据维度": f"{df.shape[0]} 行 × {df.shape[1]} 列",
            "列名": list(df.columns),
            "内存占用": f"{df.memory_usage(deep=True).sum() / 1024:.2f} KB"
        }

        # 数据类型分析
        dtype_summary = df.dtypes.value_counts().to_dict()
        dtype_info = {str(k): int(v) for k, v in dtype_summary.items()}

        # 缺失值分析
        missing_info = df.isnull().sum()
        missing_cols = {col: int(count) for col, count in missing_info.items() if count > 0}

        # 数值列统计
        numeric_cols = df.select_dtypes(include=['int64', 'float64']).columns
        numeric_summary = {}
        for col in numeric_cols:
            numeric_summary[col] = {
                "均值": float(df[col].mean()) if pd.notna(df[col].mean()) else None,
                "中位数": float(df[col].median()) if pd.notna(df[col].median()) else None,
                "标准差": float(df[col].std()) if pd.notna(df[col].std()) else None,
                "最小值": float(df[col].min()) if pd.notna(df[col].min()) else None,
                "最大值": float(df[col].max()) if pd.notna(df[col].max()) else None,
                "唯一值数量": int(df[col].nunique())
            }

        # 文本列分析
        text_cols = df.select_dtypes(include=['object']).columns
        text_summary = {}
        for col in text_cols:
            top_values = df[col].value_counts().head(5)
            text_summary[col] = {
                "唯一值数量": int(df[col].nunique()),
                "最常见值": {str(k): int(v) for k, v in top_values.items()}
            }

        # 数据预览
        preview_data = df.head(10).to_dict(orient='records')

        # 生成完整报告
        report = {
            "基本信息": basic_info,
            "数据类型分布": dtype_info,
            "缺失值情况": missing_cols if missing_cols else "无缺失值",
            "数值列统计": numeric_summary,
            "文本列分析": text_summary,
            "数据预览（前10行）": preview_data
        }

        return report

    except Exception as e:
        return {"错误": str(e)}


if __name__ == "__main__":
    file_path = r"C:\Users\72793\Desktop\11111.xls"

    print("=" * 80)
    print("OpenClawCN Excel 文件分析报告")
    print("=" * 80)

    report = analyze_excel(file_path)

    # 美化输出
    print(json.dumps(report, ensure_ascii=False, indent=2))

    print("\n" + "=" * 80)
    print("分析完成")
    print("=" * 80)
