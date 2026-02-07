# -*- coding: utf-8 -*-
"""测试激活码验证 API"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

import requests
import hmac
import hashlib
import time
import uuid
import json

# 配置
API_BASE = "https://www.tecbinai.com/api/api/v1/license"
KEY = "clawd-1769674485949-c9441328"
SIGN_SECRET = "Cb#2026$Tecbinai@Lic3nse!Hmac^Key&Secure"  # 正确的签名密钥

def generate_sign(key, device_id, timestamp, nonce, secret):
    """生成请求签名 - HMAC-SHA256"""
    # 签名格式: key|deviceId|timestamp|nonce
    data = f"{key}|{device_id}|{timestamp}|{nonce}"
    return hmac.new(secret.encode(), data.encode(), hashlib.sha256).hexdigest()

def test_verify():
    """测试验证接口"""
    device_id = "test-device-" + str(uuid.uuid4())[:8]
    device_name = "Test Device"
    timestamp = int(time.time() * 1000)  # 毫秒时间戳
    nonce = str(uuid.uuid4()).replace("-", "")[:16]  # 16位随机字符
    
    sign = generate_sign(KEY, device_id, timestamp, nonce, SIGN_SECRET)
    
    payload = {
        "key": KEY,
        "deviceId": device_id,
        "deviceName": device_name,
        "appVersion": "2026.1.30",
        "osInfo": "Windows 10",
        "shownNotificationIds": [],
        "timestamp": timestamp,
        "nonce": nonce,
        "sign": sign
    }
    
    print(f"测试验证激活码: {KEY}")
    print(f"Device ID: {device_id}")
    print(f"API: {API_BASE}/verify")
    print(f"\n请求数据:")
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    
    try:
        response = requests.post(
            f"{API_BASE}/verify",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"\nHTTP Status: {response.status_code}")
        print(f"\n响应数据:")
        result = response.json()
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        if result.get("code") == 200:
            data = result.get("data", {})
            if data.get("valid"):
                print(f"\n✓ 验证成功!")
                print(f"  等级: {data.get('license', {}).get('tier')}")
                print(f"  剩余天数: {data.get('license', {}).get('daysRemaining')}")
            else:
                print(f"\n✗ 验证失败!")
                print(f"  错误码: {data.get('errorCode')}")
                print(f"  错误信息: {data.get('errorMessage')}")
        else:
            print(f"\n✗ API 错误: {result.get('message')}")
            
    except Exception as e:
        print(f"\n✗ 请求失败: {e}")

if __name__ == "__main__":
    test_verify()
