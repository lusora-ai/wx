import { useCallback } from 'react';
import { articlesApi } from '../api/articles';
import { useApiResource } from './useApiResource';

export function useArticles() {
  return useApiResource(useCallback(() => articlesApi.list(), []), []);
}
