import { Router } from 'express';
import { prisma } from '../db/prisma';
import { createContentHash } from '../services/contentHash';
import { writeLog } from '../services/logger';
import { ApiError, asyncRoute, ok } from '../types/api';
import { sourcePresets } from '../services/fetch/sourcePresets';

export const sourcePresetsRouter = Router();

sourcePresetsRouter.get('/', asyncRoute(async (_req, res) => {
  const existingSources = await prisma.source.findMany({
    where: { status: { not: 'archived' } },
    select: { url: true },
  });
  const existingUrls = new Set(existingSources.map((s) => s.url).filter(Boolean));

  const presets = sourcePresets.map((preset) => ({
    ...preset,
    added: existingUrls.has(preset.url),
  }));

  return ok(res, presets);
}));

sourcePresetsRouter.post('/:presetId/add', asyncRoute(async (req, res) => {
  const preset = sourcePresets.find((p) => p.id === req.params.presetId);
  if (!preset) throw new ApiError('VALIDATION_ERROR', '预设源不存在。', 404);

  const contentHash = createContentHash(`${preset.type}:${preset.url}:preset`);
  const existing = await prisma.source.findUnique({ where: { contentHash } });
  if (existing) return ok(res, existing);

  const source = await prisma.source.create({
    data: {
      type: preset.type,
      name: preset.name,
      title: preset.name,
      url: preset.url,
      rawText: preset.description,
      region: preset.region,
      language: preset.language,
      status: 'pending',
      contentHash,
    },
  });

  await writeLog({ module: '内容源', action: `从预设添加内容源：${preset.name}`, type: 'success' });
  return ok(res, source);
}));
