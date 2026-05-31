import { apiRequest } from './client';

export type AppSettingsRecord = {
  llmProvider: 'deepseek' | 'kimi';
  llmModel: string;
  llmBaseUrl?: string;
  defaultPrivateLink?: string;
  defaultTone: 'casual' | 'professional' | 'sharp';
  aiDisclosureEnabled: boolean;
  publishMode: 'dry_run';
};

export const settingsApi = {
  get: () => apiRequest<AppSettingsRecord>('/api/settings'),
  update: (input: Partial<AppSettingsRecord>) => apiRequest<AppSettingsRecord>('/api/settings', { method: 'PATCH', body: JSON.stringify(input) }),
};
