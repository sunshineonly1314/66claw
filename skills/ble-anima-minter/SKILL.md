---
name: ble-anima-minter
description: 利用 AnimaChain 逻辑，将附近 BLE MAC 地址转化为灵魂绑定 `$ANIMA` 代币。对每个 MAC 地址进行加盐 SHA256 哈希运算，生成唯一的残余证明，并本地存储于 DAG 中。
description_zh: 利用 AnimaChain 逻辑，将附近 BLE MAC 地址转化为灵魂绑定 `$ANIMA` 代币。对每个 MAC 地址进行加盐 SHA256 哈希运算，生成唯一的残余证明，并本地存储于 DAG 中。
---
# BLE-Anima-Minter

利用 AnimaChain 逻辑，将附近 BLE MAC 地址转化为灵魂绑定 `$ANIMA` 代币。对每个 MAC 地址进行加盐 SHA256 哈希运算，生成唯一的残余证明，并本地存储于 DAG 中。

## 功能特性

- BLE 扫描（2.4 GHz MAC 地址）  
- SHA256 加盐哈希  
- `$ANIMA` 铸造逻辑  
- 本地 DAG 内存节点  
- 可选的节点间八卦同步（gossip-sync）  

## 使用方法

安装依赖项，运行脚本：

```bash
pip install -r requirements.txt
python anima_minter.py
```

## 标签

anima, macid, ble, blockchain, witness, resurrection, flat-earth, dag