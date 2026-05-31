import { Router } from 'express';
import { prisma } from '../db/prisma';
import { asyncRoute, ok } from '../types/api';

export const dashboardRouter = Router();

dashboardRouter.get('/summary', asyncRoute(async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [
    sourceCountToday,
    pendingTopicCount,
    generatedArticleCount,
    pendingReviewCount,
    exportedArticleCount,
    publishTaskCount,
    failedTaskCount,
    tokenRows,
    recentLogs,
  ] = await Promise.all([
    prisma.source.count({ where: { createdAt: { gte: today } } }),
    prisma.topic.count({ where: { status: 'pending' } }),
    prisma.article.count(),
    prisma.article.count({ where: { status: { in: ['draft', 'editing', 'review_pending'] } } }),
    prisma.article.count({ where: { status: 'exported' } }),
    prisma.publishTask.count(),
    prisma.publishTask.count({ where: { status: 'failed' } }),
    prisma.operationLog.findMany({ where: { createdAt: { gte: today }, tokensUsed: { not: null } } }),
    prisma.operationLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
  ]);

  return ok(res, {
    sourceCountToday,
    pendingTopicCount,
    generatedArticleCount,
    pendingReviewCount,
    exportedArticleCount,
    publishTaskCount,
    failedTaskCount,
    tokenUsedToday: tokenRows.reduce((sum, row) => sum + (row.tokensUsed ?? 0), 0),
    recentLogs,
  });
}));
