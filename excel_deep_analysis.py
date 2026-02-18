#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenClawCN Excel 深度分析脚本
使用的工具：pandas (Python 数据分析库)
"""

import pandas as pd
import numpy as np
import json
from datetime import datetime

def deep_analysis():
    file_path = r'C:\Users\72793\Desktop\11111.xls'

    print("=" * 80)
    print("OpenClawCN Excel 深度分析报告")
    print("=" * 80)
    print(f"\n使用工具：pandas (Python 数据分析库)")
    print(f"文件路径：{file_path}")
    print(f"分析时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    # 读取数据
    df = pd.read_excel(file_path, engine='xlrd')

    # 过滤表头行
    df_data = df[df['79.00'] != '成交金额'].copy()

    print(f"\n数据规模：{len(df_data)} 行 × {len(df.columns)} 列")

    # =======================================================================
    # 1. 产品分析
    # =======================================================================
    print("\n" + "=" * 80)
    print("【1】产品分析")
    print("=" * 80)

    product_col = df.columns[2]  # 产品名称列
    price_col = '79.00'  # 成交金额列

    # 转换价格为数值
    df_data['成交金额'] = pd.to_numeric(df_data[price_col], errors='coerce')

    # 产品销量统计
    product_stats = df_data.groupby(product_col).agg({
        product_col: 'count',
        '成交金额': ['sum', 'mean', 'min', 'max']
    })

    product_stats.columns = ['销量', '总销售额', '平均单价', '最低价', '最高价']
    product_stats = product_stats.sort_values('销量', ascending=False)

    print("\n产品销售排行榜：")
    for idx, (product, row) in enumerate(product_stats.iterrows(), 1):
        print(f"\n  {idx}. {product}")
        print(f"     销量：{int(row['销量'])}件")
        print(f"     总销售额：{row['总销售额']:.2f}元")
        print(f"     平均单价：{row['平均单价']:.2f}元")
        print(f"     价格范围：{row['最低价']:.2f} - {row['最高价']:.2f}元")
        print(f"     销量占比：{row['销量']/len(df_data)*100:.1f}%")

    # =======================================================================
    # 2. 价格分析
    # =======================================================================
    print("\n" + "=" * 80)
    print("【2】价格分布分析")
    print("=" * 80)

    price_distribution = df_data['成交金额'].value_counts().sort_index()

    print("\n价格档位分布：")
    for price, count in price_distribution.items():
        print(f"  {price}元：{count}笔订单（{count/len(df_data)*100:.1f}%）")

    print(f"\n价格统计：")
    print(f"  最低价：{df_data['成交金额'].min():.2f}元")
    print(f"  最高价：{df_data['成交金额'].max():.2f}元")
    print(f"  平均价：{df_data['成交金额'].mean():.2f}元")
    print(f"  中位数：{df_data['成交金额'].median():.2f}元")
    print(f"  价差：{df_data['成交金额'].max() - df_data['成交金额'].min():.2f}元")

    # =======================================================================
    # 3. 时间分析
    # =======================================================================
    print("\n" + "=" * 80)
    print("【3】时间趋势分析")
    print("=" * 80)

    # 使用第15列作为下单时间（根据之前的分析）
    time_col = df.columns[15]
    df_data['下单时间'] = pd.to_datetime(df_data[time_col], errors='coerce')
    df_data['下单日期'] = df_data['下单时间'].dt.date

    # 按日期统计
    daily_stats = df_data.groupby('下单日期').agg({
        product_col: 'count',
        '成交金额': 'sum'
    }).rename(columns={product_col: '订单量', '成交金额': '日销售额'})

    daily_stats = daily_stats.sort_values('订单量', ascending=False)

    print("\n销售高峰日 Top 10：")
    for idx, (date, row) in enumerate(daily_stats.head(10).iterrows(), 1):
        print(f"  {idx}. {date}：{int(row['订单量'])}单，销售额 {row['日销售额']:.2f}元")

    # =======================================================================
    # 4. 佣金分析
    # =======================================================================
    print("\n" + "=" * 80)
    print("【4】佣金收入分析")
    print("=" * 80)

    commission_col = '0.79'  # 总佣金收入列
    df_data['佣金收入'] = pd.to_numeric(df_data[commission_col], errors='coerce')

    commission_stats = df_data.groupby('佣金收入').agg({
        product_col: 'count',
        '成交金额': 'sum'
    }).rename(columns={product_col: '订单量'})

    commission_stats = commission_stats.sort_values('佣金收入')

    print("\n佣金档位统计（从低到高）：")
    for commission, row in commission_stats.iterrows():
        print(f"\n  佣金 {commission}元/单：")
        print(f"    订单量：{int(row['订单量'])}笔")
        print(f"    总成交额：{row['成交金额']:.2f}元")
        print(f"    总佣金：{commission * row['订单量']:.2f}元")
        print(f"    占比：{row['订单量']/len(df_data)*100:.1f}%")

    print(f"\n佣金总收入：{df_data['佣金收入'].sum():.2f}元")
    print(f"平均单笔佣金：{df_data['佣金收入'].mean():.2f}元")

    # =======================================================================
    # 5. 渠道分析
    # =======================================================================
    print("\n" + "=" * 80)
    print("【5】流量渠道分析")
    print("=" * 80)

    channel_col = df.columns[53]  # "抖音"列
    source_col = df.columns[54]   # "直播"列

    # 平台分布
    platform_stats = df_data[channel_col].value_counts()
    print("\n平台分布：")
    for platform, count in platform_stats.items():
        print(f"  {platform}：{count}笔（{count/len(df_data)*100:.1f}%）")

    # 来源分布
    source_stats = df_data[source_col].value_counts()
    print("\n流量来源：")
    for source, count in source_stats.items():
        print(f"  {source}：{count}笔（{count/len(df_data)*100:.1f}%）")

    # =======================================================================
    # 6. 综合洞察
    # =======================================================================
    print("\n" + "=" * 80)
    print("【6】核心数据指标")
    print("=" * 80)

    total_gmv = df_data['成交金额'].sum()
    total_commission = df_data['佣金收入'].sum()
    avg_order_value = df_data['成交金额'].mean()

    print(f"\n总订单数：{len(df_data)}笔")
    print(f"总GMV：{total_gmv:.2f}元")
    print(f"总佣金：{total_commission:.2f}元")
    print(f"客单价：{avg_order_value:.2f}元")
    print(f"佣金率：{total_commission/total_gmv*100:.2f}%")
    print(f"产品SKU数：{df_data[product_col].nunique()}个")

    # =======================================================================
    # 7. 保存详细报告
    # =======================================================================
    print("\n" + "=" * 80)
    print("【7】导出数据")
    print("=" * 80)

    # 保存 JSON 报告
    report = {
        "分析时间": datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        "数据规模": {
            "订单数": int(len(df_data)),
            "产品数": int(df_data[product_col].nunique())
        },
        "财务指标": {
            "总GMV": float(total_gmv),
            "总佣金": float(total_commission),
            "客单价": float(avg_order_value),
            "佣金率": float(total_commission/total_gmv*100)
        },
        "产品排行": product_stats.to_dict('index'),
        "价格分布": price_distribution.to_dict(),
        "渠道分布": {
            "平台": platform_stats.to_dict(),
            "来源": source_stats.to_dict()
        }
    }

    with open('data/excel_deep_analysis.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2, default=str)

    print("\n详细报告已保存：")
    print("  - data/excel_deep_analysis.json")

    print("\n" + "=" * 80)
    print("分析完成！")
    print("=" * 80)

if __name__ == "__main__":
    deep_analysis()
