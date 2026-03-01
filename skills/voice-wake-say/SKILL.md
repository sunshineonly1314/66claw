---
name: voice-wake-say
name_zh: 语音唤醒播报
description: 当用户输入表明已启用语音唤醒/语音识别功能时（例如，消息开头为“User talked via voice recognition on <device>”），在 macOS 上使用系统内置的 `say` 命令朗读 assistant 的回复。
description_zh: 当用户输入表明已启用语音唤醒/语音识别功能时（例如，消息开头为“User talked via voice recognition on <device>”），在 macOS 上使用系统内置的 `say` 命令朗读 assistant 的回复。
---
# 语音唤醒朗读（Voice Wake Say）

## 概述
每当对话源自语音唤醒/语音识别功能时，使用 macOS 内置的 `say` 命令将 assistant 的回复朗读出来。**切勿**使用 `tts` 工具（它会调用云端服务）。

## 何时使用 `say`（请逐条检查每条消息）

**如果**用户消息**以以下内容开头**：`User talked via voice recognition`  
- **步骤 1：** 首先用 `say` 进行确认（让用户知道您已听到）  
- **步骤 2：** 然后执行对应任务  
- **步骤 3：** 如有必要，任务完成后可再次朗读结果  

**如果**用户消息**不以此精确短语开头**  
- **则：** 禁止使用 `say`，仅以纯文本形式回复  

**关键要求：**  
- 必须**逐条检查每条消息**——上下文**不会延续**  
- 触发短语必须**严格位于消息最开头**  
- 对于耗时较长的任务，请**先确认**，以便用户知晓您正在处理  

## 工作流程  
1) 检测语音唤醒上下文  
- **仅当**最新一条用户/系统消息**以 `User talked via voice recognition` 开头时**才触发  
- 若消息中指示“先重复提示”，请在回复中保留该行为  

2) 准备待朗读文本  
- 以最终回复文本为基础  
- 移除 Markdown 格式与代码块；若回复过长或含大量代码，则仅朗读简明摘要，并说明详细内容已在屏幕上显示  

3) 使用 `say`（macOS 本地 TTS）朗读  
```bash
printf '%s' "$SPOKEN_TEXT" | say
```  

可选控制参数（仅在已设置时使用）：  
```bash
printf '%s' "$SPOKEN_TEXT" | say -v "$SAY_VOICE"
printf '%s' "$SPOKEN_TEXT" | say -r "$SAY_RATE"
```  

## 故障处理  
- 若 `say` 不可用或报错，仍需发送文本回复，并注明 TTS 功能失败  