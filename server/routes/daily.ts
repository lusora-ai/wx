import { Router } from 'express';
import { prisma } from '../db/prisma';
import { fetchRssItems } from '../services/fetch/rssFetcher';
import { fetchUrlContent } from '../services/fetch/urlFetcher';
import { checkContentQuality } from '../services/fetch/contentQuality';
import { createContentHash } from '../services/contentHash';
import { writeLog } from '../services/logger';
import { asyncRoute, ok } from '../types/api';

export const dailyRouter = Router();

dailyRouter.get('/summary', asyncRoute(async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    fetchedToday,
    pendingTopics,
    generatedArticles,
    approvedArticles,
    publishedTasks,
    activeSources,
  ] = await Promise.all([
    prisma.sourceItem.count({ where: { createdAt: { gte: today } } }),
    prisma.topic.count({ where: { status: 'pushed' } }),
    prisma.article.count({ where: { createdAt: { gte: today } } }),
    prisma.article.count({ where: { status: 'approved' } }),
    prisma.publishTask.count({ where: { status: 'success', createdAt: { gte: today } } }),
    prisma.source.count({ where: { status: { not: 'archived' } } }),
  ]);

  return ok(res, {
    fetchedToday,
    pendingTopics,
    generatedArticles,
    approvedArticles,
    publishedTasks,
    activeSources,
    date: today.toISOString(),
  });
}));

dailyRouter.post('/fetch-today', asyncRoute(async (_req, res) => {
  const sources = await prisma.source.findMany({
    where: { status: { not: 'archived' }, type: { in: ['url', 'rss'] } },
  });

  let totalCreated = 0;
  let totalFailed = 0;
  const details: { sourceId: string; name: string; created: number; error?: string }[] = [];

  for (const source of sources) {
    try {
      let createdCount = 0;

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
      } else if (source.type === 'url') {
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
        data: { lastChecked: new Date(), status: 'extracted', articleCount: { increment: createdCount } },
      });

      totalCreated += createdCount;
      details.push({ sourceId: source.id, name: source.title || source.name || source.id, created: createdCount });
    } catch (error) {
      totalFailed += 1;
      details.push({
        sourceId: source.id,
        name: source.title || source.name || source.id,
        created: 0,
        error: error instanceof Error ? error.message : '抓取失败',
      });
      await writeLog({ module: '每日抓取', action: `抓取失败：${source.title || source.name || source.id}`, type: 'error' });
    }
  }

  await writeLog({ module: '每日抓取', action: `一键抓取完成，新增 ${totalCreated} 条，失败 ${totalFailed} 个源`, type: 'success' });

  return ok(res, { totalCreated, totalFailed, sources: details });
}));
