import { apiRequest } from './client';
import type { ArticleRecord } from './articles';
import type { PublishPackage } from '../types';

export type PublishTaskRecord = {
  id: string;
  articleId: string;
  channel: string;
  mode: string;
  status: string;
  title?: string | null;
  outputMarkdown?: string | null;
  outputHtml?: string | null;
  packageJson?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  syncedVersion?: string | null;
  createdAt: string;
  updatedAt: string;
  article?: ArticleRecord;
};

export const publishApi = {
  list: () => apiRequest<PublishTaskRecord[]>('/api/publish/tasks'),
  create: (articleId: string, forceRegenerate?: boolean) => apiRequest<PublishTaskRecord>('/api/publish/tasks', { method: 'POST', body: JSON.stringify({ articleId, channel: 'wechat', mode: 'dry_run', forceRegenerate: forceRegenerate ?? false }) }),
  getPackage: (taskId: string) => apiRequest<PublishPackage>(`/api/publish/tasks/${taskId}/package`),
};
