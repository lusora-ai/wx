import { Router } from 'express';
import { prisma } from '../db/prisma';
import { runEditorAgent } from '../services/ai/editor';
import { writeLog } from '../services/logger';
import { ApiError, asyncRoute, jsonField, ok, parseJsonField } from '../types/api';

export const topicsRouter = Router();

function serializeTopic(topic: Awaited<ReturnType<typeof prisma.topic.findFirst>> extends infer T ? NonNullable<T> : never) {
  return {
    ...topic,
    facts: parseJsonField<string[]>(topic.facts, []),
    uncertainClaims: parseJsonField<string[]>(topic.uncertainClaims, []),
    suggestedTitles: parseJsonField<string[]>(topic.suggestedTitles, []),
    targetAudiences: parseJsonField<string[]>(topic.targetAudiences, []),
  };
}

topicsRouter.get('/', asyncRoute(async (_req, res) => {
  const topics = await prisma.topic.findMany({ orderBy: { createdAt: 'desc' }, include: { source: true } });
  return ok(res, topics.map(serializeTopic));
}));

topicsRouter.get('/:id', asyncRoute(async (req, res) => {
  const topic = await prisma.topic.findUnique({ where: { id: req.params.id }, include: { source: true } });
  if (!topic) throw new ApiError('TOPIC_NOT_FOUND', '选题不存在。', 404);
  return ok(res, serializeTopic(topic));
}));

topicsRouter.post('/generate', asyncRoute(async (req, res) => {
  const { sourceId } = req.body ?? {};
  if (!sourceId) throw new ApiError('VALIDATION_ERROR', 'sourceId 不能为空。');
  const source = await prisma.source.findUnique({ where: { id: sourceId } });
  if (!source) throw new ApiError('SOURCE_NOT_FOUND', '内容源不存在。', 404);

  try {
    const { data, tokenUsage } = await runEditorAgent({
      rawText: source.rawText,
      title: source.title ?? undefined,
      url: source.url ?? undefined,
    });
    const suggestion = data.topicSuggestions?.[0];
    if (!suggestion) throw new ApiError('AI_OUTPUT_INVALID', 'AI 未返回可用选题。', 502);
    // Try to find a related SourceItem to link
    const relatedSourceItem = await prisma.sourceItem.findFirst({
      where: { sourceId: source.id, status: { not: 'archived' } },
      orderBy: { createdAt: 'desc' },
    });
    const topic = await prisma.topic.create({
      data: {
        sourceId: source.id,
        sourceItemId: relatedSourceItem?.id ?? null,
        originalTitle: source.title,
        originalUrl: source.url,
        translatedTitle: data.coreEvent,
        title: suggestion.title,
        angle: suggestion.angle,
        summary: suggestion.reason || data.coreEvent,
        rawContent: source.rawText,
        facts: jsonField(data.facts ?? []),
        uncertainClaims: jsonField(data.uncertainClaims ?? []),
        suggestedTitles: jsonField(data.topicSuggestions.map((item) => item.title)),
        targetAudiences: jsonField(suggestion.audiences ?? ['officeWorker', 'student', 'freelancer']),
        category: 'AI 资讯',
        hotScore: 80,
        readingTime: '3 min',
      },
    });
    await prisma.source.update({ where: { id: source.id }, data: { status: 'extracted', articleCount: { increment: 1 } } });
    if (relatedSourceItem) {
      await prisma.sourceItem.update({ where: { id: relatedSourceItem.id }, data: { status: 'topic_generated' } });
    }
    await writeLog({ module: '选题', action: `生成选题：${topic.title}`, type: 'success', tokensUsed: tokenUsage });
    return ok(res, serializeTopic(topic));
  } catch (error) {
    await writeLog({ module: '选题', action: 'AI 提炼选题失败', type: 'error' });
    throw error;
  }
}));

topicsRouter.patch('/:id', asyncRoute(async (req, res) => {
  const topic = await prisma.topic.findUnique({ where: { id: req.params.id } });
  if (!topic) throw new ApiError('TOPIC_NOT_FOUND', '选题不存在。', 404);
  const updated = await prisma.topic.update({
    where: { id: req.params.id },
    data: {
      title: req.body.title,
      angle: req.body.angle,
      summary: req.body.summary,
      category: req.body.category,
      hotScore: req.body.hotScore,
      status: req.body.status,
      facts: req.body.facts ? jsonField(req.body.facts) : undefined,
      uncertainClaims: req.body.uncertainClaims ? jsonField(req.body.uncertainClaims) : undefined,
      suggestedTitles: req.body.suggestedTitles ? jsonField(req.body.suggestedTitles) : undefined,
      targetAudiences: req.body.targetAudiences ? jsonField(req.body.targetAudiences) : undefined,
    },
  });
  return ok(res, serializeTopic(updated));
}));

topicsRouter.post('/:id/push', asyncRoute(async (req, res) => {
  const topic = await prisma.topic.findUnique({ where: { id: req.params.id } });
  if (!topic) throw new ApiError('TOPIC_NOT_FOUND', '选题不存在。', 404);
  const updated = await prisma.topic.update({ where: { id: req.params.id }, data: { status: 'pushed' } });
  await writeLog({ module: '选题', action: `推送选题到写作工坊：${updated.title}`, type: 'success' });
  return ok(res, serializeTopic(updated));
}));

topicsRouter.post('/:id/archive', asyncRoute(async (req, res) => {
  const topic = await prisma.topic.findUnique({ where: { id: req.params.id } });
  if (!topic) throw new ApiError('TOPIC_NOT_FOUND', '选题不存在。', 404);
  const updated = await prisma.topic.update({ where: { id: req.params.id }, data: { status: 'archived' } });
  await writeLog({ module: '选题', action: `归档选题：${updated.title}`, type: 'info' });
  return ok(res, serializeTopic(updated));
}));
