import { useCallback } from 'react';
import { publishApi } from '../api/publish';
import { useApiResource } from './useApiResource';

export function usePublishTasks() {
  return useApiResource(useCallback(() => publishApi.list(), []), []);
}
