#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenClawCN 表格分析演示
将 XLS 文件转换为 CSV 并生成分析报告
"""

import pandas as pd
import warnings
import json
import os

warnings.filterwarnings('ignore')

def main():
    file_path = r'C:\Users\72793\Desktop\11111.xls'

    print("=" * 80)
    print("OpenClawCN 表格数据分析系统")
    print("=" * 80)
    print(f"\n正在分析文件: {file_path}")

    # 读取 Excel 文件（.xls 格式使用 xlrd 引擎）
    try:
        df = pd.read_excel(file_path, engine='xlrd')
        print("[OK] 使用 xlrd 引擎读取成功")
    except:
        try:
            df = pd.read_excel(file_path, engine='openpyxl')
            print("[OK] 使用 openpyxl 引擎读取成功")
        except:
            try:
                df = pd.read_excel(file_path)
                print("[OK] 使用默认引擎读取成功")
            except Exception as e:
                print(f"[ERROR] 读取失败: {e}")
                return

    # 基本信息
    print(f"\n【数据概览】")
    print(f"  维度: {df.shape[0]} 行 × {df.shape[1]} 列")
    print(f"  列名: {', '.join(df.columns)}")

    # 数据类型
    print(f"\n【数据类型】")
    for col in df.columns:
        dtype = df[col].dtype
        nunique = df[col].nunique()
        null_count = df[col].isnull().sum()
        print(f"  {col}: {dtype} | 唯一值={nunique} | 缺失={null_count}")

    # 数值列统计
    numeric_cols = df.select_dtypes(include=['int64', 'float64']).columns
    if len(numeric_cols) > 0:
        print(f"\n【数值列统计】")
        for col in numeric_cols:
            print(f"\n  {col}:")
            print(f"    均值: {df[col].mean():.2f}")
            print(f"    中位数: {df[col].median():.2f}")
            print(f"    标准差: {df[col].std():.2f}")
            print(f"    范围: [{df[col].min():.2f}, {df[col].max():.2f}]")

    # 文本列分析
    text_cols = df.select_dtypes(include=['object']).columns
    if len(text_cols) > 0:
        print(f"\n【文本列分析】")
        for col in text_cols:
            print(f"\n  {col} (共 {df[col].nunique()} 个唯一值):")
            top5 = df[col].value_counts().head(5)
            for val, count in top5.items():
                print(f"    '{val}': {count} 次")

    # 数据预览
    print(f"\n【数据预览（前10行）】")
    print(df.head(10).to_string(index=False))

    # 保存为 CSV
    csv_path = 'data/11111_analyzed.csv'
    os.makedirs('data', exist_ok=True)
    df.to_csv(csv_path, index=False, encoding='utf-8-sig')
    print(f"\n[OK] 已转换并保存为: {csv_path}")

    # 生成 JSON 报告
    report = {
        "文件路径": file_path,
        "数据维度": {"行数": int(df.shape[0]), "列数": int(df.shape[1])},
        "列信息": [],
        "数值统计": {},
        "文本统计": {},
        "关键发现": []
    }

    # 列信息
    for col in df.columns:
        report["列信息"].append({
            "列名": col,
            "数据类型": str(df[col].dtype),
            "唯一值数量": int(df[col].nunique()),
            "缺失值数量": int(df[col].isnull().sum()),
            "缺失率": f"{df[col].isnull().sum() / len(df) * 100:.1f}%"
        })

    # 数值统计
    for col in numeric_cols:
        report["数值统计"][col] = {
            "均值": float(df[col].mean()),
            "中位数": float(df[col].median()),
            "标准差": float(df[col].std()),
            "最小值": float(df[col].min()),
            "最大值": float(df[col].max())
        }

    # 文本统计
    for col in text_cols:
        top_values = df[col].value_counts().head(5).to_dict()
        report["文本统计"][col] = {
            "唯一值数量": int(df[col].nunique()),
            "最常见值": {str(k): int(v) for k, v in top_values.items()}
        }

    # 关键发现
    if df.isnull().sum().sum() > 0:
        report["关键发现"].append(f"发现 {df.isnull().sum().sum()} 个缺失值")

    if len(numeric_cols) > 0:
        report["关键发现"].append(f"包含 {len(numeric_cols)} 个数值列，可进行统计分析")

    if len(text_cols) > 0:
        report["关键发现"].append(f"包含 {len(text_cols)} 个文本列，可进行分类分析")

    # 保存 JSON 报告
    report_path = 'data/11111_analysis_report.json'
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"[OK] 分析报告已保存为: {report_path}")

    print("\n" + "=" * 80)
    print("分析完成！")
    print("=" * 80)

if __name__ == "__main__":
    main()
