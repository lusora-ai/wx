import { apiRequest } from './client';
import type { Audience, QualityCheckResult } from './articles';

export type AutomationPipelineStep = {
  key: 'collect' | 'select_source_item' | 'topic' | 'article' | 'quality' | 'package' | 'wechat_fill';
  label: string;
  status: 'done' | 'skipped' | 'blocked';
  message: string;
  entityType?: 'source' | 'sourceItem' | 'topic' | 'article' | 'publishTask' | 'wechatRun';
  entityId?: string;
  details?: Record<string, unknown>;
};

export type AutomationPipelineResult = {
  status: 'package_ready' | 'wechat_filled' | 'blocked';
  message: string;
  sourceItemId: string | null;
  topicId: string | null;
  articleId: string | null;
  publishTaskId: string | null;
  wechatRunId: string | null;
  quality: QualityCheckResult | null;
  wechat: {
    success: boolean;
    mode: 'poc_check' | 'inject_poc' | 'draft_save_poc';
    runId?: string | null;
    message: string;
    errorCode: string | null;
    evidence: Record<string, unknown>;
    warnings: string[];
  } | null;
  steps: AutomationPipelineStep[];
  boundary: {
    manualTriggerOnly: true;
    wechatSaveAttempted: false;
    scheduledPublish: false;
    batchPublish: false;
    officialWechatApi: false;
    imageGenerationApi: false;
  };
};

export const automationApi = {
  run: (input: {
    sourceId?: string;
    sourceItemId?: string;
    topicId?: string;
    articleId?: string;
    audience?: Audience;
    tone?: string;
    targetLength?: number;
    fillWechat?: boolean;
    forceNewArticle?: boolean;
  }) => apiRequest<AutomationPipelineResult>('/api/automation/run', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
};
