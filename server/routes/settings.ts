import { Router } from 'express';
import { prisma } from '../db/prisma';
import { writeLog } from '../services/logger';
import { asyncRoute, jsonField, ok, parseJsonField } from '../types/api';

export const settingsRouter = Router();

const defaults = {
  llmProvider: 'kimi',
  llmModel: process.env.KIMI_MODEL || process.env.DEEPSEEK_MODEL || 'kimi-k2.6',
  llmBaseUrl: '',
  defaultPrivateLink: '',
  defaultTone: 'casual',
  aiDisclosureEnabled: true,
  publishMode: 'dry_run',
};

settingsRouter.get('/', asyncRoute(async (_req, res) => {
  const rows = await prisma.appSetting.findMany();
  const settings = { ...defaults };
  for (const row of rows) {
    Object.assign(settings, { [row.key]: parseJsonField(row.value, row.value) });
  }
  return ok(res, settings);
}));

settingsRouter.patch('/', asyncRoute(async (req, res) => {
  const allowed = new Set(Object.keys(defaults));
  const payload = req.body ?? {};
  for (const [key, value] of Object.entries(payload)) {
    if (!allowed.has(key) || key.toLowerCase().includes('key')) continue;
    await prisma.appSetting.upsert({
      where: { key },
      update: { value: jsonField(value) },
      create: { key, value: jsonField(value) },
    });
  }
  await writeLog({ module: '设置', action: '保存系统设置（不含 API Key）', type: 'success' });
  const rows = await prisma.appSetting.findMany();
  const settings = { ...defaults };
  for (const row of rows) {
    Object.assign(settings, { [row.key]: parseJsonField(row.value, row.value) });
  }
  return ok(res, settings);
}));
