/**
 * Qwen API 客户端 (阿里云百炼 Coding Plan — OpenAI 兼容协议)
 */

import { QWEN_CONFIG } from "./config.js";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface QwenCallResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

/**
 * 调用 Qwen API (OpenAI 兼容协议)
 */
export async function callQwen(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    temperature?: number;
    maxTokens?: number;
  },
): Promise<QwenCallResult> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const body = {
    model: QWEN_CONFIG.model,
    messages,
    temperature: options?.temperature ?? QWEN_CONFIG.temperature,
    max_tokens: options?.maxTokens ?? QWEN_CONFIG.maxTokens,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= QWEN_CONFIG.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), QWEN_CONFIG.timeoutMs);

      const response = await fetch(`${QWEN_CONFIG.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${QWEN_CONFIG.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qwen API ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as ChatCompletionResponse;

      const choice = data.choices?.[0];
      if (!choice?.message?.content) {
        throw new Error("Qwen API 返回空内容");
      }

      return {
        content: choice.message.content,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        model: QWEN_CONFIG.model,
      };
    } catch (err) {
      lastError = err as Error;
      if (attempt < QWEN_CONFIG.maxRetries) {
        const delay = Math.pow(2, attempt) * 2000;
        console.log(`  ⚠ Qwen API 调用失败 (第${attempt + 1}次), ${delay}ms 后重试: ${lastError.message}`);
        await sleep(delay);
      }
    }
  }

  throw new Error(`Qwen API 调用失败 (已重试${QWEN_CONFIG.maxRetries}次): ${lastError?.message}`);
}

/**
 * 调用 Qwen 并解析 JSON 返回
 */
export async function callQwenJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number },
): Promise<{ parsed: T; raw: QwenCallResult }> {
  const raw = await callQwen(systemPrompt, userPrompt, options);

  // 从返回内容中提取 JSON (可能被 ```json ``` 包裹)
  let jsonStr = raw.content.trim();

  // 尝试提取 ```json ... ``` 中的内容
  const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (jsonBlockMatch) {
    jsonStr = jsonBlockMatch[1].trim();
  }

  // 尝试提取 { ... } 或 [ ... ]
  if (!jsonStr.startsWith("{") && !jsonStr.startsWith("[")) {
    const braceMatch = jsonStr.match(/(\{[\s\S]*\})/);
    if (braceMatch) {
      jsonStr = braceMatch[1];
    }
  }

  try {
    const parsed = JSON.parse(jsonStr) as T;
    return { parsed, raw };
  } catch {
    throw new Error(
      `JSON 解析失败。原始内容:\n${raw.content.substring(0, 500)}...`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
