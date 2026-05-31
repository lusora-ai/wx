import { apiRequest } from './client';

export type DashboardSummaryRecord = {
  sourceCountToday: number;
  pendingTopicCount: number;
  generatedArticleCount: number;
  pendingReviewCount: number;
  exportedArticleCount: number;
  publishTaskCount: number;
  failedTaskCount: number;
  tokenUsedToday: number;
  recentLogs: {
    id: string;
    module: string;
    action: string;
    type: 'info' | 'success' | 'warning' | 'error';
    operator?: string | null;
    tokensUsed?: number | null;
    createdAt: string;
  }[];
};

export const dashboardApi = {
  summary: () => apiRequest<DashboardSummaryRecord>('/api/dashboard/summary'),
};
