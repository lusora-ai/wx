/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SourceFeed {
  id: string;
  name: string;
  url: string;
  type: 'manual' | 'url' | 'rss' | 'RSS' | 'WEBSITE';
  status: 'pending' | 'extracted' | 'failed' | 'archived' | 'active' | 'inactive' | 'error';
  lastChecked: string;
  articleCount: number;
  category: string;
  rawText?: string;
  title?: string;
  region?: 'domestic' | 'global';
  items?: {
    id: string;
    title: string;
    url?: string | null;
    status: string;
    createdAt: string;
  }[];
}

export interface TopicArticle {
  id: string;
  originalTitle: string;
  originalUrl: string;
  sourceId: string;
  sourceItemId?: string;
  sourceName: string;
  pullTime: string;
  translatedTitle: string;
  title?: string;
  summary: string;
  rawContent: string;
  englishOutline: string[];
  chineseOutline: string[];
  facts?: string[];
  uncertainClaims?: string[];
  suggestedTitles?: string[];
  targetAudiences?: string[];
  angle?: string;
  category: string;
  readingTime: string; // e.g. "5 min"
  status: 'pending' | 'pushed' | 'approved' | 'rejected' | 'generated' | 'archived';
  hotScore: number; // 0-100
}

export interface AudienceVersion {
  title: string;
  excerpt: string;
  content: string; // Markdown / Rich content text
  wordCount: number;
}

export type AudienceKey = 'officeWorker' | 'student' | 'freelancer';

export interface ArticleImageSlot {
  id: string;
  articleId: string;
  slotKey: string;
  paragraphIndex: number;
  marker: string;
  reason: string;
  promptZh: string;
  promptEn?: string | null;
  negativePrompt?: string | null;
  aspectRatio: '16:9' | '4:3' | '1:1';
  stylePreset: string;
  altText?: string | null;
  status: 'prompt_ready' | 'skipped';
  createdAt: string;
  updatedAt: string;
}

export interface AiDraft {
  id: string;
  topicId: string;
  articleIds?: Partial<Record<AudienceKey, string>>;
  imageSlots?: Partial<Record<AudienceKey, ArticleImageSlot[]>>;
  visualPlans?: Partial<Record<AudienceKey, VisualPlan | null>>;
  originalTitle: string;
  translatedTitle: string;
  category: string;
  versions: {
    officeWorker: AudienceVersion; // 打工人
    student: AudienceVersion;       // 大学生
    freelancer: AudienceVersion;    // 自由职业者
  };
  selectedAudience: AudienceKey;
  status: 'generating' | 'draft' | 'editing' | 'pending_review' | 'review_pending' | 'approved' | 'exported' | 'synced' | 'failed';
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
  articleId?: string;
  title: string;
  progress: number;
  status: 'queued' | 'syncing' | 'completed' | 'failed' | 'success' | 'pending' | 'running';
  message: string;
  timestamp: string;
  outputHtml?: string;
  outputMarkdown?: string;
  packageJson?: string;
  syncedVersion: 'officeWorker' | 'student' | 'freelancer';
}

export interface PublishPackage {
  title: string;
  titleAlternatives?: string[];
  summary: string;
  markdown: string;
  html: string;
  privateDomainCta: string;
  visualPlan?: VisualPlan | null;
  visualPlanStatus?: 'ready' | 'stale' | 'missing' | 'failed';
  noVisualPlan?: boolean;
  imagePromptSet: {
    cover: PublishImagePrompt;
    inlineImages: PublishImagePrompt[];
    socialShare: PublishImagePrompt | null;
  } | null;
  imagePromptCount: number;
  imagePromptSource?: 'kimi-2.6' | 'deepseek-v4-pro-fallback' | 'local_template_fallback' | 'legacy' | 'none';
  imagePromptWarnings?: string[];
  imageSlots: {
    slotKey: string;
    promptZh: string;
    promptEn: string;
    negativePrompt: string;
    aspectRatio: string;
    stylePreset: string;
    altText: string;
  }[];
  tags: string[];
  cta: string;
  aiDisclosure: boolean;
  sourceUrl: string;
}

export interface PublishImagePrompt {
  slot: 'cover' | `section_${number}` | 'section_1' | 'section_2' | 'section_3' | 'section_4' | 'summary_card' | 'social_share';
  label: string;
  purpose: string;
  relatedSectionTitle?: string | null;
  insertAfterParagraph?: number | null;
  prompt: string;
  negativePrompt: string;
  suggestedRatio: '2.35:1' | '16:9' | '4:3' | '1:1' | '3:4';
  placementHint: string;
}

export interface VisualPlan {
  articleId: string;
  articleVersion: number;
  source: 'kimi_article_reading' | 'fallback_after_kimi_timeout' | 'fallback_after_kimi_error' | 'local_template_fallback';
  generatedBy: 'kimi-2.6' | 'deepseek-v4-pro-fallback' | 'local_template_fallback';
  basedOnArticleVersion: number;
  generatedAt: string;
  stale: boolean;
  visualStrategy: {
    overallStyle: string;
    audienceFit: string;
    avoid: string[];
  };
  imagePromptSet: {
    cover: PublishImagePrompt;
    inlineImages: PublishImagePrompt[];
    socialShare: PublishImagePrompt;
  };
  warnings: string[];
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
  provider: 'DeepSeek' | 'Kimi';
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
