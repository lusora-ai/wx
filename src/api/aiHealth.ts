import { apiRequest } from './client';

export type AIHealthResult = {
  provider: 'deepseek' | 'kimi';
  model: string;
  configured: boolean;
  status: 'ok' | 'slow' | 'timeout' | 'error' | 'missing_key';
  elapsedMs?: number;
  message: string;
};

export type AIHealthResponse = {
  results: AIHealthResult[];
  lastCheckTime: string | null;
};

export const aiHealthApi = {
  getStatus: () => apiRequest<AIHealthResponse>('/api/ai/health'),
  runCheck: () => apiRequest<AIHealthResponse>('/api/ai/health/check', { method: 'POST' }),
};
