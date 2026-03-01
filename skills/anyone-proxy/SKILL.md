---
name: anyone-proxy
name_zh: 任意代理
homepage: https://anyone.io
description: 该 skill 支持 IP 地址掩蔽，并可访问 Anyone 网络上的隐藏服务。通过本地 SOCKS5 代理，将请求路由至 Anyone 协议 VPN 网络。
description_zh: 该 skill 支持 IP 地址掩蔽，并可访问 Anyone 网络上的隐藏服务。通过本地 SOCKS5 代理，将请求路由至 Anyone 协议 VPN 网络。
metadata:
  clawdbot:
    requires:
      packages:
        - "@anyone-protocol/anyone-client"
---
# Anyone 协议代理

该 skill 使 Clawdbot 能够通过 Anyone 协议网络路由请求。

## 工作原理

该 skill 使用 `@anyone-protocol/anyone-client` NPM 包来：
1. 启动本地 SOCKS5 代理服务器（默认端口：9050）
2. 在 Anyone 网络中创建加密电路
3. 将流量经由这些电路进行路由
4. 返回响应，同时隐藏原始 IP 地址

# 设置

## 安装 anyone-client
```bash
npm install -g @anyone-protocol/anyone-client
```

## 启动代理
```bash
npx @anyone-protocol/anyone-client -s 9050
```

## 使用方法
代理启动后，将请求路由至该代理：
```bash
# Using curl to verify IP
curl --socks5-hostname localhost:9050 https://check.en.anyone.tech/api/ip
```
```javascript
import { Anon } from "@anyone-protocol/anyone-client";
import { AnonSocksClient } from "@anyone-protocol/anyone-client";

async function main() {
    const anon = new Anon();
    const anonSocksClient = new AnonSocksClient(anon);

    try {
        await anon.start();
        // Wait for circuits to establish
        await new Promise(resolve => setTimeout(resolve, 15000));
        
        const response = await anonSocksClient.get('https://check.en.anyone.tech/api/ip');
        console.log('Response:', response.data);
        
    } catch(error) {
        console.error('Error:', error);
    } finally {
        await anon.stop();
    }
}

main();
```

## 注意事项

- 首次连接可能需要最多 30 秒以建立电路
- 代理一旦启动，将在多次请求间持续运行