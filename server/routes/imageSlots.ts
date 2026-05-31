import { Router } from 'express';
import { prisma } from '../db/prisma';
import { markdownToWechatHtml } from '../services/html';
import { generateImageSlotsForArticle, regenerateImageSlotPrompt } from '../services/imageSlotPrompt';
import { writeLog } from '../services/logger';
import { ApiError, asyncRoute, ok, parseJsonField } from '../types/api';

export const imageSlotsRouter = Router();

async function getSettingValue<T>(key: string, fallback: T): Promise<T> {
  const item = await prisma.appSetting.findUnique({ where: { key } });
  return parseJsonField<T>(item?.value, fallback);
}

function serializeSlot<T extends { createdAt: Date; updatedAt: Date }>(slot: T) {
  return {
    ...slot,
    createdAt: slot.createdAt.toISOString(),
    updatedAt: slot.updatedAt.toISOString(),
  };
}

imageSlotsRouter.get('/articles/:articleId/image-slots', asyncRoute(async (req, res) => {
  const article = await prisma.article.findUnique({ where: { id: req.params.articleId } });
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  const slots = await prisma.articleImageSlot.findMany({
    where: { articleId: article.id },
    orderBy: { paragraphIndex: 'asc' },
  });
  return ok(res, slots.map(serializeSlot));
}));

imageSlotsRouter.post('/articles/:articleId/image-slots/generate', asyncRoute(async (req, res) => {
  const article = await prisma.article.findUnique({
    where: { id: req.params.articleId },
    include: { imageSlots: { orderBy: { paragraphIndex: 'asc' } } },
  });
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  if (article.imageSlots.length >= 3) return ok(res, article.imageSlots.map(serializeSlot));

  const existingKeys = article.imageSlots.map((slot) => slot.slotKey);
  const remainingSlots = 3 - article.imageSlots.length;
  const result = await generateImageSlotsForArticle({
    title: article.title,
    markdown: article.markdown,
    existingKeys,
    remainingSlots,
  });

  const aiDisclosureEnabled = await getSettingValue('aiDisclosureEnabled', true);
  const combinedSlots = [
    ...article.imageSlots.map((slot) => ({ slotKey: slot.slotKey, status: slot.status })),
    ...result.slots.map((slot) => ({ slotKey: slot.slotKey, status: 'prompt_ready' })),
  ];
  const html = markdownToWechatHtml(result.markdown, { cta: article.cta, aiDisclosureEnabled, imageSlots: combinedSlots });

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: {
      markdown: result.markdown,
      html,
      imageSlots: {
        create: result.slots.map((slot) => ({
          slotKey: slot.slotKey,
          paragraphIndex: slot.paragraphIndex,
          marker: slot.marker,
          reason: slot.reason,
          promptZh: slot.promptZh,
          promptEn: slot.promptEn,
          negativePrompt: slot.negativePrompt,
          aspectRatio: slot.aspectRatio,
          stylePreset: slot.stylePreset,
          altText: slot.altText,
        })),
      },
    },
    include: { imageSlots: { orderBy: { paragraphIndex: 'asc' } } },
  });

  await writeLog({ module: '配图提示词', action: `为文章补充 ${result.slots.length} 个图片位：${article.title}`, type: 'success', tokensUsed: result.tokenUsage });
  return ok(res, updated.imageSlots.map(serializeSlot));
}));

imageSlotsRouter.patch('/image-slots/:slotId', asyncRoute(async (req, res) => {
  const allowed = ['promptZh', 'promptEn', 'negativePrompt', 'aspectRatio', 'stylePreset', 'altText', 'status'] as const;
  const data: Partial<Record<(typeof allowed)[number], string>> = {};
  for (const key of allowed) {
    if (typeof req.body?.[key] === 'string') data[key] = req.body[key];
  }
  if (data.status && !['prompt_ready', 'skipped'].includes(data.status)) {
    throw new ApiError('VALIDATION_ERROR', '图片位状态只能是 prompt_ready 或 skipped。');
  }
  if (data.aspectRatio && !['16:9', '4:3', '1:1'].includes(data.aspectRatio)) {
    throw new ApiError('VALIDATION_ERROR', '图片比例只能是 16:9、4:3 或 1:1。');
  }

  const slot = await prisma.articleImageSlot.update({
    where: { id: req.params.slotId },
    data,
  });
  await writeLog({ module: '配图提示词', action: `更新图片位：${slot.slotKey}`, type: 'success' });
  return ok(res, serializeSlot(slot));
}));

imageSlotsRouter.post('/image-slots/:slotId/regenerate-prompt', asyncRoute(async (req, res) => {
  const slot = await prisma.articleImageSlot.findUnique({
    where: { id: req.params.slotId },
    include: { article: true },
  });
  if (!slot) throw new ApiError('ARTICLE_NOT_FOUND', '图片位不存在。', 404);

  const result = await regenerateImageSlotPrompt({
    title: slot.article.title,
    markdown: slot.article.markdown,
    marker: slot.marker,
    reason: slot.reason,
  });
  const updated = await prisma.articleImageSlot.update({
    where: { id: slot.id },
    data: { ...result.data, status: 'prompt_ready' },
  });
  await writeLog({ module: '配图提示词', action: `重新生成图片位提示词：${slot.slotKey}`, type: 'success', tokensUsed: result.tokenUsage });
  return ok(res, serializeSlot(updated));
}));

imageSlotsRouter.post('/image-slots/:slotId/skip', asyncRoute(async (req, res) => {
  const slot = await prisma.articleImageSlot.update({
    where: { id: req.params.slotId },
    data: { status: 'skipped' },
    include: { article: { include: { imageSlots: true } } },
  });
  const aiDisclosureEnabled = await getSettingValue('aiDisclosureEnabled', true);
  const html = markdownToWechatHtml(slot.article.markdown, {
    cta: slot.article.cta,
    aiDisclosureEnabled,
    imageSlots: slot.article.imageSlots.map((item) => item.id === slot.id ? { ...item, status: 'skipped' } : item),
  });
  await prisma.article.update({ where: { id: slot.articleId }, data: { html } });
  await writeLog({ module: '配图提示词', action: `跳过图片位：${slot.slotKey}`, type: 'success' });
  return ok(res, serializeSlot(slot));
}));
