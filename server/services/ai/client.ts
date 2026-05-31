import { ApiError } from '../../types/api';

export type AiProvider = 'deepseek' | 'kimi';

const providerLabels: Record<AiProvider, string> = {
  deepseek: 'DeepSeek v4 Pro',
  kimi: 'Kimi 2.6',
};

function extractJson(text: string): string {
  const trimmed = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function getProviderConfig(provider: AiProvider) {
  if (provider === 'deepseek') {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-pro',
    };
  }

  return {
    apiKey: process.env.KIMI_API_KEY,
    baseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
    model: process.env.KIMI_MODEL || 'kimi-k2.6',
  };
}

export async function generateJson<T>(
  prompt: string,
  provider: AiProvider,
  options: { timeoutMs?: number; timeoutMessage?: string } = {},
): Promise<{ data: T; tokenUsage?: number }> {
  const config = getProviderConfig(provider);
  const label = providerLabels[provider];

  if (!config.apiKey || !config.baseUrl) {
    throw new ApiError('LLM_CONFIG_MISSING', `请先在服务端 .env 配置 ${label} 的 API Key 与 Base URL。`, 400);
  }

  const maxAttempts = Number(process.env.LLM_RETRY_ATTEMPTS || 3);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? Number(process.env.LLM_TIMEOUT_MS || 90000));
      const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });
      clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 429 && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 5000));
        continue;
      }
      throw new ApiError('LLM_REQUEST_FAILED', `${label} 请求失败：${response.status}`, 502);
    }

    const payload = await response.json();
    const text = payload.choices?.[0]?.message?.content;
    if (!text) throw new ApiError('AI_OUTPUT_INVALID', `${label} 没有返回可解析文本。`, 502);

    return { data: JSON.parse(extractJson(text)) as T, tokenUsage: payload.usage?.total_tokens };
    } catch (error) {
      if (timeout) clearTimeout(timeout);
      if (error instanceof ApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('LLM_REQUEST_FAILED', options.timeoutMessage || `${label} 请求超时，请稍后重试。`, 504);
      }
      if (error instanceof SyntaxError) {
        throw new ApiError('AI_OUTPUT_INVALID', `${label} 返回的内容不是合法 JSON。`, 502);
      }
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
        continue;
      }
      throw new ApiError('LLM_REQUEST_FAILED', `${label} 请求失败，请检查模型服务和网络。`, 502);
    }
  }

  throw new ApiError('LLM_REQUEST_FAILED', `${label} 请求失败，请稍后重试。`, 502);
}

export const runDeepSeekJson = <T>(prompt: string) => generateJson<T>(prompt, 'deepseek');
export const runKimiJson = <T>(prompt: string, options?: { timeoutMs?: number; timeoutMessage?: string }) => generateJson<T>(prompt, 'kimi', options);
