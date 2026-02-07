# -*- coding: utf-8 -*-
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import mysql.connector

conn = mysql.connector.connect(
    host='43.129.194.117', port=3306, user='root',
    password='sunbingood@123', database='tecbinai'
)
cursor = conn.cursor()

key_value = 'clawd-1769674485949-c9441328'
key_id = 2184

# 查看 key_devices 表结构
cursor.execute('DESCRIBE key_devices')
cols = cursor.fetchall()
print('key_devices 表结构:')
for c in cols:
    print(f'  {c[0]}: {c[1]}')

# 查询设备绑定
cursor.execute('SELECT * FROM key_devices WHERE key_id = %s', (key_id,))
devices = cursor.fetchall()
print(f'\n设备绑定 (共 {len(devices)} 个):')
for d in devices:
    print(f'  {d}')

# 查询 verification_keys 的更多信息
cursor.execute('DESCRIBE verification_keys')
vk_cols = cursor.fetchall()
print('\nverification_keys 表结构:')
for c in vk_cols:
    print(f'  {c[0]}: {c[1]}')

# 完整查询激活码信息
cursor.execute('SELECT * FROM verification_keys WHERE key_value = %s', (key_value,))
key_info = cursor.fetchone()
if key_info:
    cursor.execute('DESCRIBE verification_keys')
    col_names = [c[0] for c in cursor.fetchall()]
    cursor.execute('SELECT * FROM verification_keys WHERE key_value = %s', (key_value,))
    key_info = cursor.fetchone()
    print(f'\n激活码完整信息:')
    for i, col in enumerate(col_names):
        print(f'  {col}: {key_info[i]}')

cursor.close()
conn.close()
