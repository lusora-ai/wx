import { apiRequest } from './client';

export type SourcePreset = {
  id: string;
  name: string;
  type: 'rss' | 'url';
  url: string;
  region: 'global' | 'domestic';
  language?: string;
  description: string;
  added: boolean;
};

export type SourceRecord = {
  id: string;
  type: string;
  name: string | null;
  title: string | null;
  url: string | null;
  rawText: string;
  status: string;
  region: string;
  language: string | null;
  contentHash: string;
  articleCount: number;
  lastChecked: string | null;
  createdAt: string;
  updatedAt: string;
};

export const sourcePresetsApi = {
  list: () => apiRequest<SourcePreset[]>('/api/source-presets'),
  add: (presetId: string) => apiRequest<SourceRecord>(`/api/source-presets/${presetId}/add`, { method: 'POST' }),
};
