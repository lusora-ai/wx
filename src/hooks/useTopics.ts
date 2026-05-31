import { useCallback } from 'react';
import { topicsApi } from '../api/topics';
import { useApiResource } from './useApiResource';

export function useTopics() {
  return useApiResource(useCallback(() => topicsApi.list(), []), []);
}
