import { Router } from 'express';
import { runAutomationPipeline } from '../services/automationPipeline';
import { asyncRoute, ok } from '../types/api';

export const automationRouter = Router();

automationRouter.post('/run', asyncRoute(async (req, res) => {
  const result = await runAutomationPipeline({
    sourceId: typeof req.body?.sourceId === 'string' ? req.body.sourceId : undefined,
    sourceItemId: typeof req.body?.sourceItemId === 'string' ? req.body.sourceItemId : undefined,
    topicId: typeof req.body?.topicId === 'string' ? req.body.topicId : undefined,
    articleId: typeof req.body?.articleId === 'string' ? req.body.articleId : undefined,
    audience: req.body?.audience,
    tone: typeof req.body?.tone === 'string' ? req.body.tone : undefined,
    targetLength: typeof req.body?.targetLength === 'number' ? req.body.targetLength : undefined,
    fillWechat: req.body?.fillWechat === true,
    forceNewArticle: req.body?.forceNewArticle === true,
  });
  return ok(res, result);
}));
