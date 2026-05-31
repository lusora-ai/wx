import { prisma } from '../db/prisma';
import { getArticleWorkflowStatusMap } from './articleWorkflowStatus';

export type ContentTaskType =
  | 'FETCH_SOURCE'
  | 'REVIEW_SOURCE_ITEM'
  | 'CREATE_TOPIC'
  | 'GENERATE_ARTICLE'
  | 'QUALITY_CHECK'
  | 'EDIT_ARTICLE'
  | 'CREATE_PACKAGE'
  | 'READY_TO_MANUAL_PUBLISH';

export type ContentTaskPriority = 'high' | 'medium' | 'low';
export type ContentTaskStatus = 'pending' | 'blocked' | 'done';
export type RelatedEntityType = 'source' | 'sourceItem' | 'topic' | 'article' | 'publishTask';

export type ContentTask = {
  id: string;
  type: ContentTaskType;
  title: string;
  description: string;
  priority: ContentTaskPriority;
  status: ContentTaskStatus;
  relatedEntityType: RelatedEntityType;
  relatedEntityId: string;
  actionLabel: string;
  actionHref: string;
  actionPayload: {
    tab: string;
    sourceId?: string;
    sourceItemId?: string;
    topicId?: string;
    articleId?: string;
    publishTaskId?: string;
  };
  reason: string;
  derivedAt: string;
};

export type TodayTaskStats = {
  fetchedItemsToday: number;
  usableSourceItems: number;
  topicsToday: number;
  articlesToday: number;
  passedQualityArticles: number;
  publishPackagesToday: number;
};

export type TodayTaskResponse = {
  stats: TodayTaskStats;
  primaryTask: ContentTask | null;
  tasks: ContentTask[];
};

const TEST_PATTERNS = ['[DEV]', '[TEST]', '[MOCK]', 'E2E', '127.0.0.1', 'localhost'];
const priorityWeight: Record<ContentTaskPriority, number> = { high: 3, medium: 2, low: 1 };
const statusWeight: Record<ContentTaskStatus, number> = { pending: 3, blocked: 2, done: 1 };

function hasTestPattern(...fields: Array<string | null | undefined>) {
  return fields
    .filter(Boolean)
    .some((field) => TEST_PATTERNS.some((pattern) => field!.includes(pattern)));
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function payloadFor(type: RelatedEntityType, id: string, fallbackTab: string) {
  if (type === 'source') return { tab: 'sources', sourceId: id };
  if (type === 'sourceItem') return { tab: 'sources', sourceItemId: id };
  if (type === 'topic') return { tab: fallbackTab, topicId: id };
  if (type === 'article') return { tab: 'workshop', articleId: id };
  return { tab: 'publish', publishTaskId: id };
}

function task(input: Omit<ContentTask, 'id' | 'derivedAt' | 'actionPayload'> & { actionPayload?: ContentTask['actionPayload'] }): ContentTask {
  return {
    ...input,
    id: `${input.type}:${input.relatedEntityType}:${input.relatedEntityId}`,
    actionPayload: input.actionPayload ?? payloadFor(input.relatedEntityType, input.relatedEntityId, input.actionHref),
    derivedAt: new Date().toISOString(),
  };
}

export async function getTodayContentTasks(): Promise<TodayTaskResponse> {
  const today = startOfToday();

  const [sources, sourceItems, topics, articles, publishTasks] = await Promise.all([
    prisma.source.findMany({
      where: { status: { not: 'archived' } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.sourceItem.findMany({
      where: { status: { not: 'archived' } },
      include: { source: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.topic.findMany({
      where: { status: { not: 'archived' } },
      include: { source: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.article.findMany({
      include: { topic: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.publishTask.findMany({ orderBy: { createdAt: 'desc' } }),
  ]);

  const realSources = sources.filter((source) =>
    !hasTestPattern(source.name, source.title, source.url, source.rawText)
  );
  const realSourceIds = new Set(realSources.map((source) => source.id));

  const realSourceItems = sourceItems.filter((item) =>
    realSourceIds.has(item.sourceId) &&
    !hasTestPattern(item.title, item.url, item.rawText, item.source?.name, item.source?.title, item.source?.url)
  );
  const sourceItemIds = new Set(realSourceItems.map((item) => item.id));

  const realTopics = topics.filter((topic) =>
    Boolean(topic.sourceItemId) &&
    (!topic.sourceId || realSourceIds.has(topic.sourceId)) &&
    !hasTestPattern(topic.title, topic.originalTitle, topic.translatedTitle, topic.summary, topic.rawContent, topic.source?.name, topic.source?.title)
  );
  const topicIds = new Set(realTopics.map((topic) => topic.id));
  const topicBySourceItemId = new Map(realTopics.filter((topic) => topic.sourceItemId).map((topic) => [topic.sourceItemId!, topic]));

  const realArticles = articles.filter((article) =>
    article.topicId &&
    topicIds.has(article.topicId) &&
    !hasTestPattern(article.title, article.summary, article.markdown, article.topic?.title, article.topic?.translatedTitle)
  );
  const articleIds = realArticles.map((article) => article.id);
  const articleByTopicId = new Map(realArticles.filter((article) => article.topicId).map((article) => [article.topicId!, article]));

  const realPublishTasks = publishTasks.filter((publishTask) =>
    articleIds.includes(publishTask.articleId) &&
    !hasTestPattern(publishTask.title, publishTask.outputMarkdown, publishTask.outputHtml)
  );
  const workflowByArticleId = await getArticleWorkflowStatusMap(articleIds);

  const tasks: ContentTask[] = [];

  for (const source of realSources) {
    const needsFetch = !source.lastChecked || source.lastChecked < today;
    const failed = ['failed', 'error'].includes(source.status);
    if ((source.type === 'rss' || source.type === 'url') && (needsFetch || failed)) {
      tasks.push(task({
        type: 'FETCH_SOURCE',
        title: failed ? `内容源抓取失败：${source.title || source.name || source.id}` : `今日未抓取：${source.title || source.name || source.id}`,
        description: '内容源需要抓取，才能进入候选内容池。',
        priority: failed ? 'high' : 'medium',
        status: 'pending',
        relatedEntityType: 'source',
        relatedEntityId: source.id,
        actionLabel: '去抓取',
        actionHref: 'sources',
        reason: failed ? '最近抓取失败，需要重新处理。' : '今天还没有抓取记录。',
      }));
    }
  }

  for (const item of realSourceItems) {
    if (!item.rawText || item.status === 'topic_generated' || topicBySourceItemId.has(item.id)) continue;
    const score = item.qualityScore ?? 0;
    if (score >= 60) {
      tasks.push(task({
        type: 'CREATE_TOPIC',
        title: `可生成选题：${item.title}`,
        description: '候选内容质量达标，可以转为今日选题。',
        priority: 'high',
        status: 'pending',
        relatedEntityType: 'sourceItem',
        relatedEntityId: item.id,
        actionLabel: '生成选题',
        actionHref: 'sources',
        reason: `质量分 ${score}，尚未关联 Topic。`,
      }));
    } else if (score >= 40) {
      tasks.push(task({
        type: 'REVIEW_SOURCE_ITEM',
        title: `候选内容待筛选：${item.title}`,
        description: '内容可读但质量分一般，建议人工判断是否生成选题。',
        priority: 'medium',
        status: 'pending',
        relatedEntityType: 'sourceItem',
        relatedEntityId: item.id,
        actionLabel: '查看候选',
        actionHref: 'sources',
        reason: `质量分 ${score}，需要人工筛选。`,
      }));
    }
  }

  for (const topic of realTopics) {
    if (!topic.sourceItemId || !sourceItemIds.has(topic.sourceItemId)) continue;
    const article = articleByTopicId.get(topic.id);
    if (!article) {
      tasks.push(task({
        type: 'GENERATE_ARTICLE',
        title: `待生成文章：${topic.title}`,
        description: '选题已经确认，还没有生成文章。',
        priority: 'medium',
        status: 'pending',
        relatedEntityType: 'topic',
        relatedEntityId: topic.id,
        actionLabel: '生成文章',
        actionHref: 'topics',
        actionPayload: { tab: 'topics', topicId: topic.id },
        reason: 'Topic 已存在，但没有关联 Article。',
      }));
    }
  }

  for (const article of realArticles) {
    const workflow = workflowByArticleId.get(article.id);
    if (!workflow) continue;

    if (workflow.stage === 'waiting_manual_publish' && workflow.publish.latestPublishTaskId) {
      tasks.push(task({
        type: 'READY_TO_MANUAL_PUBLISH',
        title: `等待手动发布：${article.title}`,
        description: '发布包已生成，dry-run 已记录。',
        priority: 'low',
        status: 'done',
        relatedEntityType: 'publishTask',
        relatedEntityId: workflow.publish.latestPublishTaskId,
        actionLabel: '查看发布包',
        actionHref: 'publish',
        reason: '等待你手动复制 Markdown/HTML 到微信公众号后台。',
      }));
      continue;
    }

    if (workflow.stage === 'needs_quality_check') {
      tasks.push(task({
        type: 'QUALITY_CHECK',
        title: `待质量检查：${article.title}`,
        description: '文章已生成，但还没有质量检查记录。',
        priority: 'medium',
        status: 'pending',
        relatedEntityType: 'article',
        relatedEntityId: article.id,
        actionLabel: '去检查',
        actionHref: 'workshop',
        reason: '未找到 ReviewLog.check 结果。',
      }));
      continue;
    }

    if (workflow.stage === 'quality_failed') {
      tasks.push(task({
        type: 'EDIT_ARTICLE',
        title: `需修改：${article.title}`,
        description: workflow.quality.riskCount > 0 ? `质量检查发现 ${workflow.quality.riskCount} 个风险项。` : '文章未通过质量检查。',
        priority: 'high',
        status: 'pending',
        relatedEntityType: 'article',
        relatedEntityId: article.id,
        actionLabel: '去修改',
        actionHref: 'workshop',
        reason: '质量检查未通过，不应直接生成发布包。',
      }));
      continue;
    }

    if (workflow.stage === 'quality_passed' || workflow.stage === 'package_ready') {
      tasks.push(task({
        type: 'CREATE_PACKAGE',
        title: `可生成发布包：${article.title}`,
        description: '文章已通过质检，可以生成 dry-run 发布包。',
        priority: 'high',
        status: 'pending',
        relatedEntityType: 'article',
        relatedEntityId: article.id,
        actionLabel: '生成发布包',
        actionHref: 'workshop',
        reason: '已通过质量检查，但还没有 dry-run PublishTask。',
      }));
    }
  }

  const sortedTasks = tasks.sort((a, b) =>
    statusWeight[b.status] - statusWeight[a.status] ||
    priorityWeight[b.priority] - priorityWeight[a.priority] ||
    a.title.localeCompare(b.title, 'zh-CN')
  );

  const passedQualityArticles = realArticles.filter((article) => {
    const workflow = workflowByArticleId.get(article.id);
    return workflow?.quality.passed === true;
  }).length;

  const stats: TodayTaskStats = {
    fetchedItemsToday: realSourceItems.filter((item) => item.createdAt >= today).length,
    usableSourceItems: realSourceItems.filter((item) => (item.qualityScore ?? 0) >= 60 && !topicBySourceItemId.has(item.id)).length,
    topicsToday: realTopics.filter((topic) => topic.createdAt >= today).length,
    articlesToday: realArticles.filter((article) => article.createdAt >= today).length,
    passedQualityArticles,
    publishPackagesToday: realPublishTasks.filter((publishTask) => publishTask.status === 'success' && publishTask.createdAt >= today).length,
  };

  return {
    stats,
    primaryTask: sortedTasks.find((item) => item.status === 'pending') ?? null,
    tasks: sortedTasks,
  };
}
