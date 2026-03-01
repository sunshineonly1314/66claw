---
name: clawdhub
name_zh: ClawdHub
description: 使用 ClawdHub CLI 在 clawdhub.com 上搜索、安装、更新和发布 agent skills。当您需要动态获取新的 skills、将已安装的 skills 同步至最新或指定版本，或使用 npm 安装的 clawdhub CLI 发布新的/已更新的 skill 文件夹时，请使用该 skill。
description_zh: 使用 ClawdHub CLI 在 clawdhub.com 上搜索、安装、更新和发布 agent skills。当您需要动态获取新的 skills、将已安装的 skills 同步至最新或指定版本，或使用 npm 安装的 clawdhub CLI 发布新的/已更新的 skill 文件夹时，请使用该 skill。
metadata: {"clawdbot":{"requires":{"bins":["clawdhub"]},"install":[{"id":"node","kind":"node","package":"clawdhub","bins":["clawdhub"],"label":"Install ClawdHub CLI (npm)"}]}}
---
# ClawdHub CLI

安装  
```bash
npm i -g clawdhub
```  

认证（用于发布）  
```bash
clawdhub login
clawdhub whoami
```  

搜索  
```bash
clawdhub search "postgres backups"
```  

安装  
```bash
clawdhub install my-skill
clawdhub install my-skill --version 1.2.3
```  

更新（基于哈希匹配 + 升级）  
```bash
clawdhub update my-skill
clawdhub update my-skill --version 1.2.3
clawdhub update --all
clawdhub update my-skill --force
clawdhub update --all --no-input --force
```  

列出  
```bash
clawdhub list
```  

发布  
```bash
clawdhub publish ./my-skill --slug my-skill --name "My Skill" --version 1.2.0 --changelog "Fixes + docs"
```  

注意事项  
- 默认注册中心：https://clawdhub.com（可通过 CLAWDHUB_REGISTRY 环境变量或 --registry 参数覆盖）  
- 默认工作目录：当前目录（cwd）；安装目录：./skills（可通过 --workdir / --dir 参数覆盖）  
- update 命令会对本地文件进行哈希计算，解析匹配的版本，并升级至最新版，除非指定了 --version 参数  