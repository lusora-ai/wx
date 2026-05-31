import { apiRequest } from './client';

export type FetchTaskRecord = {
  id: string;
  sourceId?: string | null;
  type: string;
  status: string;
  total: number;
  success: number;
  failed: number;
  message?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export const fetchTasksApi = {
  list: (sourceId?: string) => {
    const params = sourceId ? `?sourceId=${sourceId}` : '';
    return apiRequest<FetchTaskRecord[]>(`/api/fetch-tasks${params}`);
  },
  get: (id: string) => apiRequest<FetchTaskRecord>(`/api/fetch-tasks/${id}`),
  fetchSource: (sourceId: string) => apiRequest<FetchTaskRecord>(`/api/fetch-tasks/source/${sourceId}`, { method: 'POST' }),
  fetchAll: () => apiRequest<FetchTaskRecord>('/api/fetch-tasks/all', { method: 'POST' }),
};
