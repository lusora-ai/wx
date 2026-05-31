/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import SourceCenterView from './components/SourceCenterView';
import TopicWorkbenchView from './components/TopicWorkbenchView';
import AiWorkshopView from './components/AiWorkshopView';
import DraftLibraryView from './components/DraftLibraryView';
import PublishCenterView from './components/PublishCenterView';
import SettingsView from './components/SettingsView';
import { sourcesApi, type CreateSourceInput, type SourceRecord } from './api/sources';
import { topicsApi, type TopicRecord } from './api/topics';
import { articlesApi, type ArticleRecord, type Audience } from './api/articles';
import { publishApi, type PublishTaskRecord } from './api/publish';
import { settingsApi } from './api/settings';
import { sourceItemsApi } from './api/sourceItems';
import { useSources } from './hooks/useSources';
import { useTopics } from './hooks/useTopics';
import { useArticles } from './hooks/useArticles';
import { usePublishTasks } from './hooks/usePublishTasks';
import { useSettings } from './hooks/useSettings';
import { useDashboard } from './hooks/useDashboard';
import { dailyApi } from './api/daily';
import { automationApi } from './api/automation';
import type { ContentTask } from './api/tasks';
import { SourceFeed, TopicArticle, AiDraft, SystemLog, ModelSetting, AppConfig, SyncTask, VisualPlan } from './types';

const audienceLabels: Record<Audience, string> = {
  officeWorker: '打工人',
  student: '大学生',
  freelancer: '自由职业者',
};

function formatDate(value?: string | null) {
  if (!value) return '从未检查';
  return new Date(value).toISOString().replace('T', ' ').substring(0, 16);
}

function mapSource(source: SourceRecord): SourceFeed {
  return {
    id: source.id,
    name: source.name || source.title || '未命名内容源',
    title: source.title || undefined,
    url: source.url || '',
    rawText: source.rawText,
    type: source.type,
    status: source.status === 'archived' ? 'archived' : source.status === 'failed' ? 'error' : 'active',
    lastChecked: formatDate(source.lastChecked || source.updatedAt),
    articleCount: source.articleCount,
    category: source.type === 'manual' ? '手动录入' : source.type === 'url' ? 'URL 源' : 'RSS 源',
    region: source.region || 'global',
    items: source.items?.map((item) => ({ id: item.id, title: item.title, url: item.url, status: item.status, createdAt: item.createdAt })) || [],
  };
}

function mapTopic(topic: TopicRecord): TopicArticle {
  return {
    id: topic.id,
    originalTitle: topic.originalTitle || topic.title,
    originalUrl: topic.originalUrl || topic.source?.url || '',
    sourceId: topic.sourceId || '',
    sourceItemId: topic.sourceItemId || undefined,
    sourceName: topic.source?.name || topic.source?.title || '手动内容源',
    pullTime: formatDate(topic.createdAt),
    translatedTitle: topic.translatedTitle || topic.title,
    title: topic.title,
    angle: topic.angle || undefined,
    summary: topic.summary,
    rawContent: topic.rawContent || '',
    englishOutline: [...(topic.uncertainClaims || []), ...(topic.suggestedTitles || [])],
    chineseOutline: topic.facts || [],
    facts: topic.facts || [],
    uncertainClaims: topic.uncertainClaims || [],
    suggestedTitles: topic.suggestedTitles || [],
    targetAudiences: topic.targetAudiences || [],
    category: topic.category || 'AI 资讯',
    readingTime: topic.readingTime || '3 min',
    status: topic.status as TopicArticle['status'],
    hotScore: topic.hotScore || 75,
  };
}

function emptyVersion(label: string) {
  return { title: `${label}版本待生成`, excerpt: '请先在 AI 写作工坊生成文章。', content: '', wordCount: 0 };
}

function parseArticleVisualPlan(value?: string | null): VisualPlan | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as VisualPlan;
  } catch {
    return null;
  }
}

function mapArticlesToDrafts(articles: ArticleRecord[], topics: TopicArticle[]): AiDraft[] {
  const grouped = new Map<string, ArticleRecord[]>();
  for (const article of articles) {
    grouped.set(article.topicId || article.id, [...(grouped.get(article.topicId || article.id) || []), article]);
  }

  return Array.from(grouped.values()).map((items) => {
    const first = items[0];
    const topic = topics.find((item) => item.id === first.topicId);
    const byAudience: Partial<Record<Audience, ArticleRecord>> = {};
    for (const item of items) {
      if (!byAudience[item.audience]) byAudience[item.audience] = item;
    }
    const selectedAudience = (first.audience || 'officeWorker') as Audience;
    const versions = {
      officeWorker: byAudience.officeWorker
        ? { title: byAudience.officeWorker.title, excerpt: byAudience.officeWorker.summary || '', content: byAudience.officeWorker.markdown, wordCount: byAudience.officeWorker.markdown.length }
        : emptyVersion('打工人'),
      student: byAudience.student
        ? { title: byAudience.student.title, excerpt: byAudience.student.summary || '', content: byAudience.student.markdown, wordCount: byAudience.student.markdown.length }
        : emptyVersion('大学生'),
      freelancer: byAudience.freelancer
        ? { title: byAudience.freelancer.title, excerpt: byAudience.freelancer.summary || '', content: byAudience.freelancer.markdown, wordCount: byAudience.freelancer.markdown.length }
        : emptyVersion('自由职业者'),
    };

    return {
      id: first.topicId || first.id,
      articleIds: {
        officeWorker: byAudience.officeWorker?.id,
        student: byAudience.student?.id,
        freelancer: byAudience.freelancer?.id,
      },
      imageSlots: {
        officeWorker: byAudience.officeWorker?.imageSlots || [],
        student: byAudience.student?.imageSlots || [],
        freelancer: byAudience.freelancer?.imageSlots || [],
      },
      visualPlans: {
        officeWorker: parseArticleVisualPlan(byAudience.officeWorker?.visualPlanJson),
        student: parseArticleVisualPlan(byAudience.student?.visualPlanJson),
        freelancer: parseArticleVisualPlan(byAudience.freelancer?.visualPlanJson),
      },
      topicId: first.topicId || '',
      originalTitle: topic?.originalTitle || first.topic?.originalTitle || first.title,
      translatedTitle: topic?.translatedTitle || first.topic?.translatedTitle || first.title,
      category: topic?.category || first.topic?.category || 'AI 资讯',
      selectedAudience,
      status: first.status === 'draft' ? 'pending_review' : (first.status as AiDraft['status']),
      reviewScore: first.qualityScore || 0,
      reviewerFeedback: first.reviewerFeedback || '',
      createdAt: formatDate(first.createdAt),
      lastEdited: formatDate(first.updatedAt),
      tokenCost: items.reduce((sum, item) => sum + (item.tokenUsage || 0), 0),
      versions,
    };
  });
}

function mapTask(task: PublishTaskRecord): SyncTask {
  return {
    id: task.id,
    draftId: task.article?.topicId || task.articleId,
    articleId: task.articleId,
    title: task.title || task.article?.title || 'dry-run 发布包任务',
    progress: task.status === 'success' ? 100 : task.status === 'failed' ? 100 : 20,
    status: task.status === 'success' ? 'completed' : task.status === 'failed' ? 'failed' : 'queued',
    message: task.status === 'success' ? '发布包已生成，dry-run 已记录，等待手动发布。' : task.errorMessage || 'dry-run 任务处理中。',
    timestamp: formatDate(task.createdAt).slice(11),
    syncedVersion: (task.syncedVersion || task.article?.audience || 'officeWorker') as Audience,
    outputHtml: task.outputHtml || undefined,
    outputMarkdown: task.outputMarkdown || undefined,
    packageJson: task.packageJson || undefined,
  };
}

export default function App() {
  const sourcesResource = useSources();
  const topicsResource = useTopics();
  const articlesResource = useArticles();
  const publishResource = usePublishTasks();
  const settingsResource = useSettings();
  const dashboardResource = useDashboard();

  const [activeTab, setActiveTab] = useState<string>(() => localStorage.getItem('xs_active_tab') || 'dashboard');
  const [selectedTopicIdForWorkshop, setSelectedTopicIdForWorkshop] = useState<string | null>(null);
  const [selectedTopicIdForQueue, setSelectedTopicIdForQueue] = useState<string | null>(null);
  const [selectedArticleIdForWorkshop, setSelectedArticleIdForWorkshop] = useState<string | null>(null);
  const [focusedSourceId, setFocusedSourceId] = useState<string | null>(null);
  const [focusedSourceItemId, setFocusedSourceItemId] = useState<string | null>(null);
  const [selectedDraftIdForLibrary, setSelectedDraftIdForLibrary] = useState<string | null>(null);
  const [selectedDraftIdForPublish, setSelectedDraftIdForPublish] = useState<string | null>(null);
  const [selectedPublishTaskId, setSelectedPublishTaskId] = useState<string | null>(() => localStorage.getItem('xs_publish_task_id') || null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isRefreshingFeeds, setIsRefreshingFeeds] = useState(false);

  useEffect(() => {
    if (selectedPublishTaskId) {
      localStorage.setItem('xs_publish_task_id', selectedPublishTaskId);
    } else {
      localStorage.removeItem('xs_publish_task_id');
    }
  }, [selectedPublishTaskId]);

  const sources = useMemo(() => sourcesResource.data.map(mapSource), [sourcesResource.data]);
  const topics = useMemo(() => topicsResource.data.map(mapTopic), [topicsResource.data]);
  const drafts = useMemo(() => mapArticlesToDrafts(articlesResource.data, topics), [articlesResource.data, topics]);
  const syncTasks = useMemo(() => publishResource.data.map(mapTask), [publishResource.data]);
  const logs: SystemLog[] = useMemo(() => dashboardResource.data.recentLogs.map((log) => ({
    id: log.id,
    time: formatDate(log.createdAt),
    module: log.module,
    action: log.action,
    operator: log.operator || 'system',
    type: log.type,
    tokensUsed: log.tokensUsed || undefined,
  })), [dashboardResource.data.recentLogs]);

  const appConfig: AppConfig = {
    wechatAppId: '',
    wechatAppSecret: '',
    wechatIsConfigured: false,
    autoSyncActive: false,
    alertOnTokenLimit: true,
    monthlyTokenLimit: 10000000,
    monthlyTokenUsed: dashboardResource.data.tokenUsedToday,
  };

  const modelSetting: ModelSetting = {
    provider: settingsResource.data.llmProvider === 'deepseek' ? 'DeepSeek' : 'Kimi',
    modelId: settingsResource.data.llmModel,
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: '服务端 AI 内容主编，严格基于来源生成。',
    officeWorkerPrompt: '打工人：关注职场效率、岗位变化、AI 工具实操。',
    studentPrompt: '大学生：关注学习、求职、入门路径。',
    freelancerPrompt: '自由职业者：关注接单、商业化、个人品牌。',
  };

  const setTab = (tab: string) => {
    localStorage.setItem('xs_active_tab', tab);
    setActiveTab(tab);
  };

  const setSelectedTopic = (id: string | null) => {
    setSelectedTopicIdForWorkshop(id);
  };

  const refreshAll = async () => {
    await Promise.all([
      sourcesResource.refresh(),
      topicsResource.refresh(),
      articlesResource.refresh(),
      publishResource.refresh(),
      dashboardResource.refresh(),
    ]);
  };

  const runAction = async (message: string, action: () => Promise<unknown>) => {
    setNotice(message);
    try {
      await action();
      await refreshAll();
      setNotice('操作已完成');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '操作失败');
    }
  };

  const handleAddSource = (sourceData: CreateSourceInput) => runAction('保存内容源中...', () => sourcesApi.create(sourceData));
  const handleDeleteSource = (id: string) => runAction('归档内容源中...', () => sourcesApi.archive(id));
  const handlePermanentDeleteSource = (id: string) => runAction('永久删除内容源中...', () => sourcesApi.permanentDelete(id));
  const handleToggleSourceStatus = (id: string) => runAction('更新内容源状态中...', () => sourcesApi.update(id, { status: 'pending' }));
  const handleVerifyCheckSource = (id: string) => runAction('抓取内容源中...', () => sourcesApi.fetch(id));
  const handleFetchAllSources = () => runAction('抓取全部 active RSS/URL 源中...', () => sourcesApi.fetchAll());
  const handleRunAutomation = async (fillWechat: boolean) => {
    setNotice(fillWechat ? '正在执行主线流水线并填入微信...' : '正在执行主线流水线...');
    const result = await automationApi.run({
      audience: 'officeWorker',
      targetLength: 900,
      fillWechat,
    });
    await refreshAll();
    if (result.topicId) setSelectedTopic(result.topicId);
    if (result.articleId) setSelectedArticleIdForWorkshop(result.articleId);
    if (result.publishTaskId) {
      setSelectedPublishTaskId(result.publishTaskId);
      setSelectedDraftIdForPublish(result.topicId || result.articleId);
      setTab(result.status === 'blocked' && !result.publishTaskId ? 'workshop' : 'publish');
    }
    setNotice(result.message);
    return result;
  };
  const handleGenerateSourceItemTopic = (id: string) => runAction('正在从抓取内容生成选题...', async () => {
    const topic = await sourceItemsApi.generateTopic(id);
    setSelectedTopic(topic.id);
    setTab('topics');
  });
  const handleGenerateTopic = (id: string) => runAction('正在提炼事实点...', async () => {
    const topic = await topicsApi.generate(id);
    setSelectedTopic(topic.id);
    setTab('topics');
  });

  const handleRefreshGlobalFeeds = () => {
    setIsRefreshingFeeds(true);
    runAction('抓取全部 active RSS/URL 源中...', () => sourcesApi.fetchAll()).finally(() => setIsRefreshingFeeds(false));
  };

  const handlePushToWorkshop = (id: string) => runAction('推送到写作工坊中...', async () => {
    await topicsApi.push(id);
    setSelectedTopic(id);
    setTab('workshop');
  });
  const handleArchiveTopic = (id: string) => runAction('归档选题中...', () => topicsApi.archive(id));
  const handleOpenDraftLibrary = (draftId: string) => {
    setSelectedDraftIdForLibrary(draftId);
    setTab('drafts');
  };

  const handleGenerateArticle = async (topicId: string, options: { audience: Audience; tone?: string; targetLength?: number }) => {
    setNotice(`正在生成${audienceLabels[options.audience]}版本...`);
    const result = await articlesApi.generate({
      topicId,
      audience: options.audience,
      tone: options.tone,
      targetLength: options.targetLength,
    });
    await refreshAll();
    setSelectedArticleIdForWorkshop(result.article.id);
    if (result.visualPlanStatus === 'failed') {
      setNotice('正文已生成，段落配图生成失败，可稍后重试。');
    } else if (result.visualPlanStatus === 'fallback') {
      setNotice('正文已生成，Kimi 段落配图超时，已使用 DeepSeek 兜底方案。');
    } else {
      setNotice(`正文已生成，已生成 ${result.visualPlan?.imagePromptSet.inlineImages.length ? result.visualPlan.imagePromptSet.inlineImages.length + 2 : 0} 条段落配图提示词。`);
    }
    return { article: result.article, visualPlanStatus: result.visualPlanStatus, visualPlanWarnings: result.visualPlanWarnings };
  };

  const handleTaskAction = (task: ContentTask) => {
    const payload = task.actionPayload;
    const tab = payload?.tab || task.actionHref;
    if (task.relatedEntityType === 'source') {
      setFocusedSourceId(payload?.sourceId || task.relatedEntityId);
      setFocusedSourceItemId(null);
      setTab('sources');
      return;
    }
    if (task.relatedEntityType === 'sourceItem') {
      setFocusedSourceId(null);
      setFocusedSourceItemId(payload?.sourceItemId || task.relatedEntityId);
      setTab('sources');
      return;
    }
    if (task.relatedEntityType === 'topic') {
      const topicId = payload?.topicId || task.relatedEntityId;
      setSelectedTopicIdForQueue(topicId);
      setSelectedTopic(topicId);
      setTab(tab === 'workshop' ? 'workshop' : 'topics');
      return;
    }
    if (task.relatedEntityType === 'article') {
      const articleId = payload?.articleId || task.relatedEntityId;
      const article = articlesResource.data.find((item) => item.id === articleId);
      setSelectedArticleIdForWorkshop(articleId);
      setSelectedTopic(article?.topicId || null);
      setTab('workshop');
      return;
    }
    if (task.relatedEntityType === 'publishTask') {
      const publishTaskId = payload?.publishTaskId || task.relatedEntityId;
      const publishTask = publishResource.data.find((item) => item.id === publishTaskId);
      setSelectedPublishTaskId(publishTaskId);
      setSelectedDraftIdForPublish(publishTask?.article?.topicId || publishTask?.articleId || null);
      setTab('publish');
    }
  };

  const handleSaveDraftToLibrary = (updatedDraft: AiDraft) => runAction('保存文章版本中...', async () => {
    for (const audience of ['officeWorker', 'student', 'freelancer'] as Audience[]) {
      const articleId = updatedDraft.articleIds?.[audience];
      if (!articleId) continue;
      const version = updatedDraft.versions[audience];
      await articlesApi.update(articleId, {
        title: version.title,
        summary: version.excerpt,
        markdown: version.content,
        status: 'editing',
      });
    }
    setTab('drafts');
  });

  const handleUpdateDraftStatus = (id: string, status: AiDraft['status'], score?: number, feedback?: string) => runAction('更新审核状态中...', async () => {
    const draft = drafts.find((item) => item.id === id);
    const articleId = draft?.articleIds?.[draft.selectedAudience];
    if (!articleId) return;
    if (status === 'approved') await articlesApi.approve(articleId, { qualityScore: score, comment: feedback });
    else await articlesApi.update(articleId, { status, reviewerFeedback: feedback });
  });

  const handleExportDraftToPublish = async (draftId: string, score?: number, feedback?: string) => {
    const draft = drafts.find((item) => item.id === draftId);
    const articleId = draft?.articleIds?.[draft.selectedAudience];
    if (!draft || !articleId) {
      setNotice('请选择一篇已生成文章。');
      return;
    }
    setNotice('正在质检并生成 dry-run 发布包...');
    try {
      await articlesApi.approve(articleId, { qualityScore: score, comment: feedback });
      const quality = await articlesApi.qualityCheck(articleId);
      if (!quality.passed) {
        const highRisk = quality.issues.find((issue) => issue.severity === 'high');
        setNotice(highRisk?.message || '质量检查未通过，请先修改文章。');
        await refreshAll();
        return;
      }
      const result = await articlesApi.createPublishPackage(articleId);
      await refreshAll();
      setSelectedPublishTaskId(result.publishTaskId);
      setSelectedDraftIdForPublish(draft.id);
      setTab('publish');
      setNotice(result.reused ? '已有发布包，已进入微信发布中心。' : '发布包已生成，已进入微信发布中心。');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '生成发布包失败');
    }
  };

  const handleDeleteDraft = (id: string) => runAction('标记文章为归档中...', async () => {
    const draft = drafts.find((item) => item.id === id);
    const articleId = draft?.articleIds?.[draft.selectedAudience];
    if (articleId) await articlesApi.update(articleId, { status: 'failed' });
  });

  const handleTriggerWechatSync = (draftId: string) => runAction('创建 dry-run 草稿任务中...', async () => {
    const draft = drafts.find((item) => item.id === draftId);
    const articleId = draft?.articleIds?.[draft.selectedAudience];
    if (!articleId) throw new Error('请选择一篇已生成文章。');
    const task = await publishApi.create(articleId);
    setSelectedPublishTaskId(task.id);
    setSelectedDraftIdForPublish(draftId);
  });

  const handleCreatePublishPackage = async (articleId: string) => {
    setNotice('正在生成发布包...');
    try {
      const result = await articlesApi.createPublishPackage(articleId);
      await refreshAll();
      setSelectedPublishTaskId(result.publishTaskId);
      setSelectedDraftIdForPublish(result.task.article?.topicId || result.task.articleId);
      setTab('publish');
      setNotice(result.reused ? '当前版本已有发布包，已直接使用。' : result.statusText.join('，'));
    } catch (error) {
      const message = error instanceof Error ? error.message : '生成发布包失败';
      setNotice(message);
    }
  };

  const handleSaveModelSetting = (setting: ModelSetting) => runAction('保存模型设置中...', () => settingsApi.update({
    llmProvider: setting.provider === 'DeepSeek' ? 'deepseek' : 'kimi',
    llmModel: setting.modelId,
  }));

  const handleSaveAppConfig = () => runAction('保存发布设置中...', () => settingsApi.update({ publishMode: 'dry_run' }));

  const isInitialLoading = sourcesResource.loading || topicsResource.loading || articlesResource.loading;
  const errorMessage = sourcesResource.error || topicsResource.error || articlesResource.error || publishResource.error || settingsResource.error || dashboardResource.error;

  return (
    <div id="saas-system-layout" className="flex h-screen bg-apple-bg text-apple-dark font-sans overflow-hidden antialiased select-none">
      <Sidebar activeTab={activeTab} setActiveTab={setTab} sources={sources} topics={topics} drafts={drafts} appConfig={appConfig} />
      <main id="app-main-layout" className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header activeTab={activeTab} appConfig={appConfig} onRefreshFeeds={handleRefreshGlobalFeeds} isRefreshingFeeds={isRefreshingFeeds} />
        {(notice || errorMessage || isInitialLoading) && (
          <div className="absolute top-18 right-6 z-40 rounded-2xl border border-apple-border bg-white px-4 py-2 text-xs font-semibold text-apple-dark shadow-lg">
            {isInitialLoading ? '正在从 API 加载数据...' : errorMessage || notice}
          </div>
        )}
        <div id="viewport-pane" className="flex-1 overflow-y-auto p-8 bg-apple-bg">
          {activeTab === 'dashboard' && <DashboardView sources={sources} topics={topics} drafts={drafts} logs={logs} appConfig={appConfig} setActiveTab={setTab} setSelectedTopicIdForWorkshop={setSelectedTopic} onTaskAction={handleTaskAction} onFetchToday={() => runAction('一键抓取今日内容中...', () => dailyApi.fetchToday())} onRunAutomation={handleRunAutomation} />}
          {activeTab === 'sources' && <SourceCenterView sources={sources} focusedSourceId={focusedSourceId} focusedSourceItemId={focusedSourceItemId} onAddSource={handleAddSource} onDeleteSource={handleDeleteSource} onPermanentDeleteSource={handlePermanentDeleteSource} onToggleStatus={handleToggleSourceStatus} isRefreshing={isRefreshingFeeds} onTriggerCheck={handleVerifyCheckSource} onFetchAllSources={handleFetchAllSources} onGenerateTopic={handleGenerateTopic} onGenerateSourceItemTopic={handleGenerateSourceItemTopic} />}
          {activeTab === 'topics' && <TopicWorkbenchView topics={topics} drafts={drafts} selectedTopicId={selectedTopicIdForQueue} onPushToWorkshop={handlePushToWorkshop} onArchiveTopic={handleArchiveTopic} onOpenDraftLibrary={handleOpenDraftLibrary} setActiveTab={setTab} setSelectedTopicIdForWorkshop={setSelectedTopic} />}
          {activeTab === 'workshop' && <AiWorkshopView topics={topics} drafts={drafts} selectedTopicId={selectedTopicIdForWorkshop} selectedArticleId={selectedArticleIdForWorkshop} setSelectedTopicId={setSelectedTopic} modelSetting={modelSetting} onSaveDraft={handleSaveDraftToLibrary} onGenerateArticle={handleGenerateArticle} onCreatePublishPackage={handleCreatePublishPackage} setActiveTab={setTab} />}
          {activeTab === 'drafts' && <DraftLibraryView drafts={drafts} selectedDraftId={selectedDraftIdForLibrary} onUpdateDraftStatus={handleUpdateDraftStatus} onExportDraftToPublish={handleExportDraftToPublish} onDeleteDraft={handleDeleteDraft} setSelectedTopicIdForWorkshop={setSelectedTopic} setActiveTab={setTab} />}
          {activeTab === 'publish' && <PublishCenterView drafts={drafts} selectedDraftId={selectedDraftIdForPublish} selectedPublishTaskId={selectedPublishTaskId} setSelectedDraftId={setSelectedDraftIdForPublish} setSelectedPublishTaskId={setSelectedPublishTaskId} syncTasks={syncTasks} onTriggerSyncTask={handleTriggerWechatSync} onRefresh={refreshAll} setActiveTab={setTab} />}
          {activeTab === 'settings' && <SettingsView modelSetting={modelSetting} appConfig={appConfig} onSaveModelSetting={handleSaveModelSetting} onSaveAppConfig={handleSaveAppConfig} />}
        </div>
      </main>
    </div>
  );
}
