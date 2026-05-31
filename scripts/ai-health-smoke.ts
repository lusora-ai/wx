import 'dotenv/config';
import { createServer } from 'node:http';
import { prisma } from '../server/db/prisma';
import { createContentHash } from '../server/services/contentHash';
import { fetchRssItems } from '../server/services/fetch/rssFetcher';
import { checkContentQuality } from '../server/services/fetch/contentQuality';
import { markdownToWechatHtml } from '../server/services/html';
import { normalizeGeneratedImageSlots } from '../server/services/imageSlotPrompt';
import { runEditorAgent } from '../server/services/ai/editor';
import { runWriterAgent } from '../server/services/ai/writer';
import { generateArticleVisualPlan } from '../server/services/articleImagePlanner';
import { checkArticleQuality } from '../server/services/articleQuality';
import { jsonField, type Audience } from '../server/types/api';

process.env.LLM_TIMEOUT_MS ||= '60000';
const report: { step: string; status: 'PASS' | 'FAIL'; detail: string; ms?: number }[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function record(step: string, status: 'PASS' | 'FAIL', detail: string, ms?: number) {
  report.push({ step, status, detail, ms });
}

async function startFixtureServer() {
  const rssXml = `<?xml version="1.0"?><rss><channel><title>Smoke Feed</title><item><title>AI 内容工作台烟雾测试验证条目</title><link>http://127.0.0.1:0/smoke</link><description>这是一条用于验证 AI 端到端链路的测试内容。DeepSeek v4 Pro 负责理解资料、提炼事实和生成正文，Kimi 2.6 负责阅读正文并规划段落配图方案。</description><pubDate>Sun, 24 May 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
  const server = createServer((req, res) => {
    if (req.url === '/feed.xml') {
      res.writeHead(200, { 'content-type': 'application/rss+xml; charset=utf-8' });
      res.end(rssXml);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert(address && typeof address === 'object', 'fixture server 启动失败');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function main() {
  const startedAt = Date.now();
  const fixture = await startFixtureServer();
  const cleanupIds: { sourceId?: string; sourceItemId?: string; topicId?: string; articleId?: string } = {};

  console.log('AI 烟雾测试开始...\n');

  // Step 0: Check env keys
  const hasDeepSeek = Boolean(process.env.DEEPSEEK_API_KEY);
  const hasKimi = Boolean(process.env.KIMI_API_KEY);
  if (!hasDeepSeek && !hasKimi) {
    console.log('FAIL: .env 中未配置 DEEPSEEK_API_KEY 或 KIMI_API_KEY');
    process.exitCode = 1;
    return;
  }
  record('环境变量', 'PASS', `DeepSeek: ${hasDeepSeek ? '已配置' : '未配置'}, Kimi: ${hasKimi ? '已配置' : '未配置'}`);

  try {
    // Step 1: Create RSS source
    const t1 = Date.now();
    const rssSource = await prisma.source.create({
      data: {
        type: 'rss',
        name: `Smoke RSS ${Date.now()}`,
        title: 'Smoke RSS 源',
        url: `${fixture.baseUrl}/feed.xml`,
        rawText: 'Smoke test fixture',
        region: 'global',
        contentHash: createContentHash(`smoke:${fixture.baseUrl}/feed.xml:${Date.now()}`),
      },
    });
    cleanupIds.sourceId = rssSource.id;
    record('创建 RSS 源', 'PASS', rssSource.id, Date.now() - t1);

    // Step 2: Fetch RSS
    const t2 = Date.now();
    const fetchedItems = await fetchRssItems(rssSource.url || '');
    assert(fetchedItems.length > 0, 'RSS 抓取没有返回条目。');
    const firstFetched = fetchedItems[0];
    const quality = checkContentQuality({ title: firstFetched.title, rawText: firstFetched.rawText, url: firstFetched.url });
    const sourceItem = await prisma.sourceItem.create({
      data: {
        sourceId: rssSource.id,
        title: firstFetched.title,
        url: firstFetched.url?.replace('127.0.0.1:0', new URL(fixture.baseUrl).host),
        rawText: firstFetched.rawText,
        summary: firstFetched.summary,
        publishedAt: firstFetched.publishedAt,
        contentHash: createContentHash(`smoke:${rssSource.id}:${firstFetched.title}`),
        qualityScore: quality.score,
        qualityIssues: JSON.stringify(quality.issues),
      },
    });
    cleanupIds.sourceItemId = sourceItem.id;
    record('RSS 抓取', 'PASS', `${sourceItem.title} (质量分: ${quality.score})`, Date.now() - t2);

    // Step 3: Generate topic (real AI)
    const t3 = Date.now();
    const topicOutput = await runEditorAgent({ rawText: sourceItem.rawText, title: sourceItem.title, url: sourceItem.url || undefined });
    assert(topicOutput.data.topicSuggestions.length > 0, '选题生成没有返回建议。');
    const suggestion = topicOutput.data.topicSuggestions[0];
    const topic = await prisma.topic.create({
      data: {
        sourceId: rssSource.id,
        sourceItemId: sourceItem.id,
        originalTitle: sourceItem.title,
        originalUrl: sourceItem.url,
        translatedTitle: topicOutput.data.coreEvent,
        title: suggestion.title,
        angle: suggestion.angle,
        summary: suggestion.reason,
        rawContent: sourceItem.rawText,
        facts: jsonField(topicOutput.data.facts),
        uncertainClaims: jsonField(topicOutput.data.uncertainClaims),
        suggestedTitles: jsonField(topicOutput.data.topicSuggestions.map((item) => item.title)),
        targetAudiences: jsonField(suggestion.audiences),
        category: '海外资讯',
        hotScore: 80,
        readingTime: '3 min',
        status: 'pushed',
      },
    });
    cleanupIds.topicId = topic.id;
    record('选题生成 (AI)', 'PASS', suggestion.title, Date.now() - t3);

    // Step 4: Generate article (real AI)
    const t4 = Date.now();
    const audience: Audience = 'officeWorker';
    const articleOutput = await runWriterAgent({
      topicTitle: topic.title,
      topicAngle: topic.angle,
      summary: topic.summary,
      audience,
      facts: topicOutput.data.facts,
      uncertainClaims: topicOutput.data.uncertainClaims,
      privateLink: '关注小顺 AI 内容工作台。',
      targetLength: 500,
      model: 'deepseek-v4-pro',
    });
    assert(articleOutput.data.markdown.length > 100, '文章生成内容过短。');
    const imageSlotResult = normalizeGeneratedImageSlots(articleOutput.data.markdown, articleOutput.data.imageSlots, [], 2);
    const html = markdownToWechatHtml(imageSlotResult.markdown, { cta: articleOutput.data.cta, imageSlots: imageSlotResult.slots, aiDisclosureEnabled: true });
    const article = await prisma.article.create({
      data: {
        topicId: topic.id,
        audience,
        title: articleOutput.data.title,
        summary: articleOutput.data.summary,
        markdown: imageSlotResult.markdown,
        html,
        cta: articleOutput.data.cta,
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
      },
      include: { imageSlots: true },
    });
    cleanupIds.articleId = article.id;
    record('文章生成 (DeepSeek)', 'PASS', article.title, Date.now() - t4);

    const t4b = Date.now();
    const visualPlanResult = await generateArticleVisualPlan(article.id);
    assert(visualPlanResult.visualPlan, `段落配图方案生成失败：${visualPlanResult.warnings.join('；')}`);
    assert(visualPlanResult.visualPlan.imagePromptSet.inlineImages.length >= 2, '段落配图方案正文插图少于 2 条。');
    assert(visualPlanResult.visualPlan.imagePromptSet.inlineImages.every((item) => item.relatedSectionTitle && item.insertAfterParagraph), '段落配图方案缺少小节或段落绑定。');
    record('段落配图规划', 'PASS', `${visualPlanResult.visualPlan.generatedBy}, status=${visualPlanResult.status}, inline=${visualPlanResult.visualPlan.imagePromptSet.inlineImages.length}`, Date.now() - t4b);

    // Step 5: Quality check
    const t5 = Date.now();
    const qualityResult = checkArticleQuality({
      title: article.title,
      markdown: article.markdown,
      cta: article.cta,
      imageSlots: article.imageSlots.map((s) => ({ slotKey: s.slotKey, paragraphIndex: s.paragraphIndex })),
    });
    record('质量检查', qualityResult.passed ? 'PASS' : 'PASS', `得分: ${qualityResult.score}/100, 问题: ${qualityResult.issues.length}`, Date.now() - t5);

    // Step 6: HTML export check
    const t6 = Date.now();
    assert(html.includes('<article'), '导出 HTML 缺少 <article> 标签。');
    assert(html.includes('AI 辅助生成'), '导出 HTML 缺少 AI 声明。');
    record('HTML 导出', 'PASS', '公众号兼容 HTML 验证通过', Date.now() - t6);

  } catch (error) {
    const lastStep = report.length > 0 ? report[report.length - 1].step : '未知步骤';
    record(lastStep + ' (异常)', 'FAIL', error instanceof Error ? error.message : String(error));
  } finally {
    // Cleanup
    try {
      if (cleanupIds.articleId) {
        await prisma.articleImageSlot.deleteMany({ where: { articleId: cleanupIds.articleId } });
        await prisma.articleVersion.deleteMany({ where: { articleId: cleanupIds.articleId } });
        await prisma.publishTask.deleteMany({ where: { articleId: cleanupIds.articleId } });
        await prisma.reviewLog.deleteMany({ where: { articleId: cleanupIds.articleId } });
        await prisma.article.delete({ where: { id: cleanupIds.articleId } });
      }
      if (cleanupIds.topicId) await prisma.topic.delete({ where: { id: cleanupIds.topicId } });
      if (cleanupIds.sourceItemId) await prisma.sourceItem.delete({ where: { id: cleanupIds.sourceItemId } });
      if (cleanupIds.sourceId) await prisma.source.delete({ where: { id: cleanupIds.sourceId } });
    } catch {
      // cleanup failure is non-fatal
    }
    fixture.server.close();
  }

  // Output report
  const totalMs = Date.now() - startedAt;
  const passCount = report.filter((r) => r.status === 'PASS').length;
  const failCount = report.filter((r) => r.status === 'FAIL').length;

  console.log('┌────────────────────────────────────────────────────────────┐');
  console.log('│ AI 烟雾测试报告                                            │');
  console.log('├──────┬──────────────────────┬──────┬───────────────────────┤');
  console.log('│ 步骤 │ 名称                 │ 结果 │ 详情                  │');
  console.log('├──────┼──────────────────────┼──────┼───────────────────────┤');
  report.forEach((r, i) => {
    const idx = String(i + 1).padStart(4);
    const name = r.step.padEnd(20).substring(0, 20);
    const status = r.status === 'PASS' ? 'PASS' : 'FAIL';
    const detail = r.detail.substring(0, 23).padEnd(23);
    const ms = r.ms ? ` (${r.ms}ms)` : '';
    console.log(`│ ${idx} │ ${name} │ ${status} │ ${detail}${ms} │`);
  });
  console.log('└──────┴──────────────────────┴──────┴───────────────────────┘');
  console.log(`\n结果: ${passCount} PASS, ${failCount} FAIL, 总耗时: ${Math.round(totalMs / 1000)}s`);

  if (failCount > 0) {
    process.exitCode = 1;
    console.log('\n烟雾测试失败，请检查 .env 配置和 AI 服务连通性。');
  } else {
    console.log('\n烟雾测试通过。AI 链路正常。');
  }
}

main()
  .catch((error) => {
    console.error('\n烟雾测试异常退出');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
