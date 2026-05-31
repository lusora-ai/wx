import { prisma } from '../db/prisma';
import { createContentHash } from './contentHash';
import { fetchRssItems } from './fetch/rssFetcher';
import { fetchUrlContent } from './fetch/urlFetcher';
import { checkContentQuality } from './fetch/contentQuality';
import { runEditorAgent } from './ai/editor';
import { generateArticlePipeline } from './articleGenerationPipeline';
import { checkArticleQuality, type QualityResult } from './articleQuality';
import { createDryRunPublishPackageFromArticle } from './publishPackage';
import { injectWechatDraftPocStable, type WechatInjectResult } from './wechat/wechatPublisher';
import { writeLog } from './logger';
import { ApiError, audiences, jsonField, type Audience } from '../types/api';

export type AutomationPipelineInput = {
  sourceId?: string;
  sourceItemId?: string;
  topicId?: string;
  articleId?: string;
  audience?: Audience;
  tone?: string;
  targetLength?: number;
  fillWechat?: boolean;
  forceNewArticle?: boolean;
};

export type AutomationPipelineStepStatus = 'done' | 'skipped' | 'blocked';

export type AutomationPipelineStep = {
  key: 'collect' | 'select_source_item' | 'topic' | 'article' | 'quality' | 'package' | 'wechat_fill';
  label: string;
  status: AutomationPipelineStepStatus;
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
  quality: QualityResult | null;
  wechat: WechatInjectResult | null;
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

type SourceForFetch = NonNullable<Awaited<ReturnType<typeof prisma.source.findUnique>>>;
type SourceItemWithSource = NonNullable<Awaited<ReturnType<typeof loadSourceItem>>>;

const DEFAULT_AUDIENCE: Audience = 'officeWorker';
const AUTO_MIN_SOURCE_SCORE = 60;
const EXPLICIT_MIN_SOURCE_SCORE = 40;

function resolveAudience(value: unknown): Audience {
  return audiences.includes(value as Audience) ? value as Audience : DEFAULT_AUDIENCE;
}

function step(input: AutomationPipelineStep): AutomationPipelineStep {
  return input;
}

function boundary(): AutomationPipelineResult['boundary'] {
  return {
    manualTriggerOnly: true,
    wechatSaveAttempted: false,
    scheduledPublish: false,
    batchPublish: false,
    officialWechatApi: false,
    imageGenerationApi: false,
  };
}

function blockedResult(input: {
  message: string;
  steps: AutomationPipelineStep[];
  sourceItemId?: string | null;
  topicId?: string | null;
  articleId?: string | null;
  publishTaskId?: string | null;
  quality?: QualityResult | null;
  wechat?: WechatInjectResult | null;
}): AutomationPipelineResult {
  return {
    status: 'blocked',
    message: input.message,
    sourceItemId: input.sourceItemId ?? null,
    topicId: input.topicId ?? null,
    articleId: input.articleId ?? null,
    publishTaskId: input.publishTaskId ?? null,
    wechatRunId: input.wechat?.runId ?? null,
    quality: input.quality ?? null,
    wechat: input.wechat ?? null,
    steps: input.steps,
    boundary: boundary(),
  };
}

async function ensureManualSourceItem(source: SourceForFetch) {
  const rawText = source.rawText?.trim() || '';
  if (!rawText) return 0;
  const title = source.title || source.name || '手动内容源';
  const contentHash = createContentHash(`${source.id}:manual:${rawText}`);
  const existing = await prisma.sourceItem.findUnique({ where: { contentHash } });
  if (existing) return 0;

  const quality = checkContentQuality({ title, rawText, url: source.url || undefined });
  await prisma.sourceItem.create({
    data: {
      sourceId: source.id,
      title,
      url: source.url,
      rawText,
      summary: rawText.slice(0, 180),
      contentHash,
      qualityScore: quality.score,
      qualityIssues: JSON.stringify(quality.issues),
    },
  });
  return 1;
}

async function fetchSourceIntoItems(source: SourceForFetch) {
  if (source.status === 'archived') throw new ApiError('VALIDATION_ERROR', '已删除内容源不会继续抓取。');
  if (!['manual', 'url', 'rss'].includes(source.type)) throw new ApiError('VALIDATION_ERROR', '不支持的内容源类型。');
  if (!source.url && source.type !== 'manual') throw new ApiError('VALIDATION_ERROR', 'RSS/URL 内容源必须配置链接。');

  let createdCount = 0;
  if (source.type === 'manual') {
    createdCount = await ensureManualSourceItem(source);
  }

  if (source.type === 'rss') {
    const items = await fetchRssItems(source.url || '');
    for (const item of items) {
      const contentHash = createContentHash(`${source.id}:${item.url || item.title}:${item.rawText}`);
      const existing = await prisma.sourceItem.findUnique({ where: { contentHash } });
      if (existing) continue;
      const quality = checkContentQuality({ title: item.title, rawText: item.rawText, url: item.url });
      await prisma.sourceItem.create({
        data: {
          sourceId: source.id,
          title: item.title,
          url: item.url,
          rawText: item.rawText,
          summary: item.summary,
          publishedAt: item.publishedAt,
          contentHash,
          qualityScore: quality.score,
          qualityIssues: JSON.stringify(quality.issues),
        },
      });
      createdCount += 1;
    }
  }

  if (source.type === 'url') {
    const fetched = await fetchUrlContent(source.url || '');
    const contentHash = createContentHash(`${source.id}:${source.url}:${fetched.rawText}`);
    const existing = await prisma.sourceItem.findUnique({ where: { contentHash } });
    if (!existing) {
      const quality = checkContentQuality({ title: fetched.title, rawText: fetched.rawText, url: source.url || undefined });
      await prisma.sourceItem.create({
        data: {
          sourceId: source.id,
          title: fetched.title,
          url: source.url,
          rawText: fetched.rawText,
          summary: fetched.description,
          contentHash,
          qualityScore: quality.score,
          qualityIssues: JSON.stringify(quality.issues),
        },
      });
      createdCount = 1;
    }
  }

  await prisma.source.update({
    where: { id: source.id },
    data: {
      lastChecked: new Date(),
      status: 'extracted',
      articleCount: createdCount > 0 ? { increment: createdCount } : undefined,
    },
  });
  return createdCount;
}

async function loadSourceItem(id: string) {
  return prisma.sourceItem.findUnique({ where: { id }, include: { source: true } });
}

async function collectSources(input: AutomationPipelineInput, steps: AutomationPipelineStep[]) {
  if (input.sourceItemId || input.topicId || input.articleId) {
    steps.push(step({
      key: 'collect',
      label: '收集信息',
      status: 'skipped',
      message: '已指定下游对象，跳过内容源抓取。',
    }));
    return;
  }

  const sources = input.sourceId
    ? await prisma.source.findMany({ where: { id: input.sourceId, status: { not: 'archived' } } })
    : await prisma.source.findMany({ where: { status: { not: 'archived' }, type: { in: ['manual', 'url', 'rss'] } }, orderBy: { updatedAt: 'desc' } });
  if (sources.length === 0) {
    steps.push(step({
      key: 'collect',
      label: '收集信息',
      status: 'blocked',
      message: input.sourceId ? '指定内容源不存在或已归档。' : '没有可抓取的内容源。',
    }));
    return;
  }

  let created = 0;
  let failed = 0;
  const failures: string[] = [];
  for (const source of sources) {
    try {
      created += await fetchSourceIntoItems(source);
    } catch (error) {
      failed += 1;
      failures.push(`${source.title || source.name || source.id}: ${error instanceof Error ? error.message : '抓取失败'}`);
    }
  }

  steps.push(step({
    key: 'collect',
    label: '收集信息',
    status: failed === sources.length ? 'blocked' : 'done',
    message: `处理 ${sources.length} 个内容源，新增 ${created} 条候选内容，失败 ${failed} 个源。`,
    details: failures.length > 0 ? { failures } : undefined,
  }));
}

async function selectSourceItem(input: AutomationPipelineInput, steps: AutomationPipelineStep[]) {
  if (input.articleId || input.topicId) {
    steps.push(step({
      key: 'select_source_item',
      label: '选择候选内容',
      status: 'skipped',
      message: '已指定文章或选题，跳过候选内容选择。',
    }));
    return null;
  }

  if (input.sourceItemId) {
    const item = await loadSourceItem(input.sourceItemId);
    if (!item || item.status === 'archived') {
      steps.push(step({
        key: 'select_source_item',
        label: '选择候选内容',
        status: 'blocked',
        message: '指定候选内容不存在或已归档。',
      }));
      return null;
    }
    const score = item.qualityScore ?? 0;
    if (score < EXPLICIT_MIN_SOURCE_SCORE) {
      steps.push(step({
        key: 'select_source_item',
        label: '选择候选内容',
        status: 'blocked',
        message: `候选内容质量分 ${score}，低于 ${EXPLICIT_MIN_SOURCE_SCORE}，需要人工筛选。`,
        entityType: 'sourceItem',
        entityId: item.id,
      }));
      return null;
    }
    steps.push(step({
      key: 'select_source_item',
      label: '选择候选内容',
      status: 'done',
      message: `使用指定候选内容：${item.title}`,
      entityType: 'sourceItem',
      entityId: item.id,
      details: { qualityScore: item.qualityScore },
    }));
    return item;
  }

  const items = await prisma.sourceItem.findMany({
    where: {
      status: { not: 'archived' },
      sourceId: input.sourceId || undefined,
    },
    include: { source: true },
    orderBy: [{ createdAt: 'desc' }],
    take: 100,
  });
  const ids = items.map((item) => item.id);
  const topics = ids.length > 0
    ? await prisma.topic.findMany({ where: { sourceItemId: { in: ids }, status: { not: 'archived' } }, select: { sourceItemId: true } })
    : [];
  const usedSourceItemIds = new Set(topics.map((topic) => topic.sourceItemId).filter(Boolean));
  const candidates = items
    .filter((item) => !usedSourceItemIds.has(item.id))
    .filter((item) => (item.qualityScore ?? 0) >= AUTO_MIN_SOURCE_SCORE)
    .sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0) || b.createdAt.getTime() - a.createdAt.getTime());
  const selected = candidates[0] ?? null;
  if (!selected) {
    steps.push(step({
      key: 'select_source_item',
      label: '选择候选内容',
      status: 'skipped',
      message: `没有质量分达到 ${AUTO_MIN_SOURCE_SCORE} 且未生成选题的候选内容。`,
    }));
    return null;
  }
  steps.push(step({
    key: 'select_source_item',
    label: '选择候选内容',
    status: 'done',
    message: `选择候选内容：${selected.title}`,
    entityType: 'sourceItem',
    entityId: selected.id,
    details: { qualityScore: selected.qualityScore },
  }));
  return selected;
}

async function selectReusableTopic(audience: Audience, sourceId?: string) {
  const topics = await prisma.topic.findMany({
    where: { status: { not: 'archived' }, sourceId: sourceId || undefined },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  for (const topic of topics) {
    const article = await prisma.article.findFirst({ where: { topicId: topic.id, audience, status: { not: 'failed' } } });
    if (!article) return topic;
  }
  return null;
}

async function resolveTopic(input: AutomationPipelineInput, selectedItem: SourceItemWithSource | null, audience: Audience, steps: AutomationPipelineStep[]) {
  if (input.articleId) {
    steps.push(step({
      key: 'topic',
      label: '生成选题',
      status: 'skipped',
      message: '已指定文章，跳过选题生成。',
    }));
    return null;
  }

  if (input.topicId) {
    const topic = await prisma.topic.findUnique({ where: { id: input.topicId } });
    if (!topic || topic.status === 'archived') {
      steps.push(step({ key: 'topic', label: '生成选题', status: 'blocked', message: '指定选题不存在或已归档。' }));
      return null;
    }
    steps.push(step({
      key: 'topic',
      label: '生成选题',
      status: 'done',
      message: `使用指定选题：${topic.title}`,
      entityType: 'topic',
      entityId: topic.id,
    }));
    return topic;
  }

  if (!selectedItem) {
    const topic = await selectReusableTopic(audience, input.sourceId);
    if (!topic) {
      steps.push(step({
        key: 'topic',
        label: '生成选题',
        status: 'blocked',
        message: '没有可复用的待写选题。',
      }));
      return null;
    }
    steps.push(step({
      key: 'topic',
      label: '生成选题',
      status: 'done',
      message: `复用待写选题：${topic.title}`,
      entityType: 'topic',
      entityId: topic.id,
    }));
    return topic;
  }

  const existingTopic = await prisma.topic.findFirst({ where: { sourceItemId: selectedItem.id, status: { not: 'archived' } } });
  if (existingTopic) {
    steps.push(step({
      key: 'topic',
      label: '生成选题',
      status: 'done',
      message: `复用已生成选题：${existingTopic.title}`,
      entityType: 'topic',
      entityId: existingTopic.id,
    }));
    return existingTopic;
  }

  const { data, tokenUsage } = await runEditorAgent({
    rawText: selectedItem.rawText,
    title: selectedItem.title,
    url: selectedItem.url || undefined,
  });
  const suggestion = data.topicSuggestions?.[0];
  if (!suggestion) throw new ApiError('AI_OUTPUT_INVALID', 'AI 未返回可用选题。', 502);
  const topic = await prisma.topic.create({
    data: {
      sourceId: selectedItem.sourceId,
      sourceItemId: selectedItem.id,
      originalTitle: selectedItem.title,
      originalUrl: selectedItem.url,
      translatedTitle: data.coreEvent,
      title: suggestion.title,
      angle: suggestion.angle,
      summary: suggestion.reason || data.coreEvent,
      rawContent: selectedItem.rawText,
      facts: jsonField(data.facts ?? []),
      uncertainClaims: jsonField(data.uncertainClaims ?? []),
      suggestedTitles: jsonField(data.topicSuggestions.map((entry) => entry.title)),
      targetAudiences: jsonField(suggestion.audiences ?? ['officeWorker', 'student', 'freelancer']),
      category: selectedItem.source.region === 'domestic' ? '国内资讯' : '海外资讯',
      hotScore: 80,
      readingTime: '3 min',
      status: 'pushed',
    },
  });
  await prisma.sourceItem.update({ where: { id: selectedItem.id }, data: { status: 'topic_generated' } });
  await writeLog({ module: '自动化流水线', action: `自动生成选题：${topic.title}`, type: 'success', tokensUsed: tokenUsage });
  steps.push(step({
    key: 'topic',
    label: '生成选题',
    status: 'done',
    message: `已生成选题：${topic.title}`,
    entityType: 'topic',
    entityId: topic.id,
    details: { tokenUsage },
  }));
  return topic;
}

async function resolveArticle(input: AutomationPipelineInput, topicId: string | null, audience: Audience, steps: AutomationPipelineStep[]) {
  if (input.articleId) {
    const article = await prisma.article.findUnique({ where: { id: input.articleId } });
    if (!article) {
      steps.push(step({ key: 'article', label: '生成文章', status: 'blocked', message: '指定文章不存在。' }));
      return null;
    }
    steps.push(step({
      key: 'article',
      label: '生成文章',
      status: 'done',
      message: `使用指定文章：${article.title}`,
      entityType: 'article',
      entityId: article.id,
    }));
    return article;
  }

  if (!topicId) {
    steps.push(step({ key: 'article', label: '生成文章', status: 'blocked', message: '没有可用选题，无法生成文章。' }));
    return null;
  }

  if (!input.forceNewArticle) {
    const existing = await prisma.article.findFirst({
      where: { topicId, audience, status: { not: 'failed' } },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) {
      steps.push(step({
        key: 'article',
        label: '生成文章',
        status: 'done',
        message: `复用已有文章：${existing.title}`,
        entityType: 'article',
        entityId: existing.id,
      }));
      return existing;
    }
  }

  const generated = await generateArticlePipeline({
    topicId,
    audience,
    tone: input.tone,
    targetLength: input.targetLength,
  });
  if (!generated?.article) throw new ApiError('ARTICLE_NOT_FOUND', '文章生成失败，未得到可用文章。', 502);
  steps.push(step({
    key: 'article',
    label: '生成文章',
    status: 'done',
    message: `已生成文章：${generated.article.title}`,
    entityType: 'article',
    entityId: generated.article.id,
    details: {
      visualPlanStatus: generated.visualPlanStatus,
      visualPlanWarnings: generated.visualPlanWarnings,
      elapsedMs: generated.elapsedMs,
    },
  }));
  return generated.article;
}

async function runQualityCheck(articleId: string, steps: AutomationPipelineStep[]) {
  const article = await prisma.article.findUnique({ where: { id: articleId }, include: { imageSlots: true } });
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  const totalParagraphs = article.markdown.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const quality = checkArticleQuality({
    title: article.title,
    markdown: article.markdown,
    cta: article.cta,
    imageSlots: article.imageSlots.map((slot) => ({ slotKey: slot.slotKey, paragraphIndex: slot.paragraphIndex })),
    totalParagraphs,
  });
  await prisma.reviewLog.create({ data: { articleId, action: 'check', result: jsonField(quality) } });
  await prisma.article.update({ where: { id: articleId }, data: { qualityScore: quality.score } });
  steps.push(step({
    key: 'quality',
    label: '质量检查',
    status: quality.passed ? 'done' : 'blocked',
    message: quality.passed
      ? `质量检查通过，分数 ${quality.score}。`
      : `质量检查未通过，发现 ${quality.issues.filter((issue) => issue.severity === 'high').length} 个 HIGH 风险。`,
    entityType: 'article',
    entityId: articleId,
    details: { score: quality.score, issues: quality.issues },
  }));
  return quality;
}

export async function runAutomationPipeline(input: AutomationPipelineInput): Promise<AutomationPipelineResult> {
  const steps: AutomationPipelineStep[] = [];
  const audience = resolveAudience(input.audience);

  await collectSources(input, steps);

  const selectedItem = await selectSourceItem(input, steps);
  if (input.sourceItemId && !selectedItem) {
    const result = blockedResult({ message: '指定候选内容不可用于自动流水线。', steps });
    await writeLog({ module: '自动化流水线', action: result.message, type: 'warning' });
    return result;
  }
  if (!selectedItem && !input.topicId && !input.articleId) {
    const topic = await selectReusableTopic(audience, input.sourceId);
    if (!topic) {
      const result = blockedResult({ message: '没有可自动处理的候选内容或待写选题。', steps, sourceItemId: null });
      await writeLog({ module: '自动化流水线', action: result.message, type: 'warning' });
      return result;
    }
  }

  const topic = await resolveTopic(input, selectedItem, audience, steps);
  if (!topic && !input.articleId) {
    const result = blockedResult({ message: '选题阶段未得到可用结果，流水线已停止。', steps, sourceItemId: selectedItem?.id ?? null });
    await writeLog({ module: '自动化流水线', action: result.message, type: 'warning' });
    return result;
  }

  const article = await resolveArticle(input, topic?.id ?? null, audience, steps);
  if (!article) {
    const result = blockedResult({ message: '文章阶段未得到可用结果，流水线已停止。', steps, sourceItemId: selectedItem?.id ?? null, topicId: topic?.id ?? null });
    await writeLog({ module: '自动化流水线', action: result.message, type: 'warning' });
    return result;
  }

  const quality = await runQualityCheck(article.id, steps);
  if (!quality.passed) {
    const result = blockedResult({
      message: '文章存在 HIGH 风险，已按 PRD 阻止发布包和微信填入。',
      steps,
      sourceItemId: selectedItem?.id ?? null,
      topicId: topic?.id ?? article.topicId ?? null,
      articleId: article.id,
      quality,
    });
    await writeLog({ module: '自动化流水线', action: result.message, type: 'warning' });
    return result;
  }

  const packageResult = await createDryRunPublishPackageFromArticle(article.id);
  steps.push(step({
    key: 'package',
    label: '生成发布包',
    status: 'done',
    message: packageResult.reused ? '复用当前版本发布包。' : '已生成 dry-run 发布包。',
    entityType: 'publishTask',
    entityId: packageResult.publishTaskId,
    details: {
      reused: Boolean(packageResult.reused),
      packageSummary: packageResult.packageSummary,
      statusText: packageResult.statusText,
    },
  }));

  let wechat: WechatInjectResult | null = null;
  if (input.fillWechat === true) {
    wechat = await injectWechatDraftPocStable(packageResult.publishTaskId);
    steps.push(step({
      key: 'wechat_fill',
      label: '填入微信公众号',
      status: wechat.success ? 'done' : 'blocked',
      message: wechat.message,
      entityType: wechat.runId ? 'wechatRun' : 'publishTask',
      entityId: wechat.runId || packageResult.publishTaskId,
      details: { errorCode: wechat.errorCode, evidence: wechat.evidence, warnings: wechat.warnings },
    }));
    if (!wechat.success) {
      const result = blockedResult({
        message: '发布包已生成，但微信填入 gate 未通过。',
        steps,
        sourceItemId: selectedItem?.id ?? null,
        topicId: topic?.id ?? article.topicId ?? null,
        articleId: article.id,
        publishTaskId: packageResult.publishTaskId,
        quality,
        wechat,
      });
      await writeLog({ module: '自动化流水线', action: `${result.message}${wechat.errorCode ? `：${wechat.errorCode}` : ''}`, type: 'warning' });
      return result;
    }
  } else {
    steps.push(step({
      key: 'wechat_fill',
      label: '填入微信公众号',
      status: 'skipped',
      message: '未请求微信填入；发布包已在发布中心待手动处理。',
      entityType: 'publishTask',
      entityId: packageResult.publishTaskId,
    }));
  }

  const status: AutomationPipelineResult['status'] = wechat?.success ? 'wechat_filled' : 'package_ready';
  const result: AutomationPipelineResult = {
    status,
    message: wechat?.success
      ? '已完成信息收集、文章生成、发布包生成，并填入微信公众号编辑器；尚未保存草稿。'
      : '已完成信息收集、文章生成和发布包生成，等待手动发布或微信填入。',
    sourceItemId: selectedItem?.id ?? null,
    topicId: topic?.id ?? article.topicId ?? null,
    articleId: article.id,
    publishTaskId: packageResult.publishTaskId,
    wechatRunId: wechat?.runId ?? null,
    quality,
    wechat,
    steps,
    boundary: boundary(),
  };
  await writeLog({ module: '自动化流水线', action: result.message, type: 'success' });
  return result;
}
