/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SourceFeed {
  id: string;
  name: string;
  url: string;
  type: 'RSS' | 'WEBSITE';
  status: 'active' | 'inactive' | 'error';
  lastChecked: string;
  articleCount: number;
  category: string;
}

export interface TopicArticle {
  id: string;
  originalTitle: string;
  originalUrl: string;
  sourceId: string;
  sourceName: string;
  pullTime: string;
  translatedTitle: string;
  summary: string;
  rawContent: string;
  englishOutline: string[];
  chineseOutline: string[];
  category: string;
  readingTime: string; // e.g. "5 min"
  status: 'pending' | 'pushed' | 'archived';
  hotScore: number; // 0-100
}

export interface AudienceVersion {
  title: string;
  excerpt: string;
  content: string; // Markdown / Rich content text
  wordCount: number;
}

export interface AiDraft {
  id: string;
  topicId: string;
  originalTitle: string;
  translatedTitle: string;
  category: string;
  versions: {
    officeWorker: AudienceVersion; // 打工人
    student: AudienceVersion;       // 大学生
    freelancer: AudienceVersion;    // 自由职业者
  };
  selectedAudience: 'officeWorker' | 'student' | 'freelancer';
  status: 'generating' | 'pending_review' | 'approved' | 'synced' | 'failed';
  reviewScore: number; // 0-5
  reviewerFeedback: string;
  createdAt: string;
  lastEdited: string;
  tokenCost: number;
  syncedTime?: string;
  wechatMediaId?: string;
}

export interface SyncTask {
  id: string;
  draftId: string;
  title: string;
  progress: number;
  status: 'queued' | 'syncing' | 'completed' | 'failed';
  message: string;
  timestamp: string;
  syncedVersion: 'officeWorker' | 'student' | 'freelancer';
}

export interface SystemLog {
  id: string;
  time: string;
  module: string;
  action: string;
  operator: string;
  type: 'info' | 'success' | 'warning' | 'error';
  tokensUsed?: number;
}

export interface ModelSetting {
  provider: 'Gemini' | 'Claude' | 'DeepSeek' | 'GPT-4o';
  modelId: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  officeWorkerPrompt: string;
  studentPrompt: string;
  freelancerPrompt: string;
}

export interface AppConfig {
  wechatAppId: string;
  wechatAppSecret: string;
  wechatIsConfigured: boolean;
  autoSyncActive: boolean;
  alertOnTokenLimit: boolean;
  monthlyTokenLimit: number;
  monthlyTokenUsed: number;
}
