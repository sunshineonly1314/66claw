---
name: clawdbot-skill-voice-wake-say
name_zh: 语音唤醒播报
description: 当用户输入表明处于语音唤醒/语音识别状态时（例如，消息以“User talked via voice recognition on <device>”开头），在 macOS 上使用内置的 `say` 命令将助手响应朗读出来。
description_zh: 当用户输入表明处于语音唤醒/语音识别状态时（例如，消息以“User talked via voice recognition on <device>”开头），在 macOS 上使用内置的 `say` 命令将助手响应朗读出来。
---
# 语音唤醒朗读（Voice Wake Say）

## 概述
每当对话源自语音唤醒/语音识别时，使用 macOS 内置的 `say` 功能将助手响应朗读出来。**切勿**使用 `tts` 工具（该工具调用云端服务）。

## 何时使用 `say`（请逐条检查每条消息）

**如果**用户消息**以以下内容开头**：`User talked via voice recognition on m3`  
- **步骤 1**：首先使用 `say` 进行确认（让用户知道你已听到）  
- **步骤 2**：然后执行对应任务  
- **步骤 3**：任务完成后，视情况可再次朗读结果  

**如果**用户消息**不以该确切短语开头**  
- **则**：**不得**使用 `say`，仅提供纯文本响应  

**关键注意事项**：  
- 必须**逐条检查每条消息**——上下文**不会延续**  
- 触发短语必须位于消息**最开头**  
- 对于耗时较长的任务，请**先确认**，以便用户知晓你正在处理  

## 工作流程  
1) 检测语音唤醒上下文  
- **仅当**最新一条用户/系统消息**以 `User talked via voice recognition on m3` 开头时**才触发  
- 若消息要求“先重复提示”，则应在响应中保留该行为  

2) 准备朗读文本  
- 以最终响应文本为基础  
- 移除 Markdown / 代码块；若响应过长或含大量代码，则朗读简明摘要，并说明详细信息显示在屏幕上  

3) 使用 `say`（本地 macOS 文字转语音）朗读  
```bash
printf '%s' "$SPOKEN_TEXT" | say
```  

可选控制项（仅在已设置时使用）：  
```bash
printf '%s' "$SPOKEN_TEXT" | say -v "$SAY_VOICE"
printf '%s' "$SPOKEN_TEXT" | say -r "$SAY_RATE"
```  

## 故障处理  
- 若 `say` 不可用或报错，仍应发送文本响应，并注明 TTS 失败  