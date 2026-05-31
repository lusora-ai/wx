import { apiRequest } from './client';

export type SourceRecord = {
  id: string;
  type: 'manual' | 'url' | 'rss';
  name?: string | null;
  title?: string | null;
  url?: string | null;
  rawText?: string;
  language?: string | null;
  sourceAuthor?: string | null;
  publishedAt?: string | null;
  status: string;
  region?: 'domestic' | 'global';
  articleCount: number;
  lastChecked?: string | null;
  createdAt: string;
  updatedAt: string;
  items?: SourceItemRecord[];
};

export type SourceItemRecord = {
  id: string;
  sourceId: string;
  title: string;
  url?: string | null;
  rawText: string;
  summary?: string | null;
  publishedAt?: string | null;
  status: string;
  qualityScore?: number | null;
  qualityIssues?: string | null;
  createdAt: string;
  updatedAt: string;
  source?: SourceRecord;
};

export type CreateSourceInput = {
  type: 'manual' | 'url' | 'rss';
  name?: string;
  title?: string;
  url?: string;
  rawText: string;
  region?: 'domestic' | 'global';
  language?: string;
  sourceAuthor?: string;
  publishedAt?: string;
};

export const sourcesApi = {
  list: () => apiRequest<SourceRecord[]>('/api/sources?includeArchived=true'),
  create: (input: CreateSourceInput) => apiRequest<SourceRecord>('/api/sources', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<CreateSourceInput> & { status?: string }) => apiRequest<SourceRecord>(`/api/sources/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  archive: (id: string) => apiRequest<SourceRecord>(`/api/sources/${id}`, { method: 'DELETE' }),
  permanentDelete: (id: string) => apiRequest<{ deleted: Record<string, number> }>(`/api/sources/${id}/permanent`, { method: 'DELETE' }),
  check: (id: string) => apiRequest<SourceRecord>(`/api/sources/${id}/check`, { method: 'POST' }),
  fetch: (id: string) => apiRequest<{ source: SourceRecord; createdCount: number }>(`/api/sources/${id}/fetch`, { method: 'POST' }),
  fetchAll: () => apiRequest<{ source: SourceRecord; createdCount: number; error?: string }[]>('/api/sources/fetch-all', { method: 'POST' }),
};
