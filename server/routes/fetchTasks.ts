import { Router } from 'express';
import { prisma } from '../db/prisma';
import { createContentHash } from '../services/contentHash';
import { fetchRssItems } from '../services/fetch/rssFetcher';
import { fetchUrlContent } from '../services/fetch/urlFetcher';
import { checkContentQuality } from '../services/fetch/contentQuality';
import { writeLog } from '../services/logger';
import { ApiError, asyncRoute, ok } from '../types/api';

export const fetchTasksRouter = Router();

async function executeFetchSource(sourceId: string, taskId: string) {
  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) throw new ApiError('SOURCE_NOT_FOUND', '内容源不存在。', 404);
  if (source.status === 'archived') throw new ApiError('VALIDATION_ERROR', '已删除内容源不会继续抓取。');
  if (!source.url && source.type !== 'manual') throw new ApiError('VALIDATION_ERROR', 'RSS/URL 内容源必须配置链接。');

  await prisma.fetchTask.update({ where: { id: taskId }, data: { status: 'running', startedAt: new Date() } });

  let createdCount = 0;
  let failedCount = 0;

  if (source.type === 'rss') {
    const items = await fetchRssItems(source.url || '');
    await prisma.fetchTask.update({ where: { id: taskId }, data: { total: items.length } });
    for (const item of items) {
      try {
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
      } catch {
        failedCount += 1;
      }
    }
    await prisma.source.update({
      where: { id: source.id },
      data: { lastChecked: new Date(), status: 'extracted', articleCount: { increment: createdCount } },
    });
  } else if (source.type === 'url') {
    await prisma.fetchTask.update({ where: { id: taskId }, data: { total: 1 } });
    try {
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
      await prisma.source.update({
        where: { id: source.id },
        data: {
          title: source.title || fetched.title,
          rawText: fetched.rawText,
          lastChecked: new Date(),
          status: 'extracted',
          articleCount: { increment: createdCount },
        },
      });
    } catch {
      failedCount = 1;
    }
  }

  const finalStatus = failedCount > 0 && createdCount === 0 ? 'failed' : 'success';
  await prisma.fetchTask.update({
    where: { id: taskId },
    data: {
      status: finalStatus,
      success: createdCount,
      failed: failedCount,
      finishedAt: new Date(),
      message: `新增 ${createdCount} 条，失败 ${failedCount} 条。`,
    },
  });

  await writeLog({ module: '抓取任务', action: `抓取完成：${source.title || source.name || source.id}，新增 ${createdCount}，失败 ${failedCount}`, type: finalStatus === 'success' ? 'success' : 'warning' });
}

fetchTasksRouter.get('/', asyncRoute(async (req, res) => {
  const { sourceId } = req.query;
  const where: Record<string, unknown> = {};
  if (sourceId && typeof sourceId === 'string') where.sourceId = sourceId;
  const tasks = await prisma.fetchTask.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return ok(res, tasks);
}));

fetchTasksRouter.get('/:id', asyncRoute(async (req, res) => {
  const task = await prisma.fetchTask.findUnique({ where: { id: req.params.id } });
  if (!task) throw new ApiError('FETCH_TASK_NOT_FOUND', '抓取任务不存在。', 404);
  return ok(res, task);
}));

fetchTasksRouter.post('/source/:sourceId', asyncRoute(async (req, res) => {
  const source = await prisma.source.findUnique({ where: { id: req.params.sourceId } });
  if (!source) throw new ApiError('SOURCE_NOT_FOUND', '内容源不存在。', 404);

  const task = await prisma.fetchTask.create({
    data: {
      sourceId: source.id,
      type: 'single_source',
      status: 'pending',
      message: `准备抓取：${source.title || source.name || source.id}`,
    },
  });

  // Execute synchronously then return updated task
  try {
    await executeFetchSource(source.id, task.id);
  } catch (error) {
    await prisma.fetchTask.update({
      where: { id: task.id },
      data: {
        status: 'failed',
        finishedAt: new Date(),
        errorCode: error instanceof ApiError ? error.errorCode : 'UNKNOWN',
        errorMessage: error instanceof Error ? error.message : '抓取失败。',
      },
    });
  }

  const updated = await prisma.fetchTask.findUnique({ where: { id: task.id } });
  return ok(res, updated);
}));

fetchTasksRouter.post('/all', asyncRoute(async (_req, res) => {
  const sources = await prisma.source.findMany({
    where: { status: { not: 'archived' }, type: { in: ['url', 'rss'] } },
  });

  const task = await prisma.fetchTask.create({
    data: {
      type: 'all_active_sources',
      status: 'pending',
      total: sources.length,
      message: `准备抓取 ${sources.length} 个活跃源`,
    },
  });

  let totalSuccess = 0;
  let totalFailed = 0;
  await prisma.fetchTask.update({ where: { id: task.id }, data: { status: 'running', startedAt: new Date() } });

  for (const source of sources) {
    try {
      await executeFetchSource(source.id, task.id);
      totalSuccess += 1;
    } catch {
      totalFailed += 1;
    }
  }

  await prisma.fetchTask.update({
    where: { id: task.id },
    data: {
      status: totalFailed > 0 && totalSuccess === 0 ? 'failed' : 'success',
      success: totalSuccess,
      failed: totalFailed,
      finishedAt: new Date(),
      message: `处理 ${sources.length} 个源，成功 ${totalSuccess}，失败 ${totalFailed}。`,
    },
  });

  const updated = await prisma.fetchTask.findUnique({ where: { id: task.id } });
  return ok(res, updated);
}));
