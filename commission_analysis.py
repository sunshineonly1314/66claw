#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
佣金分析脚本 - 按佣金从低到高排列，统计每个档位的销售情况
"""

import pandas as pd

def main():
    file_path = r'C:\Users\72793\Desktop\11111.xls'

    print("=" * 80)
    print("佣金分析报告")
    print("=" * 80)

    # 读取数据
    df = pd.read_excel(file_path, engine='xlrd')

    # 从数据中找到佣金相关的列
    # 根据之前的分析，佣金收入列名为 "0.79" (总佣金收入)
    commission_col = None
    product_col = None

    # 查找包含佣金和产品信息的列
    for col in df.columns:
        if '佣金' in str(col) or col == '0.79':
            if commission_col is None:
                commission_col = col
        if '腰带' in str(col) or '水貂' in str(col):
            product_col = col

    # 使用第3列作为产品名称（根据之前的分析）
    product_col = df.columns[2]
    # 使用"0.79"列作为佣金列
    commission_col = '0.79'

    # 过滤掉表头行
    df_data = df[df[commission_col] != '总佣金收入'].copy()

    # 转换佣金为浮点数
    df_data['佣金金额'] = pd.to_numeric(df_data[commission_col], errors='coerce')

    # 按佣金从低到高排序
    df_sorted = df_data.sort_values('佣金金额')

    # 统计每个佣金档位的情况
    commission_stats = df_data.groupby('佣金金额').agg({
        product_col: ['count', lambda x: list(x.unique())]
    }).reset_index()

    commission_stats.columns = ['佣金金额', '订单数量', '产品列表']
    commission_stats = commission_stats.sort_values('佣金金额')

    print("\n" + "=" * 80)
    print("按佣金从低到高排列统计")
    print("=" * 80)

    for idx, row in commission_stats.iterrows():
        commission = row['佣金金额']
        count = row['订单数量']
        products = row['产品列表']

        print(f"\n【佣金档位：{commission}元】")
        print(f"  订单数量：{count}条")
        print(f"  产品种类：{len(products)}种")
        print(f"  产品明细：")

        # 统计每个产品的数量
        product_counts = df_data[df_data['佣金金额'] == commission][product_col].value_counts()
        for product, product_count in product_counts.items():
            print(f"    - {product}: {product_count}条")

    # 生成总结
    print("\n" + "=" * 80)
    print("总结")
    print("=" * 80)
    print(f"总订单数：{len(df_data)}条")
    print(f"佣金档位数：{len(commission_stats)}个")
    print(f"佣金范围：{commission_stats['佣金金额'].min()}元 - {commission_stats['佣金金额'].max()}元")

    # 保存结果
    commission_stats.to_csv('data/commission_analysis.csv', index=False, encoding='utf-8-sig')
    print(f"\n详细数据已保存至：data/commission_analysis.csv")

if __name__ == "__main__":
    main()
