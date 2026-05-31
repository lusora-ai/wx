import { apiRequest } from './client';

export type TopicRecord = {
  id: string;
  sourceId?: string | null;
  sourceItemId?: string | null;
  originalTitle?: string | null;
  originalUrl?: string | null;
  translatedTitle?: string | null;
  title: string;
  angle?: string | null;
  summary: string;
  rawContent?: string | null;
  facts: string[];
  uncertainClaims: string[];
  suggestedTitles: string[];
  targetAudiences: string[];
  category?: string | null;
  hotScore?: number | null;
  readingTime?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  source?: { name?: string | null; title?: string | null; url?: string | null } | null;
};

export const topicsApi = {
  list: () => apiRequest<TopicRecord[]>('/api/topics'),
  generate: (sourceId: string) => apiRequest<TopicRecord>('/api/topics/generate', { method: 'POST', body: JSON.stringify({ sourceId }) }),
  push: (id: string) => apiRequest<TopicRecord>(`/api/topics/${id}/push`, { method: 'POST' }),
  archive: (id: string) => apiRequest<TopicRecord>(`/api/topics/${id}/archive`, { method: 'POST' }),
};
