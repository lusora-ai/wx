import { Router } from 'express';
import { prisma } from '../db/prisma';
import { asyncRoute, ok, parseJsonField } from '../types/api';
import { getWechatAutomationStatus } from '../services/wechat/wechatSession';
import {
  closeWechatAutomationRun,
  getCurrentWechatAutomationRun,
  injectWechatDraftPocStable,
  probeWechatEditor,
  runWechatDraftPoc,
  saveWechatDraftPocStable,
  startWechatLogin,
  validateWechatSession,
} from '../services/wechat/wechatPublisher';

export const wechatRouter = Router();

wechatRouter.get('/status', asyncRoute(async (_req, res) => {
  const status = await getWechatAutomationStatus();
  return ok(res, status);
}));

wechatRouter.post('/login/start', asyncRoute(async (_req, res) => {
  const result = await startWechatLogin();
  return ok(res, result);
}));

wechatRouter.post('/drafts/poc', asyncRoute(async (req, res) => {
  const result = await runWechatDraftPoc(req.body?.publishTaskId);
  return ok(res, result);
}));

wechatRouter.post('/session/validate', asyncRoute(async (_req, res) => {
  const result = await validateWechatSession();
  return ok(res, result);
}));

wechatRouter.post('/editor/probe', asyncRoute(async (req, res) => {
  const result = await probeWechatEditor(req.body?.publishTaskId);
  return ok(res, result);
}));

wechatRouter.post('/drafts/inject-poc', asyncRoute(async (req, res) => {
  const result = await injectWechatDraftPocStable(req.body?.publishTaskId);
  return ok(res, result);
}));

wechatRouter.post('/drafts/save-poc', asyncRoute(async (req, res) => {
  const result = await saveWechatDraftPocStable(req.body?.publishTaskId, req.body?.confirm === true, req.body?.runId);
  return ok(res, result);
}));

wechatRouter.get('/runs/current', asyncRoute(async (_req, res) => {
  const result = getCurrentWechatAutomationRun();
  return ok(res, result);
}));

wechatRouter.post('/runs/:runId/close', asyncRoute(async (req, res) => {
  const result = await closeWechatAutomationRun(req.params.runId);
  return ok(res, result);
}));

wechatRouter.post('/drafts/confirm-manual', asyncRoute(async (req, res) => {
  const { publishTaskId } = req.body ?? {};
  if (!publishTaskId) throw new Error('publishTaskId is required');
  const task = await prisma.publishTask.findUnique({ where: { id: publishTaskId } });
  if (!task) throw new Error('PublishTask not found');
  let packageJson = parseJsonField<Record<string, unknown>>(task.packageJson, {});
  packageJson.wechatManualConfirmed = true;
  packageJson.wechatManualConfirmedAt = new Date().toISOString();
  packageJson.wechatManualConfirmationSource = 'manual';
  await prisma.publishTask.update({ where: { id: publishTaskId }, data: { packageJson: JSON.stringify(packageJson) } });
  return ok(res, { confirmed: true, publishTaskId });
}));
