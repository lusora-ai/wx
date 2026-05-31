import { useCallback } from 'react';
import { imageSlotsApi } from '../api/imageSlots';
import { useApiResource } from './useApiResource';

export function useImageSlots(articleId?: string | null) {
  return useApiResource(
    useCallback(() => articleId ? imageSlotsApi.list(articleId) : Promise.resolve([]), [articleId]),
    [],
  );
}
