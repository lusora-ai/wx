import { useCallback } from 'react';
import { settingsApi } from '../api/settings';
import { useApiResource } from './useApiResource';

export function useSettings() {
  return useApiResource(useCallback(() => settingsApi.get(), []), {
    llmProvider: 'kimi' as const,
    llmModel: 'kimi-k2.6',
    llmBaseUrl: '',
    defaultPrivateLink: '',
    defaultTone: 'casual' as const,
    aiDisclosureEnabled: true,
    publishMode: 'dry_run' as const,
  });
}
