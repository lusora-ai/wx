import { Router } from 'express';
import { prisma } from '../db/prisma';
import { runEditorAgent } from '../services/ai/editor';
import { writeLog } from '../services/logger';
import { ApiError, asyncRoute, jsonField, ok } from '../types/api';

export const sourceItemsRouter = Router();

sourceItemsRouter.get('/', asyncRoute(async (req, res) => {
  const { status, sourceId, keyword } = req.query;
  const where: Record<string, unknown> = {};

  if (status && typeof status === 'string') {
    where.status = status;
  } else {
    where.status = { not: 'archived' };
  }

  if (sourceId && typeof sourceId === 'string') {
    where.sourceId = sourceId;
  }

  if (keyword && typeof keyword === 'string' && keyword.trim()) {
    where.OR = [
      { title: { contains: keyword.trim() } },
      { rawText: { contains: keyword.trim() } },
    ];
  }

  const items = await prisma.sourceItem.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { source: true },
  });
  return ok(res, items);
}));

sourceItemsRouter.get('/:id', asyncRoute(async (req, res) => {
  const item = await prisma.sourceItem.findUnique({
    where: { id: req.params.id },
    include: { source: true },
  });
  if (!item) throw new ApiError('SOURCE_ITEM_NOT_FOUND', '抓取内容不存在。', 404);
  return ok(res, item);
}));

sourceItemsRouter.patch('/:id', asyncRoute(async (req, res) => {
  const item = await prisma.sourceItem.findUnique({ where: { id: req.params.id } });
  if (!item) throw new ApiError('SOURCE_ITEM_NOT_FOUND', '抓取内容不存在。', 404);
  const updated = await prisma.sourceItem.update({
    where: { id: req.params.id },
    data: {
      title: req.body.title ?? item.title,
      summary: req.body.summary ?? item.summary,
      status: req.body.status ?? item.status,
    },
    include: { source: true },
  });
  await writeLog({ module: '抓取内容', action: `更新抓取内容：${updated.title}`, type: 'info' });
  return ok(res, updated);
}));

sourceItemsRouter.post('/:id/archive', asyncRoute(async (req, res) => {
  const item = await prisma.sourceItem.findUnique({ where: { id: req.params.id } });
  if (!item) throw new ApiError('SOURCE_ITEM_NOT_FOUND', '抓取内容不存在。', 404);
  const updated = await prisma.sourceItem.update({
    where: { id: req.params.id },
    data: { status: 'archived' },
    include: { source: true },
  });
  await writeLog({ module: '抓取内容', action: `归档抓取内容：${updated.title}`, type: 'warning' });
  return ok(res, updated);
}));

sourceItemsRouter.post('/:id/restore', asyncRoute(async (req, res) => {
  const item = await prisma.sourceItem.findUnique({ where: { id: req.params.id } });
  if (!item) throw new ApiError('SOURCE_ITEM_NOT_FOUND', '抓取内容不存在。', 404);
  if (item.status !== 'archived') throw new ApiError('VALIDATION_ERROR', '只有已归档内容可以恢复。');
  const updated = await prisma.sourceItem.update({
    where: { id: req.params.id },
    data: { status: 'pending' },
    include: { source: true },
  });
  await writeLog({ module: '抓取内容', action: `恢复抓取内容：${updated.title}`, type: 'success' });
  return ok(res, updated);
}));

sourceItemsRouter.post('/:id/generate-topic', asyncRoute(async (req, res) => {
  const item = await prisma.sourceItem.findUnique({ where: { id: req.params.id }, include: { source: true } });
  if (!item) throw new ApiError('SOURCE_ITEM_NOT_FOUND', '抓取内容不存在。', 404);
  if (item.status === 'archived') throw new ApiError('VALIDATION_ERROR', '已归档内容不能生成选题。');
  if (item.status === 'topic_generated') {
    const existingTopic = await prisma.topic.findFirst({ where: { sourceItemId: item.id } });
    if (existingTopic) throw new ApiError('VALIDATION_ERROR', `该内容已生成选题「${existingTopic.title}」，请勿重复生成。`);
  }
  // Pre-checks
  const warnings: string[] = [];
  if (item.rawText.length < 200) {
    warnings.push(`原始内容仅 ${item.rawText.length} 字（建议 200 字以上），生成的选题可能质量较低。`);
  }
  if (item.qualityScore !== null && item.qualityScore < 40) {
    warnings.push(`内容质量分仅 ${item.qualityScore}（建议 40 分以上），建议先检查原文是否可用。`);
  }
  const { data, tokenUsage } = await runEditorAgent({
    rawText: item.rawText,
    title: item.title,
    url: item.url || undefined,
  });
  const suggestion = data.topicSuggestions?.[0];
  if (!suggestion) throw new ApiError('AI_OUTPUT_INVALID', 'AI 未返回可用选题。', 502);
  const topic = await prisma.topic.create({
    data: {
      sourceId: item.sourceId,
      sourceItemId: item.id,
      originalTitle: item.title,
      originalUrl: item.url,
      translatedTitle: data.coreEvent,
      title: suggestion.title,
      angle: suggestion.angle,
      summary: suggestion.reason || data.coreEvent,
      rawContent: item.rawText,
      facts: jsonField(data.facts ?? []),
      uncertainClaims: jsonField(data.uncertainClaims ?? []),
      suggestedTitles: jsonField(data.topicSuggestions.map((entry) => entry.title)),
      targetAudiences: jsonField(suggestion.audiences ?? ['officeWorker', 'student', 'freelancer']),
      category: item.source.region === 'domestic' ? '国内资讯' : '海外资讯',
      hotScore: 80,
      readingTime: '3 min',
      status: 'pending',
    },
  });
  await prisma.sourceItem.update({ where: { id: item.id }, data: { status: 'topic_generated' } });
  await writeLog({ module: '选题', action: `从抓取内容生成选题：${topic.title}`, type: 'success', tokensUsed: tokenUsage });
  return ok(res, { ...topic, warnings: warnings.length > 0 ? warnings : undefined });
}));
