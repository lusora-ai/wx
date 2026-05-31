import { apiRequest } from './client';
import type { TopicRecord } from './topics';
import type { SourceItemRecord } from './sources';

export const sourceItemsApi = {
  list: (params?: { status?: string; sourceId?: string; keyword?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.sourceId) searchParams.set('sourceId', params.sourceId);
    if (params?.keyword) searchParams.set('keyword', params.keyword);
    const qs = searchParams.toString();
    return apiRequest<SourceItemRecord[]>(`/api/source-items${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiRequest<SourceItemRecord>(`/api/source-items/${id}`),
  update: (id: string, input: Partial<{ title: string; summary: string; status: string }>) =>
    apiRequest<SourceItemRecord>(`/api/source-items/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  archive: (id: string) => apiRequest<SourceItemRecord>(`/api/source-items/${id}/archive`, { method: 'POST' }),
  restore: (id: string) => apiRequest<SourceItemRecord>(`/api/source-items/${id}/restore`, { method: 'POST' }),
  generateTopic: (id: string) => apiRequest<TopicRecord>(`/api/source-items/${id}/generate-topic`, { method: 'POST' }),
};
