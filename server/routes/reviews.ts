import { Router } from 'express';
import { prisma } from '../db/prisma';
import { writeLog } from '../services/logger';
import { checkArticleQuality } from '../services/articleQuality';
import { ApiError, asyncRoute, jsonField, ok } from '../types/api';

export const reviewsRouter = Router();

reviewsRouter.post('/check', asyncRoute(async (req, res) => {
  const { articleId } = req.body ?? {};
  if (!articleId) throw new ApiError('VALIDATION_ERROR', 'articleId 不能为空。');
  const article = await prisma.article.findUnique({ where: { id: articleId }, include: { imageSlots: true } });
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  const paragraphs = article.markdown.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const result = checkArticleQuality({
    title: article.title,
    markdown: article.markdown,
    cta: article.cta,
    imageSlots: article.imageSlots.map((s) => ({ slotKey: s.slotKey, paragraphIndex: s.paragraphIndex })),
    totalParagraphs: paragraphs,
  });
  await prisma.reviewLog.create({ data: { articleId, action: 'check', result: jsonField(result) } });
  return ok(res, result);
}));

reviewsRouter.post('/:articleId/approve', asyncRoute(async (req, res) => {
  const article = await prisma.article.findUnique({ where: { id: req.params.articleId } });
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  const updated = await prisma.article.update({
    where: { id: article.id },
    data: {
      status: 'approved',
      qualityScore: req.body.qualityScore,
      reviewerFeedback: req.body.comment ?? article.reviewerFeedback,
    },
  });
  await prisma.reviewLog.create({ data: { articleId: article.id, action: 'approve', comment: req.body.comment } });
  await writeLog({ module: '审核', action: `审核通过：${article.title}`, type: 'success' });
  return ok(res, updated);
}));

reviewsRouter.post('/:articleId/reject', asyncRoute(async (req, res) => {
  const article = await prisma.article.findUnique({ where: { id: req.params.articleId } });
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  const updated = await prisma.article.update({
    where: { id: article.id },
    data: { status: 'review_pending', reviewerFeedback: req.body.comment },
  });
  await prisma.reviewLog.create({ data: { articleId: article.id, action: 'reject', comment: req.body.comment } });
  await writeLog({ module: '审核', action: `审核驳回：${article.title}`, type: 'warning' });
  return ok(res, updated);
}));
