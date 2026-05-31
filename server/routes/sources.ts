import { Router } from 'express';
import { prisma } from '../db/prisma';
import { createContentHash } from '../services/contentHash';
import { fetchRssItems } from '../services/fetch/rssFetcher';
import { fetchUrlContent } from '../services/fetch/urlFetcher';
import { checkContentQuality } from '../services/fetch/contentQuality';
import { writeLog } from '../services/logger';
import { ApiError, asyncRoute, ok } from '../types/api';

export const sourcesRouter = Router();

async function ensureManualSourceItem(source: {
  id: string;
  title: string | null;
  name: string | null;
  url: string | null;
  rawText: string;
}) {
  const rawText = source.rawText?.trim() || '';
  if (!rawText) return { created: false };
  const title = source.title || source.name || '手动内容源';
  const contentHash = createContentHash(`${source.id}:manual:${rawText}`);
  const existing = await prisma.sourceItem.findUnique({ where: { contentHash } });
  if (existing) return { created: false };

  const quality = checkContentQuality({
    title,
    rawText,
    url: source.url || undefined,
  });
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
  return { created: true };
}

sourcesRouter.get('/', asyncRoute(async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const sources = await prisma.source.findMany({
    where: includeArchived ? undefined : { status: { not: 'archived' } },
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: { createdAt: 'desc' }, take: 5 } },
  });
  return ok(res, sources);
}));

sourcesRouter.get('/:id', asyncRoute(async (req, res) => {
  const source = await prisma.source.findUnique({ where: { id: req.params.id } });
  if (!source) throw new ApiError('SOURCE_NOT_FOUND', '内容源不存在。', 404);
  return ok(res, source);
}));

async function fetchSource(sourceId: string) {
  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) throw new ApiError('SOURCE_NOT_FOUND', '内容源不存在。', 404);
  if (source.status === 'archived') throw new ApiError('VALIDATION_ERROR', '已删除内容源不会继续抓取。');
  if (!source.url && source.type !== 'manual') throw new ApiError('VALIDATION_ERROR', 'RSS/URL 内容源必须配置链接。');

  if (source.type === 'manual') {
    const ensured = await ensureManualSourceItem(source);
    const updated = await prisma.source.update({
      where: { id: source.id },
      data: {
        lastChecked: new Date(),
        status: 'extracted',
        articleCount: ensured.created ? { increment: 1 } : undefined,
      },
      include: { items: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    await writeLog({
      module: '内容源',
      action: ensured.created
        ? `手动内容源已入库为抓取结果：${updated.title || updated.name || updated.id}`
        : `手动内容源检查完成：${updated.title || updated.name || updated.id}`,
      type: ensured.created ? 'success' : 'info',
    });
    return { source: updated, createdCount: ensured.created ? 1 : 0 };
  }

  if (source.type === 'rss') {
    const items = await fetchRssItems(source.url || '');
    let createdCount = 0;
    for (const item of items) {
      const contentHash = createContentHash(`${source.id}:${item.url || item.title}:${item.rawText}`);
      const existing = await prisma.sourceItem.findUnique({ where: { contentHash } });
      if (existing) continue;
      const quality = checkContentQuality({
        title: item.title,
        rawText: item.rawText,
        url: item.url,
      });
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
    const updated = await prisma.source.update({
      where: { id: source.id },
      data: { lastChecked: new Date(), status: 'extracted', articleCount: { increment: createdCount } },
      include: { items: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    await writeLog({ module: '内容源', action: `RSS 抓取完成：${source.title || source.name || source.id}，新增 ${createdCount} 条`, type: 'success' });
    return { source: updated, createdCount };
  }

  if (source.type === 'url') {
    const fetched = await fetchUrlContent(source.url || '');
    const contentHash = createContentHash(`${source.id}:${source.url}:${fetched.rawText}`);
    const existing = await prisma.sourceItem.findUnique({ where: { contentHash } });
    let createdCount = 0;
    if (!existing) {
      const quality = checkContentQuality({
        title: fetched.title,
        rawText: fetched.rawText,
        url: source.url || undefined,
      });
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
    const updated = await prisma.source.update({
      where: { id: source.id },
      data: {
        title: source.title || fetched.title,
        rawText: fetched.rawText,
        lastChecked: new Date(),
        status: 'extracted',
        articleCount: { increment: createdCount },
      },
      include: { items: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    await writeLog({ module: '内容源', action: `URL 抓取完成：${updated.title || updated.name || updated.id}`, type: 'success' });
    return { source: updated, createdCount };
  }

  throw new ApiError('VALIDATION_ERROR', '不支持的内容源类型。');
}

sourcesRouter.post('/', asyncRoute(async (req, res) => {
  const { type, name, title, url, rawText, language, sourceAuthor, publishedAt, region } = req.body ?? {};
  if (!['manual', 'url', 'rss'].includes(type)) {
    throw new ApiError('VALIDATION_ERROR', 'type 必须是 manual、url 或 rss。');
  }
  if (type === 'manual' && (!rawText || typeof rawText !== 'string' || rawText.trim().length < 10)) {
    throw new ApiError('VALIDATION_ERROR', '请填写至少 10 个字符的原始内容。');
  }
  if ((type === 'url' || type === 'rss') && (!url || typeof url !== 'string' || !/^https?:\/\//.test(url))) {
    throw new ApiError('VALIDATION_ERROR', 'URL/RSS 内容源必须填写 http(s) 链接。');
  }

  const sourceRawText = type === 'manual' ? rawText : (rawText || `${title || name || url}\n${url}`);
  const contentHash = createContentHash(`${type}:${url ?? ''}:${sourceRawText}`);
  const existing = await prisma.source.findUnique({ where: { contentHash } });
  if (existing) {
    if (existing.type === 'manual') {
      const ensured = await ensureManualSourceItem(existing);
      if (ensured.created || existing.status !== 'extracted') {
        const updated = await prisma.source.update({
          where: { id: existing.id },
          data: {
            status: 'extracted',
            lastChecked: new Date(),
            articleCount: ensured.created ? { increment: 1 } : undefined,
          },
        });
        return ok(res, updated);
      }
    }
    return ok(res, existing);
  }

  let source = await prisma.source.create({
    data: {
      type,
      name,
      title,
      url,
      rawText: sourceRawText,
      language,
      sourceAuthor,
      publishedAt: publishedAt ? new Date(publishedAt) : undefined,
      region: region === 'domestic' ? 'domestic' : 'global',
      status: type === 'manual' ? 'extracted' : 'pending',
      contentHash,
    },
  });
  if (type === 'manual') {
    const ensured = await ensureManualSourceItem(source);
    if (ensured.created) {
      source = await prisma.source.update({
        where: { id: source.id },
        data: { articleCount: { increment: 1 }, lastChecked: new Date() },
      });
    }
  }
  await writeLog({ module: '内容源', action: `新增内容源：${title || name || source.id}`, type: 'success' });
  return ok(res, source);
}));

sourcesRouter.patch('/:id', asyncRoute(async (req, res) => {
  const source = await prisma.source.findUnique({ where: { id: req.params.id } });
  if (!source) throw new ApiError('SOURCE_NOT_FOUND', '内容源不存在。', 404);
  const updated = await prisma.source.update({
    where: { id: req.params.id },
    data: {
      name: req.body.name,
      title: req.body.title,
      url: req.body.url,
      rawText: req.body.rawText,
      language: req.body.language,
      sourceAuthor: req.body.sourceAuthor,
      status: req.body.status,
      region: req.body.region,
    },
  });
  await writeLog({ module: '内容源', action: `更新内容源：${updated.title || updated.name || updated.id}`, type: 'info' });
  return ok(res, updated);
}));

sourcesRouter.delete('/:id', asyncRoute(async (req, res) => {
  const source = await prisma.source.findUnique({ where: { id: req.params.id } });
  if (!source) throw new ApiError('SOURCE_NOT_FOUND', '内容源不存在。', 404);
  const updated = await prisma.source.update({
    where: { id: req.params.id },
    data: { status: 'archived' },
  });
  await writeLog({ module: '内容源', action: `归档内容源：${updated.title || updated.name || updated.id}`, type: 'warning' });
  return ok(res, updated);
}));

sourcesRouter.delete('/:id/permanent', asyncRoute(async (req, res) => {
  const source = await prisma.source.findUnique({ where: { id: req.params.id } });
  if (!source) throw new ApiError('SOURCE_NOT_FOUND', '内容源不存在。', 404);
  if (source.status !== 'archived') {
    throw new ApiError('VALIDATION_ERROR', '请先删除/归档该内容源，再执行永久删除。');
  }

  const sourceId = source.id;
  const sourceLabel = source.title || source.name || source.id;

  // Find related source items
  const sourceItems = await prisma.sourceItem.findMany({
    where: { sourceId },
    select: { id: true },
  });
  const sourceItemIds = sourceItems.map((item) => item.id);

  // Find related topics
  const topics = await prisma.topic.findMany({
    where: sourceItemIds.length > 0
      ? { OR: [{ sourceId }, { sourceItemId: { in: sourceItemIds } }] }
      : { sourceId },
    select: { id: true },
  });
  const topicIds = topics.map((t) => t.id);

  // Find related articles
  const articles = await prisma.article.findMany({
    where: { topicId: { in: topicIds } },
    select: { id: true },
  });
  const articleIds = articles.map((a) => a.id);

  // Delete in correct order (children first)
  let deletedPublishTasks = 0;
  let deletedImageSlots = 0;
  let deletedVersions = 0;
  let deletedReviews = 0;
  let deletedArticles = 0;
  let deletedTopics = 0;
  let deletedSourceItems = 0;
  let deletedFetchTasks = 0;

  await prisma.$transaction(async (tx) => {
    if (articleIds.length > 0) {
      deletedPublishTasks = (await tx.publishTask.deleteMany({ where: { articleId: { in: articleIds } } })).count;
      deletedImageSlots = (await tx.articleImageSlot.deleteMany({ where: { articleId: { in: articleIds } } })).count;
      deletedReviews = (await tx.reviewLog.deleteMany({ where: { articleId: { in: articleIds } } })).count;
      deletedVersions = (await tx.articleVersion.deleteMany({ where: { articleId: { in: articleIds } } })).count;
      deletedArticles = (await tx.article.deleteMany({ where: { id: { in: articleIds } } })).count;
    }

    if (topicIds.length > 0) {
      deletedTopics = (await tx.topic.deleteMany({ where: { id: { in: topicIds } } })).count;
    }

    if (sourceItemIds.length > 0) {
      deletedSourceItems = (await tx.sourceItem.deleteMany({ where: { id: { in: sourceItemIds } } })).count;
    }

    deletedFetchTasks = (await tx.fetchTask.deleteMany({ where: { sourceId } })).count;
    await tx.source.delete({ where: { id: sourceId } });
  });

  await writeLog({
    module: '内容源',
    action: `永久删除内容源：${sourceLabel}，关联删除 ${deletedArticles} 篇文章、${deletedTopics} 个选题、${deletedSourceItems} 条源条目`,
    type: 'warning',
  });

  return ok(res, {
    deleted: {
      source: 1,
      sourceItems: deletedSourceItems,
      topics: deletedTopics,
      articles: deletedArticles,
      articleVersions: deletedVersions,
      articleImageSlots: deletedImageSlots,
      publishTasks: deletedPublishTasks,
      reviewLogs: deletedReviews,
      fetchTasks: deletedFetchTasks,
    },
  });
}));

sourcesRouter.post('/fetch-all', asyncRoute(async (_req, res) => {
  const sources = await prisma.source.findMany({ where: { status: { not: 'archived' }, type: { in: ['url', 'rss'] } } });
  const results = [];
  for (const source of sources) {
    try {
      results.push(await fetchSource(source.id));
    } catch (error) {
      await writeLog({ module: '内容源', action: `抓取失败：${source.title || source.name || source.id}`, type: 'error' });
      results.push({ source, createdCount: 0, error: error instanceof Error ? error.message : '抓取失败' });
    }
  }
  return ok(res, results);
}));

sourcesRouter.post('/:id/fetch', asyncRoute(async (req, res) => {
  try {
    const result = await fetchSource(req.params.id);
    return ok(res, result);
  } catch (error) {
    await writeLog({ module: '内容源', action: `抓取失败：${req.params.id}`, type: 'error' });
    throw error;
  }
}));

sourcesRouter.post('/:id/check', asyncRoute(async (req, res) => {
  const result = await fetchSource(req.params.id);
  return ok(res, result.source);
}));
