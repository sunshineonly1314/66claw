---
name: bring-shopping
name_zh: Bring购物
description: 通过非官方的 bring-shopping Node.js 库，使用邮箱/密码登录方式管理 Bring! 购物清单。适用于列出清单、读取商品、添加/删除商品，以及勾选/取消勾选商品等操作（当接受 API 风格访问时）。
description_zh: 通过非官方的 bring-shopping Node.js 库，使用邮箱/密码登录方式管理 Bring! 购物清单。适用于列出清单、读取商品、添加/删除商品，以及勾选/取消勾选商品等操作（当接受 API 风格访问时）。
---
# Bring 购物清单管理

## 概述

使用 `bring-shopping` npm 包，凭邮箱/密码凭证访问 Bring! 清单。除非用户另行指定，否则默认清单为“Willig”。

## 快速开始

1. 在技能目录中安装依赖：
   - `npm install bring-shopping`
2. 在 Clawdbot 配置（推荐）或 shell 中设置环境变量：
   - `BRING_EMAIL` 和 `BRING_PASSWORD`
3. 运行 CLI 脚本：
   - `node scripts/bring_cli.mjs items --list "Willig"`

## 可执行任务

### 显示清单列表

- `node scripts/bring_cli.mjs lists`

### 显示商品列表

- `node scripts/bring_cli.mjs items --list "Willig"`

### 添加商品

- `node scripts/bring_cli.mjs add --item "Milch" --spec "2L" --list "Willig"`

### 删除商品

- `node scripts/bring_cli.mjs remove --item "Milch" --list "Willig"`

### 勾选商品

- `node scripts/bring_cli.mjs check --item "Milch" --list "Willig"`

### 取消勾选商品

- `node scripts/bring_cli.mjs uncheck --item "Milch" --spec "2L" --list "Willig"`

## 注意事项

- 将凭证存储于 Clawdbot 配置的环境变量中，避免随技能一并打包。
- 若清单名称存在歧义，请运行 `lists` 并询问用户应使用哪个清单。
- 若某商品已被勾选，`uncheck` 将重新将其加入采购清单。