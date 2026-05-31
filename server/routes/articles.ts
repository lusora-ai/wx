import { Router } from 'express';
import { prisma } from '../db/prisma';
import { runWriterAgent } from '../services/ai/writer';
import { markdownToWechatHtml } from '../services/html';
import { writeLog } from '../services/logger';
import { getArticleWorkflowStatus } from '../services/articleWorkflowStatus';
import { createDryRunPublishPackageFromArticle, ensurePublishTaskForArticle } from '../services/publishPackage';
import { generateArticlePipeline } from '../services/articleGenerationPipeline';
import { generateArticleVisualPlan } from '../services/articleImagePlanner';
import { ApiError, asyncRoute, audiences, ok, parseJsonField, type Audience } from '../types/api';

export const articlesRouter = Router();

async function getSettingValue<T>(key: string, fallback: T): Promise<T> {
  const item = await prisma.appSetting.findUnique({ where: { key } });
  return parseJsonField<T>(item?.value, fallback);
}

articlesRouter.get('/', asyncRoute(async (_req, res) => {
  const articles = await prisma.article.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { topic: true, versions: { orderBy: { version: 'desc' } }, imageSlots: { orderBy: { paragraphIndex: 'asc' } } },
  });
  return ok(res, articles);
}));

articlesRouter.get('/:id/workflow-status', asyncRoute(async (req, res) => {
  const status = await getArticleWorkflowStatus(req.params.id);
  if (!status) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  return ok(res, status);
}));

articlesRouter.post('/:id/visual-plan', asyncRoute(async (req, res) => {
  const result = await generateArticleVisualPlan(req.params.id);
  return ok(res, result);
}));

articlesRouter.post('/:id/publish-package', asyncRoute(async (req, res) => {
  const forceRegenerate = req.body?.forceRegenerate === true;
  const result = await createDryRunPublishPackageFromArticle(req.params.id, forceRegenerate);
  return ok(res, result);
}));

articlesRouter.post('/:id/ensure-publish-task', asyncRoute(async (req, res) => {
  const result = await ensurePublishTaskForArticle(req.params.id);
  return ok(res, result);
}));

articlesRouter.get('/:id', asyncRoute(async (req, res) => {
  const article = await prisma.article.findUnique({
    where: { id: req.params.id },
    include: { topic: true, versions: { orderBy: { version: 'desc' } }, publishTasks: { orderBy: { createdAt: 'desc' } }, imageSlots: { orderBy: { paragraphIndex: 'asc' } } },
  });
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  return ok(res, article);
}));

articlesRouter.post('/generate', asyncRoute(async (req, res) => {
  const { topicId, tone, targetLength } = req.body ?? {};
  const audience = req.body?.audience as Audience;
  if (!audiences.includes(audience)) throw new ApiError('VALIDATION_ERROR', 'audience 必须是 officeWorker、student 或 freelancer。');
  if (!topicId) throw new ApiError('VALIDATION_ERROR', 'topicId 不能为空。');
  const result = await generateArticlePipeline({ topicId, audience, tone, targetLength });
  if (!result) throw new ApiError('TOPIC_NOT_FOUND', '选题不存在。', 404);
  return ok(res, result);
}));

articlesRouter.patch('/:id', asyncRoute(async (req, res) => {
  const article = await prisma.article.findUnique({ where: { id: req.params.id }, include: { imageSlots: true } });
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  const title = req.body.title ?? article.title;
  const markdown = req.body.markdown ?? article.markdown;
  const cta = req.body.cta ?? article.cta;
  const aiDisclosureEnabled = await getSettingValue('aiDisclosureEnabled', true);
  const html = markdownToWechatHtml(markdown, { cta, aiDisclosureEnabled, imageSlots: article.imageSlots });
  const nextVersion = article.currentVersion + 1;

  const updated = await prisma.article.update({
    where: { id: article.id },
    data: {
      title,
      summary: req.body.summary ?? article.summary,
      markdown,
      html,
      cta,
      status: req.body.status ?? 'editing',
      currentVersion: nextVersion,
      reviewerFeedback: req.body.reviewerFeedback ?? article.reviewerFeedback,
      versions: {
        create: {
          version: nextVersion,
          title,
          markdown,
          html,
          changeType: req.body.changeType ?? 'user_edit',
        },
      },
    },
    include: { versions: { orderBy: { version: 'desc' } }, topic: true, imageSlots: { orderBy: { paragraphIndex: 'asc' } } },
  });
  await writeLog({ module: '文章', action: `保存文章版本 v${nextVersion}：${title}`, type: 'success' });
  return ok(res, updated);
}));

articlesRouter.post('/:id/regenerate', asyncRoute(async (req, res) => {
  const article = await prisma.article.findUnique({ where: { id: req.params.id }, include: { topic: true } });
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  if (!article.topic) throw new ApiError('TOPIC_NOT_FOUND', '文章未关联选题。', 404);

  const facts = parseJsonField<string[]>(article.topic.facts, []);
  const uncertainClaims = parseJsonField<string[]>(article.topic.uncertainClaims, []);
  const privateLink = await getSettingValue('defaultPrivateLink', '');
  const aiDisclosureEnabled = await getSettingValue('aiDisclosureEnabled', true);
  if (!audiences.includes(article.audience as Audience)) {
    throw new ApiError('VALIDATION_ERROR', '文章受众类型无效。');
  }
  const { data, tokenUsage } = await runWriterAgent({
    topicTitle: article.topic.title,
    topicAngle: article.topic.angle,
    summary: article.topic.summary,
    audience: article.audience as Audience,
    facts,
    uncertainClaims,
    privateLink,
    tone: req.body.tone,
    targetLength: req.body.targetLength,
  });
  const html = markdownToWechatHtml(data.markdown, { cta: data.cta, aiDisclosureEnabled, imageSlots: [] });
  const nextVersion = article.currentVersion + 1;
  const updated = await prisma.article.update({
    where: { id: article.id },
    data: {
      title: data.title,
      summary: data.summary,
      markdown: data.markdown,
      html,
      cta: data.cta,
      tokenUsage,
      status: 'draft',
      currentVersion: nextVersion,
      imageSlots: {
        deleteMany: {},
      },
      versions: {
        create: { version: nextVersion, title: data.title, markdown: data.markdown, html, changeType: 'regenerated' },
      },
    },
    include: { versions: { orderBy: { version: 'desc' } }, topic: true, imageSlots: { orderBy: { paragraphIndex: 'asc' } } },
  });
  await writeLog({ module: '文章', action: `重新生成文章：${updated.title}`, type: 'success', tokensUsed: tokenUsage });
  return ok(res, updated);
}));

articlesRouter.post('/:id/export-html', asyncRoute(async (req, res) => {
  const article = await prisma.article.findUnique({ where: { id: req.params.id }, include: { imageSlots: true } });
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  const aiDisclosureEnabled = await getSettingValue('aiDisclosureEnabled', true);
  const html = markdownToWechatHtml(article.markdown, { cta: article.cta, aiDisclosureEnabled, imageSlots: article.imageSlots });
  const updated = await prisma.article.update({
    where: { id: article.id },
    data: { html, status: 'exported' },
  });
  await writeLog({ module: '导出', action: `导出 HTML：${article.title}`, type: 'success' });
  return ok(res, { article: updated, html, markdown: article.markdown });
}));
