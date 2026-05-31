import 'dotenv/config';
import { createServer } from 'node:http';
import { prisma } from '../server/db/prisma';
import { createContentHash } from '../server/services/contentHash';
import { fetchRssItems } from '../server/services/fetch/rssFetcher';
import { checkContentQuality } from '../server/services/fetch/contentQuality';
import { markdownToWechatHtml } from '../server/services/html';
import { normalizeGeneratedImageSlots, extractImageSlotKeys } from '../server/services/imageSlotPrompt';
import { checkArticleQuality } from '../server/services/articleQuality';
import { createDryRunPublishPackageFromArticle } from '../server/services/publishPackage';
import { runAutomationPipeline } from '../server/services/automationPipeline';
import { runEditorAgent } from '../server/services/ai/editor';
import { runWriterAgent, type ArticleAIOutput } from '../server/services/ai/writer';
import { jsonField, type Audience } from '../server/types/api';
import { sourcePresets } from '../server/services/fetch/sourcePresets';

process.env.LLM_TIMEOUT_MS ||= '90000';
process.env.LLM_RETRY_ATTEMPTS ||= '1';

const KEEP_E2E_DATA = process.env.KEEP_E2E_DATA === 'true';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function cleanupTestData(label: string) {
  console.log(`\n🧹 清理${label}测试数据...`);
  const testSources = await prisma.source.findMany({
    where: {
      OR: [
        { name: { contains: '[TEST]' } },
        { name: { contains: 'E2E' } },
        { url: { contains: '127.0.0.1' } },
        { url: { contains: 'localhost' } },
      ],
    },
    select: { id: true },
  });
  const sourceIds = testSources.map((s) => s.id);

  if (sourceIds.length === 0) {
    console.log(`  没有需要清理的${label}测试数据。`);
    return 0;
  }

  // Find related data
  const sourceItems = await prisma.sourceItem.findMany({
    where: { sourceId: { in: sourceIds } },
    select: { id: true },
  });
  const sourceItemIds = sourceItems.map((i) => i.id);

  const topics = await prisma.topic.findMany({
    where: sourceItemIds.length > 0
      ? {
          OR: [
            { sourceId: { in: sourceIds } },
            { sourceItemId: { in: sourceItemIds } },
          ],
        }
      : { sourceId: { in: sourceIds } },
    select: { id: true },
  });
  const topicIds = topics.map((t) => t.id);

  const articles = await prisma.article.findMany({
    where: { topicId: { in: topicIds } },
    select: { id: true },
  });
  const articleIds = articles.map((a) => a.id);

  // Delete in order
  let deleted = 0;
  if (articleIds.length > 0) {
    deleted += (await prisma.publishTask.deleteMany({ where: { articleId: { in: articleIds } } })).count;
    deleted += (await prisma.articleImageSlot.deleteMany({ where: { articleId: { in: articleIds } } })).count;
    deleted += (await prisma.reviewLog.deleteMany({ where: { articleId: { in: articleIds } } })).count;
    deleted += (await prisma.articleVersion.deleteMany({ where: { articleId: { in: articleIds } } })).count;
    deleted += (await prisma.article.deleteMany({ where: { id: { in: articleIds } } })).count;
  }
  if (topicIds.length > 0) {
    deleted += (await prisma.topic.deleteMany({ where: { id: { in: topicIds } } })).count;
  }
  if (sourceItemIds.length > 0) {
    deleted += (await prisma.sourceItem.deleteMany({ where: { id: { in: sourceItemIds } } })).count;
  }
  deleted += (await prisma.fetchTask.deleteMany({ where: { sourceId: { in: sourceIds } } })).count;
  deleted += (await prisma.source.deleteMany({ where: { id: { in: sourceIds } } })).count;

  console.log(`  清理完成：删除 ${deleted} 条记录。`);
  return deleted;
}

function validateMarkerMapping(markdown: string, slots: { slotKey: string; marker: string }[]) {
  const markerKeys = extractImageSlotKeys(markdown);
  const slotKeys = slots.map((slot) => slot.slotKey);
  for (const slotKey of slotKeys) assert(markerKeys.includes(slotKey), `正文缺少图片位 marker：${slotKey}`);
  for (const markerKey of markerKeys) assert(slotKeys.includes(markerKey), `marker 没有对应 imageSlot：${markerKey}`);
}

async function startFixtureServer() {
  const rssXml = `<?xml version="1.0"?><rss><channel><title>E2E Feed</title><item><title>AI 内容工作流新增配图提示词系统</title><link>http://127.0.0.1:0/article</link><description>系统把内容源、事实提取、单篇写作、配图提示词和 dry-run 发布拆成可审核步骤。</description><pubDate>Sun, 24 May 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
  const server = createServer((req, res) => {
    if (req.url === '/feed.xml') {
      res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' });
      res.end(rssXml);
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<html><head><title>AI 内容工作流</title><meta name="description" content="单篇生成与配图提示词"></head><body><p>系统支持 RSS 和 URL 抓取。</p><p>文章生成改为单受众单篇模式，超过 90 秒会中断并返回清晰错误。</p></body></html>');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object', 'fixture server 启动失败');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function mockTopicOutput() {
  return {
    coreEvent: '[TEST] AI 内容工作流改为单篇生成并增加配图提示词',
    facts: [
      '系统支持 RSS 和 URL 抓取。',
      '文章生成改为单受众单篇模式。',
      '超过 90 秒会中断并返回清晰错误。',
      '配图提示词只用于人工复制，不生成图片。',
    ],
    uncertainClaims: [],
    topicSuggestions: [{
      title: '[TEST] 单篇生成后，内容工作台更适合真实编辑节奏',
      angle: '从性能、审核和配图提示词三个角度解释改动',
      reason: '该主题适合内容团队理解新流程。',
      audiences: ['officeWorker', 'student', 'freelancer'] as Audience[],
    }],
  };
}

function mockArticleOutput(audience: Audience): ArticleAIOutput {
  return {
    audience,
    title: '[TEST] 单篇生成后，AI 内容工作台终于不再卡在进度条上',
    summary: '从 90 秒超时、单受众生成和配图提示词三个角度看内容生产链路。',
    markdown: `## 为什么改成单篇生成\n\n过去一次生成三篇文章，最容易把模型请求拖慢。现在用户先选定一个受众，只生成当前版本，链路更短，失败也更容易定位。编辑只需要盯住一篇稿子的标题、结构、事实和配图位置，不必在三个受众版本之间来回切换。\n\n这种改法也让失败处理更清楚。如果生成超时，系统能明确告诉用户是哪一篇、哪个模型、哪个步骤出了问题。用户可以缩短目标字数，换 DeepSeek v4 Pro 重试，或先保存已有草稿继续修改。\n\n{{IMAGE_SLOT:img_1}}\n\n## 90 秒超时解决什么问题\n\n服务端会在 90 秒中断请求，并返回清晰提示：生成超时，请缩短文章长度或切换 DeepSeek v4 Pro 重试。前端不会继续卡在 35%。这不是伪造成功，而是把模型响应慢的问题直接暴露给用户。\n\n对于日常内容生产，这个限制很重要。用户每天打开工作台时，需要知道今天能处理什么、哪篇文章需要补充事实、哪篇文章已经可以进入发布包，而不是等一个不确定的请求一直占住界面。\n\n## 配图提示词仍然保留\n\n文章会在适合视觉表达的位置插入图片位，并在侧栏展示中文、英文和负面提示词。系统不生成图片，也不保存图片地址。发布包里只提供可复制的提示词，用户可以带到外部工具里手动使用。\n\n新的发布包还会区分封面图、正文插图和社交传播卡。封面图更适合公众号入口，正文插图帮助解释小节内容，社交传播卡适合朋友圈或社群转发。每条提示词都要求不要文字、水印、logo、二维码，也不会要求生成真实名人或版权 IP。\n\n关注小顺 AI 内容工作台，获取更多内容生产流程拆解。`,
    cta: '关注小顺 AI 内容工作台，获取更多内容生产流程拆解。',
    usedFacts: ['文章生成改为单受众单篇模式。', '超过 90 秒会中断并返回清晰错误。'],
    imageSlots: [{
      slotKey: 'img_1',
      paragraphIndex: 1,
      marker: '{{IMAGE_SLOT:img_1}}',
      reason: '该段落解释单篇生成链路，适合用流程图式插图帮助理解。',
      promptZh: '一张适合微信公众号科技文章的横版插图，画面表现一个极简内容工作台界面，用户选择单一受众后，资料卡片流向文章正文和配图提示词面板。不出现品牌 logo，不出现真实人物肖像。整体风格高级、干净、苹果系、浅色背景、柔和阴影，适合作为文章段落配图。不要文字、水印、logo、复杂小字。',
      promptEn: 'A clean editorial illustration for a Chinese tech newsletter, showing a minimal content workstation where a user selects one audience and data cards flow into an article draft and image prompt panel. No brand logos, no readable text, no identifiable real faces. Premium Apple-like minimal design, light background, soft shadows, suitable for an inline article image.',
      negativePrompt: '不要文字，不要水印，不要品牌 logo，不要真实人物肖像，不要夸张赛博朋克，不要杂乱背景，不要低质卡通风，不要复杂小字。',
      aspectRatio: '16:9',
      stylePreset: '公众号科技资讯插图',
      altText: '单篇文章生成工作流插图',
    }],
  };
}

async function main() {
  const startedAt = Date.now();
  const useAi = process.env.TEST_USE_AI === 'true';
  const report: string[] = [`测试模式：${useAi ? '真实 AI 单篇生成' : 'TEST_USE_AI=false mock 模式'}`];

  // Cleanup previous test data
  await cleanupTestData('上一轮');

  const fixture = await startFixtureServer();
  let createdTestData = 0;

  try {
    // 1. 新增 RSS 源
    const rssSource = await prisma.source.create({
      data: {
        type: 'rss',
        name: `[TEST] E2E RSS ${Date.now()}`,
        title: '[TEST] E2E RSS 源',
        url: `${fixture.baseUrl}/feed.xml`,
        rawText: '[TEST] E2E RSS fixture',
        region: 'global',
        contentHash: createContentHash(`rss:${fixture.baseUrl}/feed.xml:${Date.now()}`),
      },
    });
    createdTestData++;
    report.push(`1. 新增 RSS 源：${rssSource.id}`);

    // 2. 抓取 RSS 源并入库 SourceItem（带质量检查）
    const fetchedItems = await fetchRssItems(rssSource.url || '');
    assert(fetchedItems.length > 0, 'RSS 抓取没有返回条目。');
    const firstFetched = fetchedItems[0];
    const quality = checkContentQuality({
      title: firstFetched.title,
      rawText: firstFetched.rawText,
      url: firstFetched.url,
    });
    const sourceItem = await prisma.sourceItem.create({
      data: {
        sourceId: rssSource.id,
        title: firstFetched.title,
        url: firstFetched.url?.replace('127.0.0.1:0', new URL(fixture.baseUrl).host),
        rawText: firstFetched.rawText,
        summary: firstFetched.summary,
        publishedAt: firstFetched.publishedAt,
        contentHash: createContentHash(`${rssSource.id}:${firstFetched.title}:${firstFetched.rawText}`),
        qualityScore: quality.score,
        qualityIssues: JSON.stringify(quality.issues),
      },
    });
    await prisma.source.update({ where: { id: rssSource.id }, data: { status: 'extracted', articleCount: 1, lastChecked: new Date() } });
    report.push(`2. 抓取 RSS 源并入库 SourceItem：${sourceItem.id}，质量分：${quality.score}`);

    // 3. 测试 SourceItem 归档和恢复
    const archivedItem = await prisma.sourceItem.update({
      where: { id: sourceItem.id },
      data: { status: 'archived' },
    });
    assert(archivedItem.status === 'archived', 'SourceItem 归档失败。');
    const restoredItem = await prisma.sourceItem.update({
      where: { id: sourceItem.id },
      data: { status: 'pending' },
    });
    assert(restoredItem.status === 'pending', 'SourceItem 恢复失败。');
    report.push(`3. SourceItem 归档/恢复测试通过`);

    // 4. 从 SourceItem 生成 Topic
    const topicOutput = useAi
      ? (await runEditorAgent({ rawText: sourceItem.rawText, title: sourceItem.title, url: sourceItem.url || undefined })).data
      : mockTopicOutput();
    const suggestion = topicOutput.topicSuggestions[0];
    const topic = await prisma.topic.create({
      data: {
        sourceId: rssSource.id,
        sourceItemId: sourceItem.id,
        originalTitle: sourceItem.title,
        originalUrl: sourceItem.url,
        translatedTitle: topicOutput.coreEvent,
        title: suggestion.title,
        angle: suggestion.angle,
        summary: suggestion.reason,
        rawContent: sourceItem.rawText,
        facts: jsonField(topicOutput.facts),
        uncertainClaims: jsonField(topicOutput.uncertainClaims),
        suggestedTitles: jsonField(topicOutput.topicSuggestions.map((item) => item.title)),
        targetAudiences: jsonField(suggestion.audiences),
        category: '海外资讯',
        hotScore: 80,
        readingTime: '3 min',
        status: 'pushed',
      },
    });
    assert(topic.sourceItemId === sourceItem.id, 'Topic.sourceItemId 未正确保存。');
    await prisma.sourceItem.update({ where: { id: sourceItem.id }, data: { status: 'topic_generated' } });
    report.push(`4. 从抓取内容生成 Topic：${topic.id}，sourceItemId 已关联`);

    // 5. 单篇文章生成
    const audience: Audience = 'officeWorker';
    const articleOutput = useAi
      ? (await runWriterAgent({
          topicTitle: topic.title,
          topicAngle: topic.angle,
          summary: topic.summary,
          audience,
          facts: topicOutput.facts,
          uncertainClaims: topicOutput.uncertainClaims,
          privateLink: '关注小顺 AI 内容工作台，获取更多内容生产流程拆解。',
          targetLength: 800,
          model: 'deepseek-v4-pro',
        })).data
      : mockArticleOutput(audience);

    const imageSlotResult = normalizeGeneratedImageSlots(articleOutput.markdown, articleOutput.imageSlots, [], 2);
    validateMarkerMapping(imageSlotResult.markdown, imageSlotResult.slots);
    const html = markdownToWechatHtml(imageSlotResult.markdown, { cta: articleOutput.cta, imageSlots: imageSlotResult.slots, aiDisclosureEnabled: true });
    const article = await prisma.article.create({
      data: {
        topicId: topic.id,
        audience,
        title: articleOutput.title,
        summary: articleOutput.summary,
        markdown: imageSlotResult.markdown,
        html,
        cta: articleOutput.cta,
        status: 'draft',
        imageSlots: {
          create: imageSlotResult.slots.map((slot) => ({
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
        versions: { create: { version: 1, title: articleOutput.title, markdown: imageSlotResult.markdown, html, changeType: 'e2e_generated' } },
      },
      include: { imageSlots: true },
    });
    assert(article.imageSlots[0]?.promptZh && article.imageSlots[0]?.promptEn && article.imageSlots[0]?.negativePrompt, '配图提示词复制字段不完整。');
    report.push(`5. 单篇文章生成并校验 imageSlots：${article.id}`);

    // 6. 审核通过
    const approved = await prisma.article.update({
      where: { id: article.id },
      data: { status: 'approved', qualityScore: 5, reviewerFeedback: 'E2E 审核通过。' },
      include: { imageSlots: true },
    });
    const outputHtml = markdownToWechatHtml(approved.markdown, { cta: approved.cta, imageSlots: approved.imageSlots, aiDisclosureEnabled: true });
    assert(outputHtml.includes('此处建议配图'), '导出 HTML 缺少"此处建议配图"提示块。');

    // 7. 创建 dry-run PublishTask
    const task = await prisma.publishTask.create({
      data: {
        articleId: approved.id,
        channel: 'wechat',
        mode: 'dry_run',
        status: 'success',
        title: approved.title,
        outputMarkdown: approved.markdown,
        outputHtml,
        syncedVersion: approved.audience,
      },
    });
    report.push(`6. 创建 dry-run PublishTask：${task.id}`);

    // 6b. 质量检查
    const qualityResult = checkArticleQuality({
      title: approved.title,
      markdown: approved.markdown,
      cta: approved.cta,
      imageSlots: approved.imageSlots.map((s) => ({ slotKey: s.slotKey, paragraphIndex: s.paragraphIndex })),
      totalParagraphs: approved.markdown.split(/\n\s*\n/).filter((p) => p.trim()).length,
    });
    assert(typeof qualityResult.passed === 'boolean', '质量检查 returned 无效 passed。');
    assert(typeof qualityResult.score === 'number', '质量检查 returned 无效 score。');
    assert(Array.isArray(qualityResult.issues), '质量检查 returned 无效 issues。');
    await prisma.reviewLog.create({ data: { articleId: approved.id, action: 'check', result: jsonField(qualityResult) } });
    report.push(`6b. 质量检查：passed=${qualityResult.passed}, score=${qualityResult.score}, issues=${qualityResult.issues.length}`);

    // 6c. 发布包验证
    const pkg = {
      title: task.title || approved.title,
      summary: approved.summary || '',
      markdown: task.outputMarkdown || approved.markdown,
      html: task.outputHtml || approved.html || '',
      imageSlots: approved.imageSlots.map((s) => ({
        slotKey: s.slotKey,
        promptZh: s.promptZh,
        promptEn: s.promptEn || '',
        negativePrompt: s.negativePrompt || '',
        aspectRatio: s.aspectRatio,
        stylePreset: s.stylePreset,
        altText: s.altText || '',
      })),
      tags: ['海外资讯', '打工人'],
      cta: approved.cta || '',
      aiDisclosure: true,
      sourceUrl: topic.originalUrl || '',
    };
    assert(pkg.title, '发布包 title 为空。');
    assert(pkg.markdown, '发布包 markdown 为空。');
    assert(pkg.html, '发布包 html 为空。');
    assert(pkg.imageSlots.length > 0, '发布包 imageSlots 为空。');
    report.push(`6c. 发布包验证：title=${pkg.title.substring(0, 20)}..., imageSlots=${pkg.imageSlots.length}`);

    const originalKimiApiKey = process.env.KIMI_API_KEY;
    const originalDeepSeekApiKey = process.env.DEEPSEEK_API_KEY;
    let publishPackage: Awaited<ReturnType<typeof createDryRunPublishPackageFromArticle>>;
    if (!useAi) {
      process.env.KIMI_API_KEY = '';
      process.env.DEEPSEEK_API_KEY = '';
    }
    try {
      publishPackage = await createDryRunPublishPackageFromArticle(approved.id);
    } finally {
      process.env.KIMI_API_KEY = originalKimiApiKey;
      process.env.DEEPSEEK_API_KEY = originalDeepSeekApiKey;
    }
    if (useAi) {
      assert(publishPackage.package.visualPlan, 'Phase 11 visualPlan 为空。');
      assert(publishPackage.package.imagePromptSet?.inlineImages.every((item) => item.relatedSectionTitle && item.insertAfterParagraph), 'Phase 11 正文插图缺少小节或段落绑定。');
    } else {
      assert(publishPackage.package.noVisualPlan, 'mock 模式不应伪造 Kimi 文章阅读式 visualPlan。');
      assert(publishPackage.package.imagePromptSource !== 'local_template_fallback', '不允许把本地模板伪装成正式 visualPlan。');
    }
    report.push(`6d. Phase 11 visualPlan 边界验证通过：status=${publishPackage.package.visualPlanStatus}, prompts=${publishPackage.package.imagePromptCount}`);

    // 6e. Phase 16 自动化主线应优先续跑已有未完成文章，而不是重新从内容源开始。
    const resumeMarkdown = `## 先处理已经进入后半程的稿件

每天的内容生产并不总是从抓取开始。更常见的情况是，昨天已经生成了一篇稿子，今天只差质量检查、发布包或公众号编辑器填入。如果一键自动化每次都重新抓取、重新选题、重新写一篇，工作台会堆出重复内容，也会让用户分不清哪一篇才是应该推进的当前稿件。

更稳的方式是先看系统里有没有已经进入后半程的文章。只要这篇文章内容完整、没有高风险问题，并且还没有完成发布包或公众号填入，就应该优先继续推进。这样用户点击一次按钮，得到的是当前生产链路的下一步结果，而不是又多出一个需要人工整理的新稿。

{{IMAGE_SLOT:img_1}}

## 为什么不能每次都从抓取重新开始

内容源抓取适合发现新材料，但不应该覆盖正在推进的稿件。文章、质量记录和发布任务已经构成了明确的生产状态，后端应该根据这些状态判断下一步，而不是把前端按钮当成简单的重新生成入口。尤其在公众号场景里，一篇稿子从选题到发布包往往会经历多次编辑，重复生成会增加核对成本。

续跑策略还可以减少模型调用。已经通过写作阶段的文章不需要重新请求正文生成模型，只需要补上质量检查、发布包和后续填入。这样既保留人工编辑痕迹，也能让自动化更接近日常工作节奏。

## 公众号填入前还要保留人工判断

即使发布包已经生成，系统也只能把内容填入公众号编辑器，并保持页面打开让用户检查。标题、正文、段落配图提示词和私域引导都需要人工确认后再保存。自动化可以减少复制粘贴，但不能替用户越过账号登录、风控、验证码或最终保存判断。

这条边界让自动化更加可靠：系统负责把真实内容推进到可检查状态，用户负责最后的确认。关注小顺 AI 内容工作台，获取更多内容生产流程拆解。`;
    const resumeCta = '关注小顺 AI 内容工作台，获取更多内容生产流程拆解。';
    const resumeTopic = await prisma.topic.create({
      data: {
        sourceId: rssSource.id,
        sourceItemId: sourceItem.id,
        originalTitle: '内容自动化续跑验证材料',
        originalUrl: null,
        translatedTitle: '已有文章优先续跑',
        title: '一键自动化应该先续跑已有稿件',
        angle: '验证主线自动化的续跑策略',
        summary: '已有文章应优先补齐质量检查和发布包。',
        rawContent: '已有文章应优先续跑，避免重复生成新稿。',
        facts: jsonField(['已有文章应优先续跑。', '发布包仍然保持 dry-run。']),
        uncertainClaims: jsonField([]),
        suggestedTitles: jsonField(['一键自动化应该先续跑已有稿件']),
        targetAudiences: jsonField([audience]),
        category: '流程验证',
        hotScore: 70,
        readingTime: '3 min',
        status: 'pushed',
      },
    });
    const resumeHtml = markdownToWechatHtml(resumeMarkdown, {
      cta: resumeCta,
      imageSlots: [{ slotKey: 'img_1' }],
      aiDisclosureEnabled: true,
    });
    const resumeArticle = await prisma.article.create({
      data: {
        topicId: resumeTopic.id,
        audience,
        title: '一键自动化应该先续跑已有稿件',
        summary: '验证无显式输入时优先续跑已有文章。',
        markdown: resumeMarkdown,
        html: resumeHtml,
        cta: resumeCta,
        status: 'draft',
        imageSlots: {
          create: [{
            slotKey: 'img_1',
            paragraphIndex: 3,
            marker: '{{IMAGE_SLOT:img_1}}',
            reason: '解释续跑策略的流程插图。',
            promptZh: '一张公众号内容生产流程插图，表现已有文章从质量检查流向发布包，再流向公众号编辑器填入。不要文字、水印、logo、二维码。',
            promptEn: 'A clean editorial workflow illustration showing an existing article moving from quality check to publish package and WeChat editor fill. No text, watermark, logo, or QR code.',
            negativePrompt: '不要文字，不要水印，不要品牌 logo，不要二维码，不要真实人物肖像。',
            aspectRatio: '16:9',
            stylePreset: '公众号科技资讯插图',
            altText: '已有文章续跑流程插图',
          }],
        },
        versions: { create: { version: 1, title: '一键自动化应该先续跑已有稿件', markdown: resumeMarkdown, html: resumeHtml, changeType: 'e2e_generated' } },
      },
      include: { imageSlots: true },
    });
    const resumeQuality = checkArticleQuality({
      title: resumeArticle.title,
      markdown: resumeArticle.markdown,
      cta: resumeArticle.cta,
      imageSlots: resumeArticle.imageSlots.map((s) => ({ slotKey: s.slotKey, paragraphIndex: s.paragraphIndex })),
      totalParagraphs: resumeArticle.markdown.split(/\n\s*\n/).filter((p) => p.trim()).length,
    });
    assert(resumeQuality.passed, `续跑文章质量检查应通过：${resumeQuality.issues.map((issue) => issue.type).join(', ')}`);
    await prisma.reviewLog.create({ data: { articleId: resumeArticle.id, action: 'check', result: jsonField(resumeQuality) } });

    if (!useAi) {
      process.env.KIMI_API_KEY = '';
      process.env.DEEPSEEK_API_KEY = '';
    }
    try {
      const automationResult = await runAutomationPipeline({ audience });
      assert(automationResult.articleId === resumeArticle.id, 'Phase 16 自动化未优先续跑最新合格文章。');
      assert(automationResult.status === 'package_ready', `Phase 16 自动化状态异常：${automationResult.status}`);
      assert(Boolean(automationResult.publishTaskId), 'Phase 16 自动化未生成 dry-run 发布包。');
      assert(automationResult.boundary.wechatSaveAttempted === false, 'Phase 16 自动化不应尝试保存微信草稿。');
      assert(automationResult.steps.some((item) => item.key === 'collect' && item.status === 'skipped'), 'Phase 16 续跑时应跳过内容源抓取。');
    } finally {
      process.env.KIMI_API_KEY = originalKimiApiKey;
      process.env.DEEPSEEK_API_KEY = originalDeepSeekApiKey;
    }
    report.push(`6e. Phase 16 自动化续跑验证通过：article=${resumeArticle.id}`);

    // 8. 创建 FetchTask
    const fetchTask = await prisma.fetchTask.create({
      data: {
        sourceId: rssSource.id,
        type: 'single_source',
        status: 'success',
        total: 1,
        success: 1,
        failed: 0,
        message: 'E2E 测试抓取任务',
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });
    assert(fetchTask.status === 'success', 'FetchTask 创建失败。');
    report.push(`7. 创建 FetchTask：${fetchTask.id}`);

    // 9. 验证 sourcePresets 配置
    assert(sourcePresets.length >= 8, 'sourcePresets 数量不足。');
    assert(sourcePresets.every((p) => p.id && p.name && p.url), 'sourcePresets 字段不完整。');
    report.push(`8. sourcePresets 配置验证通过：${sourcePresets.length} 个预设`);

    // 10. 验证每日摘要 API 逻辑
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const fetchedToday = await prisma.sourceItem.count({ where: { createdAt: { gte: today } } });
    const pendingTopics = await prisma.topic.count({ where: { status: 'pushed' } });
    assert(typeof fetchedToday === 'number', '每日摘要 fetchedToday 查询失败。');
    assert(typeof pendingTopics === 'number', '每日摘要 pendingTopics 查询失败。');
    report.push(`9. 每日摘要查询验证通过：今日抓取 ${fetchedToday}，待写选题 ${pendingTopics}`);

    // 11. 验证选题去重保护
    const existingTopicForItem = await prisma.topic.findFirst({ where: { sourceItemId: sourceItem.id } });
    assert(existingTopicForItem, '通过 sourceItemId 查找已有选题失败。');
    assert(existingTopicForItem.id === topic.id, 'sourceItemId 关联的 Topic ID 不匹配。');
    report.push(`10. 选题去重保护验证通过`);

    // 12. 软删除 RSS 源
    const archived = await prisma.source.update({ where: { id: rssSource.id }, data: { status: 'archived' } });
    assert(archived.status === 'archived', 'RSS 源软删除失败。');
    report.push(`11. 软删除 RSS 源：${archived.id}`);

    // 13. 验证 archived 默认不显示
    const activeSources = await prisma.source.findMany({ where: { status: { not: 'archived' } } });
    const foundArchived = activeSources.find((s) => s.id === rssSource.id);
    assert(!foundArchived, '已归档源不应出现在默认列表中。');
    report.push(`12. 归档过滤验证通过`);

    report.push(`13. 耗时：${Math.round((Date.now() - startedAt) / 1000)}s`);

    console.log('\nE2E 主链路测试报告');
    console.log(report.map((item) => `- ${item}`).join('\n'));
    if (!useAi) console.log('\n当前为 mock AI 模式，如需测试真实 AI 请设置 TEST_USE_AI=true');

    // Cleanup test data after test
    if (!KEEP_E2E_DATA) {
      const cleaned = await cleanupTestData('本轮');
      report.push(`14. 清理测试数据：${cleaned} 条记录`);
    } else {
      console.log('\nKEEP_E2E_DATA=true，保留测试数据用于调试。');
      report.push('14. 保留测试数据（KEEP_E2E_DATA=true）');
    }
  } finally {
    fixture.server.close();
  }
}

main()
  .catch((error) => {
    console.error('\nE2E 主链路测试失败');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
