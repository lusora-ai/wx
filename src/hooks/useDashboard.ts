import { useCallback } from 'react';
import { dashboardApi } from '../api/dashboard';
import { useApiResource } from './useApiResource';

export function useDashboard() {
  return useApiResource(useCallback(() => dashboardApi.summary(), []), {
    sourceCountToday: 0,
    pendingTopicCount: 0,
    generatedArticleCount: 0,
    pendingReviewCount: 0,
    exportedArticleCount: 0,
    publishTaskCount: 0,
    failedTaskCount: 0,
    tokenUsedToday: 0,
    recentLogs: [],
  });
}
