import { Router } from 'express';
import { writeLog } from '../services/logger';
import { asyncRoute, ok } from '../types/api';

export const aiHealthRouter = Router();

type AIHealthResult = {
  provider: 'deepseek' | 'kimi';
  model: string;
  configured: boolean;
  status: 'ok' | 'slow' | 'timeout' | 'error' | 'missing_key';
  elapsedMs?: number;
  message: string;
};

function getProviderConfig(provider: 'deepseek' | 'kimi') {
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

async function checkProvider(provider: 'deepseek' | 'kimi'): Promise<AIHealthResult> {
  const config = getProviderConfig(provider);
  const label = provider === 'deepseek' ? 'DeepSeek v4 Pro' : 'Kimi 2.6';

  if (!config.apiKey) {
    return {
      provider,
      model: config.model,
      configured: false,
      status: 'missing_key',
      message: `${label} API Key 未配置。`,
    };
  }

  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: '请回复"ok"两个字符。' }],
        max_tokens: 10,
      }),
    });
    clearTimeout(timeout);
    const elapsedMs = Date.now() - startedAt;

    if (!response.ok) {
      return {
        provider,
        model: config.model,
        configured: true,
        status: 'error',
        elapsedMs,
        message: `${label} 请求失败：HTTP ${response.status}。`,
      };
    }

    let status: AIHealthResult['status'] = 'ok';
    let message = `${label} 响应正常。`;
    if (elapsedMs > 30000) {
      status = 'timeout';
      message = `${label} 响应超时（${(elapsedMs / 1000).toFixed(1)}s）。`;
    } else if (elapsedMs > 15000) {
      status = 'slow';
      message = `${label} 响应较慢（${(elapsedMs / 1000).toFixed(1)}s）。`;
    }

    return { provider, model: config.model, configured: true, status, elapsedMs, message };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        provider,
        model: config.model,
        configured: true,
        status: 'timeout',
        elapsedMs,
        message: `${label} 请求超时（${(elapsedMs / 1000).toFixed(1)}s）。`,
      };
    }
    return {
      provider,
      model: config.model,
      configured: true,
      status: 'error',
      elapsedMs,
      message: `${label} 连接失败：${error instanceof Error ? error.message : '未知错误'}。`,
    };
  }
}

// Cached results
let lastCheck: AIHealthResult[] | null = null;
let lastCheckTime = 0;

aiHealthRouter.get('/health', asyncRoute(async (_req, res) => {
  return ok(res, {
    results: lastCheck ?? [],
    lastCheckTime: lastCheckTime ? new Date(lastCheckTime).toISOString() : null,
  });
}));

aiHealthRouter.post('/health/check', asyncRoute(async (_req, res) => {
  const [deepseek, kimi] = await Promise.all([
    checkProvider('deepseek'),
    checkProvider('kimi'),
  ]);
  lastCheck = [deepseek, kimi];
  lastCheckTime = Date.now();
  await writeLog({ module: 'AI', action: `健康检查完成：DeepSeek=${deepseek.status}, Kimi=${kimi.status}`, type: 'info' });
  return ok(res, {
    results: lastCheck,
    lastCheckTime: new Date(lastCheckTime).toISOString(),
  });
}));
