import { apiRequest } from './client';

export type DailySummary = {
  fetchedToday: number;
  pendingTopics: number;
  generatedArticles: number;
  approvedArticles: number;
  publishedTasks: number;
  activeSources: number;
  date: string;
};

export type FetchTodayResult = {
  totalCreated: number;
  totalFailed: number;
  sources: { sourceId: string; name: string; created: number; error?: string }[];
};

export const dailyApi = {
  summary: () => apiRequest<DailySummary>('/api/daily/summary'),
  fetchToday: () => apiRequest<FetchTodayResult>('/api/daily/fetch-today', { method: 'POST' }),
};
