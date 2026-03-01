---
name: tcm-video-factory
name_zh: 中医视频工厂
description: 利用 Perplexity API 自动化健康视频制作规划流程（主题研究 - 脚本撰写 - 角色设计 - 图像/视频提示词生成）。基于 TCM Video Factory 工作流。
description_zh: 利用 Perplexity API 自动化健康视频制作规划流程（主题研究 - 脚本撰写 - 角色设计 - 图像/视频提示词生成）。基于 TCM Video Factory 工作流。
metadata: {"clawdbot":{"emoji":"🎬","requires":{"bins":["node"],"env":["PERPLEXITY_API_KEY"]},"primaryEnv":"PERPLEXITY_API_KEY"}}
---
# TCM 视频工厂  

一套自动化工作流，用于生成完整的视频制作方案，包括脚本、角色设计及 AI 生成提示词（Nano Banana / VEO3）。

## 使用方法  

```bash
# Generate a plan for a specific topic
node skills/tcm-video-factory/index.mjs "Trà gừng mật ong"

# Generate a plan for a general theme (auto-research)
node skills/tcm-video-factory/index.mjs "Mẹo ngủ ngon"
```  

## 输出  

在当前目录下生成一个 `PLAN_[Timestamp].md` 文件，内容包括：  
1. 选定的主题  
2. 角色设计提示词（Pixar 3D 风格）  
3. 四段式脚本（总计 32 秒）  
4. 图像提示词（每段的起始与结束画面）  
5. VEO3 视频提示词（含唇形同步）  