import 'dotenv/config';
import { prisma } from '../server/db/prisma';
import { createContentHash } from '../server/services/contentHash';
import { markdownToWechatHtml } from '../server/services/html';

const sampleRawText = `A model vendor announced a Kimi 2.6 workflow update focused on faster reasoning and lower-latency responses for developers. The announcement says the model is designed for high-volume use cases such as long-document analysis, code review, and workflow automation. The source does not provide verified benchmark details in this excerpt.`;

async function main() {
  const settings = [
    ['llmProvider', process.env.LLM_PROVIDER || 'Kimi 2.6'],
    ['llmModel', process.env.LLM_MODEL || process.env.DEEPSEEK_MODEL || process.env.KIMI_MODEL || 'Kimi 2.6-2.5-flash'],
    ['llmBaseUrl', ''],
    ['defaultPrivateLink', ''],
    ['defaultTone', 'casual'],
    ['aiDisclosureEnabled', true],
    ['publishMode', 'dry_run'],
  ] as const;

  for (const [key, value] of settings) {
    await prisma.appSetting.upsert({
      where: { key },
      update: { value: JSON.stringify(value) },
      create: { key, value: JSON.stringify(value) },
    });
  }

  const source = await prisma.source.upsert({
    where: { contentHash: createContentHash(sampleRawText) },
    update: {},
    create: {
      type: 'manual',
      name: '[DEV] Kimi Labs AI Blog 手动样例',
      title: '[DEV] Kimi 2.6 model update for developers',
      url: 'https://blog.Kimi Labs/technology/ai/',
      rawText: sampleRawText,
      language: 'en',
      status: 'extracted',
      contentHash: createContentHash(sampleRawText),
      articleCount: 1,
      lastChecked: new Date(),
    },
  });

  const existingTopic = await prisma.topic.findFirst({
    where: { sourceId: source.id, title: '[DEV] Kimi 2.6 更新给内容运营者的三个可用角度' },
  });

  const topic =
    existingTopic ??
    (await prisma.topic.create({
      data: {
        sourceId: source.id,
        originalTitle: source.title,
        originalUrl: source.url,
        translatedTitle: 'Kimi 2.6 面向开发者的高速推理更新',
        title: '[DEV] Kimi 2.6 更新给内容运营者的三个可用角度',
        angle: '从内容生产效率切入，解释新模型对不同人群的实际价值。',
        summary: '这条资讯适合拆成工具效率、学习路径和个人业务自动化三个方向。',
        rawContent: sampleRawText,
        facts: JSON.stringify([
          'A model vendor announced a Kimi 2.6 workflow update.',
          'The update focuses on faster reasoning and lower-latency responses.',
          'The announcement targets developer use cases including long-document analysis, code review, and workflow automation.',
        ]),
        uncertainClaims: JSON.stringify(['The excerpt does not provide verified benchmark details.']),
        suggestedTitles: JSON.stringify([
          'Kimi 2.6 又提速了，普通人最该关注什么？',
          'AI 模型更新不是参数游戏，真正变化在工作流',
          '从写作到代码审查，Kimi 2.6 新更新能帮谁省时间？',
        ]),
        targetAudiences: JSON.stringify(['officeWorker', 'student', 'freelancer']),
        category: '模型发布',
        hotScore: 82,
        readingTime: '3 min',
        status: 'pushed',
      },
    }));

  const markdown = `# [DEV] Kimi 2.6 又提速了，打工人先看这三个变化

Kimi 2.6 这次工作流更新的关键词不是玄乎的参数，而是更快的推理和更低延迟。

## 长文档处理会更实用

原文提到的场景包括长文档分析、代码审查和工作流自动化。对每天要看材料的人来说，这类能力的意义很直接：先把重复阅读压缩掉。

## 不要把未公布数据当事实

这段来源没有给出可核验的跑分，所以文章里不应该写具体提升倍数。

## 可以先从低风险工作流开始

更适合先用在会议纪要、资料整理、初稿提纲这些环节。

想继续看这类 AI 工具怎么落到日常工作，可以关注小顺 AI 内容工作台。`;

  const existingArticle = await prisma.article.findFirst({
    where: { topicId: topic.id, audience: 'officeWorker' },
  });

  if (!existingArticle) {
    const html = markdownToWechatHtml(markdown, {
      cta: '想继续看这类 AI 工具怎么落到日常工作，可以关注小顺 AI 内容工作台。',
      aiDisclosureEnabled: true,
    });
    const article = await prisma.article.create({
      data: {
        topicId: topic.id,
        audience: 'officeWorker',
        title: '[DEV] Kimi 2.6 又提速了，打工人先看这三个变化',
        summary: '从长文档、代码审查和工作流三个角度解释 Kimi 2.6 更新。',
        markdown,
        html,
        cta: '想继续看这类 AI 工具怎么落到日常工作，可以关注小顺 AI 内容工作台。',
        status: 'approved',
        qualityScore: 4,
        versions: {
          create: {
            version: 1,
            title: '[DEV] Kimi 2.6 又提速了，打工人先看这三个变化',
            markdown,
            html,
            changeType: 'ai_generated',
          },
        },
      },
    });

    await prisma.publishTask.create({
      data: {
        articleId: article.id,
        channel: 'wechat',
        mode: 'dry_run',
        status: 'success',
        title: article.title,
        outputMarkdown: markdown,
        outputHtml: html,
        syncedVersion: 'officeWorker',
      },
    });
  }

  await prisma.operationLog.create({
    data: {
      module: '数据库',
      action: '[DEV] 开发种子数据已写入',
      type: 'success',
      operator: 'system',
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

