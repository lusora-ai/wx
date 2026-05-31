import { Router } from 'express';
import { prisma } from '../db/prisma';
import { buildPublishPackagePayload, createDryRunPublishPackageFromArticle } from '../services/publishPackage';
import { ApiError, asyncRoute, ok } from '../types/api';

export const publishRouter = Router();

publishRouter.get('/tasks', asyncRoute(async (_req, res) => {
  const tasks = await prisma.publishTask.findMany({ orderBy: { createdAt: 'desc' }, include: { article: true } });
  return ok(res, tasks);
}));

publishRouter.get('/tasks/:id', asyncRoute(async (req, res) => {
  const task = await prisma.publishTask.findUnique({ where: { id: req.params.id }, include: { article: true } });
  if (!task) throw new ApiError('PUBLISH_TASK_FAILED', '发布任务不存在。', 404);
  return ok(res, task);
}));

publishRouter.post('/tasks', asyncRoute(async (req, res) => {
  const { articleId, channel, mode, forceRegenerate } = req.body ?? {};
  if (!articleId) throw new ApiError('VALIDATION_ERROR', 'articleId 不能为空。');
  if (channel !== 'wechat' || mode !== 'dry_run') {
    throw new ApiError('VALIDATION_ERROR', 'v1.0 只支持 wechat dry_run。');
  }
  const result = await createDryRunPublishPackageFromArticle(articleId, forceRegenerate === true);
  return ok(res, result.task);
}));

publishRouter.get('/tasks/:id/package', asyncRoute(async (req, res) => {
  const task = await prisma.publishTask.findUnique({
    where: { id: req.params.id },
    include: { article: { include: { imageSlots: { orderBy: { paragraphIndex: 'asc' } }, topic: true } } },
  });
  if (!task) throw new ApiError('PUBLISH_TASK_FAILED', '发布任务不存在。', 404);
  const pkg = await buildPublishPackagePayload(task.article, task);
  return ok(res, pkg);
}));

publishRouter.post('/tasks/:id/retry', asyncRoute(async (req, res) => {
  const task = await prisma.publishTask.findUnique({ where: { id: req.params.id } });
  if (!task) throw new ApiError('PUBLISH_TASK_FAILED', '发布任务不存在。', 404);
  const result = await createDryRunPublishPackageFromArticle(task.articleId, true);
  return ok(res, result.task);
}));

publishRouter.post('/wechat/playwright', (_req, res) => {
  res.status(501).json({
    success: false,
    errorCode: 'NOT_IMPLEMENTED',
    message: 'v1.0 不启用微信公众号自动化同步，请使用 HTML 导出或复制方式手动粘贴。',
  });
});
