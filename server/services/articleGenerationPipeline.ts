import { prisma } from '../db/prisma';
import { runWriterAgent } from './ai/writer';
import { markdownToWechatHtml } from './html';
import { generateArticleVisualPlan, type VisualPlanResult } from './articleImagePlanner';
import { writeLog } from './logger';
import { parseJsonField, type Audience } from '../types/api';

async function getSettingValue<T>(key: string, fallback: T): Promise<T> {
  const item = await prisma.appSetting.findUnique({ where: { key } });
  return parseJsonField<T>(item?.value, fallback);
}

export async function generateArticlePipeline(input: {
  topicId: string;
  audience: Audience;
  tone?: string;
  targetLength?: number;
}) {
  const startedAt = Date.now();
  const topic = await prisma.topic.findUnique({ where: { id: input.topicId } });
  if (!topic) return null;

  const privateLink = await getSettingValue('defaultPrivateLink', '');
  const facts = parseJsonField<string[]>(topic.facts, []);
  const uncertainClaims = parseJsonField<string[]>(topic.uncertainClaims, []);
  const aiDisclosureEnabled = await getSettingValue('aiDisclosureEnabled', true);

  const { data, tokenUsage } = await runWriterAgent({
    topicTitle: topic.title,
    topicAngle: topic.angle,
    summary: topic.summary,
    audience: input.audience,
    facts,
    uncertainClaims,
    privateLink,
    tone: input.tone,
    targetLength: Math.min(Number(input.targetLength || 900), 1000),
    model: 'deepseek-v4-pro',
  });

  const html = markdownToWechatHtml(data.markdown, { cta: data.cta, aiDisclosureEnabled, imageSlots: [] });
  const article = await prisma.article.create({
    data: {
      topicId: input.topicId,
      audience: input.audience,
      title: data.title,
      summary: data.summary,
      markdown: data.markdown,
      html,
      cta: data.cta,
      status: 'draft',
      tokenUsage,
      versions: {
        create: {
          version: 1,
          title: data.title,
          markdown: data.markdown,
          html,
          changeType: 'ai_generated',
        },
      },
    },
    include: { versions: true, topic: true, imageSlots: { orderBy: { paragraphIndex: 'asc' } } },
  });

  await prisma.topic.update({ where: { id: input.topicId }, data: { status: 'generated' } });
  await writeLog({ module: '文章', action: `DeepSeek 生成单篇文章（${input.audience}）：${topic.title}`, type: 'success', tokensUsed: tokenUsage });

  let visualPlanResult: VisualPlanResult;
  try {
    visualPlanResult = await generateArticleVisualPlan(article.id);
  } catch (error) {
    visualPlanResult = {
      articleId: article.id,
      articleVersion: article.currentVersion,
      visualPlan: null,
      status: 'failed',
      warnings: [error instanceof Error ? error.message : '段落配图方案生成失败。'],
    };
  }

  const refreshedArticle = await prisma.article.findUnique({
    where: { id: article.id },
    include: { versions: true, topic: true, imageSlots: { orderBy: { paragraphIndex: 'asc' } } },
  });

  return {
    article: refreshedArticle || article,
    imageSlots: [],
    visualPlan: visualPlanResult.visualPlan,
    visualPlanStatus: visualPlanResult.status,
    visualPlanWarnings: visualPlanResult.warnings,
    elapsedMs: Date.now() - startedAt,
  };
}
