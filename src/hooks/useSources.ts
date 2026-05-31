import { useCallback } from 'react';
import { sourcesApi } from '../api/sources';
import { useApiResource } from './useApiResource';

export function useSources() {
  return useApiResource(useCallback(() => sourcesApi.list(), []), []);
}
