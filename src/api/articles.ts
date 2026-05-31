import { apiRequest } from './client';
import type { TopicRecord } from './topics';
import type { ArticleImageSlot, PublishPackage, VisualPlan } from '../types';
import type { PublishTaskRecord } from './publish';

export type Audience = 'officeWorker' | 'student' | 'freelancer';

export type ArticleRecord = {
  id: string;
  topicId?: string | null;
  audience: Audience;
  title: string;
  summary?: string | null;
  markdown: string;
  html?: string | null;
  cta?: string | null;
  status: string;
  currentVersion: number;
  tokenUsage?: number | null;
  visualPlanJson?: string | null;
  qualityScore?: number | null;
  reviewerFeedback?: string | null;
  createdAt: string;
  updatedAt: string;
  topic?: TopicRecord | null;
  versions?: { id: string; version: number; title: string; markdown: string; html?: string | null; changeType: string; createdAt: string }[];
  imageSlots?: ArticleImageSlot[];
};

export type QualityCheckResult = {
  passed: boolean;
  score: number;
  issues: { type: string; message: string; severity: string }[];
};

export type ArticleWorkflowStatus = {
  articleId: string;
  topicId: string | null;
  sourceItemId: string | null;
  audience: string | null;
  title: string;
  stage: 'draft' | 'needs_quality_check' | 'quality_outdated' | 'quality_failed' | 'quality_passed' | 'package_ready' | 'waiting_manual_publish';
  quality: {
    checked: boolean;
    passed: boolean;
    score: number | null;
    riskCount: number;
    risks: { code: string; message: string; severity: 'low' | 'medium' | 'high' }[];
    latestReviewLogId: string | null;
    checkedAt: string | null;
  };
  version: {
    currentVersion: number | null;
    latestSavedAt: string | null;
    manuallyEdited: boolean;
  };
  publish: {
    hasPackage: boolean;
    latestPublishTaskId: string | null;
    status: string | null;
    createdAt: string | null;
  };
  nextAction: {
    type: 'run_quality_check' | 'edit_article' | 'create_package' | 'view_publish_task' | 'none';
    label: string;
    reason: string;
  };
};

export const articlesApi = {
  list: () => apiRequest<ArticleRecord[]>('/api/articles'),
  generate: (input: { topicId: string; audience: Audience; tone?: string; targetLength?: number }) =>
    apiRequest<{ article: ArticleRecord; imageSlots: ArticleImageSlot[]; visualPlan: VisualPlan | null; visualPlanStatus: 'generated' | 'fallback' | 'failed'; visualPlanWarnings: string[]; elapsedMs: number }>('/api/articles/generate', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<Pick<ArticleRecord, 'title' | 'summary' | 'markdown' | 'cta' | 'status' | 'reviewerFeedback'>>) =>
    apiRequest<ArticleRecord>(`/api/articles/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  exportHtml: (id: string) => apiRequest<{ article: ArticleRecord; html: string; markdown: string }>(`/api/articles/${id}/export-html`, { method: 'POST' }),
  approve: (id: string, input: { qualityScore?: number; comment?: string }) =>
    apiRequest<ArticleRecord>(`/api/reviews/${id}/approve`, { method: 'POST', body: JSON.stringify(input) }),
  qualityCheck: (articleId: string) =>
    apiRequest<QualityCheckResult>('/api/reviews/check', { method: 'POST', body: JSON.stringify({ articleId }) }),
  workflowStatus: (id: string) => apiRequest<ArticleWorkflowStatus>(`/api/articles/${id}/workflow-status`),
  generateVisualPlan: (id: string) =>
    apiRequest<{ articleId: string; articleVersion: number; visualPlan: VisualPlan | null; status: 'generated' | 'fallback' | 'failed'; warnings: string[] }>(`/api/articles/${id}/visual-plan`, { method: 'POST' }),
  createPublishPackage: (id: string, forceRegenerate?: boolean) =>
    apiRequest<{ publishTaskId: string; task: PublishTaskRecord; package: PublishPackage; packageSummary?: { imagePromptCount: number; imagePromptSource: string; warnings: string[]; visualPlanStatus?: string }; statusText: string[]; reused?: boolean }>(`/api/articles/${id}/publish-package`, { method: 'POST', body: JSON.stringify({ forceRegenerate: forceRegenerate ?? false }) }),
  ensurePublishTask: (id: string) =>
    apiRequest<{ ensured: boolean; reused: boolean; publishTaskId: string; stage: string; message: string }>(`/api/articles/${id}/ensure-publish-task`, { method: 'POST' }),
};
