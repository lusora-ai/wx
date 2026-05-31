import 'dotenv/config';
import { prisma } from '../server/db/prisma';

let DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

// Test data patterns
const TEST_PATTERNS = ['[DEV]', '[TEST]', '[MOCK]', 'E2E'];
const LOCALHOST_PATTERNS = ['127.0.0.1', 'localhost'];

function hasTestPattern(text: string | null | undefined): boolean {
  if (!text) return false;
  return TEST_PATTERNS.some((p) => text.includes(p));
}

function hasLocalhostPattern(text: string | null | undefined): boolean {
  if (!text) return false;
  return LOCALHOST_PATTERNS.some((p) => text.includes(p));
}

async function main() {
  console.log('🧹 测试数据清理工具\n');

  if (!DRY_RUN && !EXECUTE) {
    console.log('用法：');
    console.log('  npm run db:clear-demo:dry   # 预览模式，不实际删除');
    console.log('  npm run db:clear-demo       # 实际执行清理');
    console.log('\n默认为预览模式。');
    DRY_RUN = true;
  }

  if (DRY_RUN) console.log('（预览模式，不会实际删除）\n');

  const stats = {
    publishTasks: 0,
    reviewLogs: 0,
    articleImageSlots: 0,
    articleVersions: 0,
    articles: 0,
    topics: 0,
    sourceItems: 0,
    fetchTasks: 0,
    operationLogs: 0,
    sources: 0,
  };

  // ========== Step 1: Find test sources ==========
  console.log('📋 扫描测试数据...\n');

  const allSources = await prisma.source.findMany({
    select: { id: true, name: true, title: true, url: true, status: true },
  });

  const testSourceIds = new Set<string>();
  const testSourceDetails: { id: string; name: string; reason: string }[] = [];

  for (const source of allSources) {
    const reasons: string[] = [];
    if (hasTestPattern(source.name)) reasons.push(`name含测试标记`);
    if (hasTestPattern(source.title)) reasons.push(`title含测试标记`);
    if (hasLocalhostPattern(source.url)) reasons.push(`url含localhost`);
    if (reasons.length > 0) {
      testSourceIds.add(source.id);
      testSourceDetails.push({ id: source.id, name: source.name || '(无名)', reason: reasons.join(', ') });
    }
  }

  console.log(`找到 ${testSourceIds.size} 个测试源：`);
  testSourceDetails.forEach((s) => console.log(`  - ${s.name} [${s.reason}]`));

  // ========== Step 2: Find test source items ==========
  const testSourceItemIds = new Set<string>();
  const testSourceItemDetails: { id: string; title: string; reason: string }[] = [];

  // Items linked to test sources
  if (testSourceIds.size > 0) {
    const linkedItems = await prisma.sourceItem.findMany({
      where: { sourceId: { in: Array.from(testSourceIds) } },
      select: { id: true, title: true },
    });
    linkedItems.forEach((item) => {
      testSourceItemIds.add(item.id);
      testSourceItemDetails.push({ id: item.id, title: item.title, reason: '关联测试源' });
    });
  }

  // Items with test patterns in content
  const allItems = await prisma.sourceItem.findMany({
    select: { id: true, title: true, url: true, rawText: true },
  });
  for (const item of allItems) {
    if (testSourceItemIds.has(item.id)) continue;
    const reasons: string[] = [];
    if (hasTestPattern(item.title)) reasons.push('title含测试标记');
    if (hasTestPattern(item.rawText)) reasons.push('rawText含测试标记');
    if (hasLocalhostPattern(item.url)) reasons.push('url含localhost');

    if (reasons.length > 0) {
      testSourceItemIds.add(item.id);
      testSourceItemDetails.push({ id: item.id, title: item.title, reason: reasons.join(', ') });
    }
  }

  console.log(`\n找到 ${testSourceItemIds.size} 个测试源条目：`);
  testSourceItemDetails.slice(0, 10).forEach((s) => console.log(`  - ${s.title} [${s.reason}]`));
  if (testSourceItemDetails.length > 10) console.log(`  ... 还有 ${testSourceItemDetails.length - 10} 个`);

  // ========== Step 3: Find test topics ==========
  const testTopicIds = new Set<string>();
  const testTopicDetails: { id: string; title: string; reason: string }[] = [];

  // Topics linked to test sources
  if (testSourceIds.size > 0) {
    const linkedTopics = await prisma.topic.findMany({
      where: testSourceItemIds.size > 0
        ? {
            OR: [
              { sourceId: { in: Array.from(testSourceIds) } },
              { sourceItemId: { in: Array.from(testSourceItemIds) } },
            ],
          }
        : { sourceId: { in: Array.from(testSourceIds) } },
      select: { id: true, title: true },
    });
    linkedTopics.forEach((t) => {
      testTopicIds.add(t.id);
      testTopicDetails.push({ id: t.id, title: t.title, reason: '关联测试源' });
    });
  }

  // Topics with test patterns
  const allTopics = await prisma.topic.findMany({
    select: { id: true, title: true, originalTitle: true, translatedTitle: true, summary: true, rawContent: true },
  });
  for (const topic of allTopics) {
    if (testTopicIds.has(topic.id)) continue;
    const fields = [topic.title, topic.originalTitle, topic.translatedTitle, topic.summary, topic.rawContent];
    if (fields.some(hasTestPattern)) {
      testTopicIds.add(topic.id);
      testTopicDetails.push({ id: topic.id, title: topic.title, reason: '内容含测试标记' });
    }
  }

  console.log(`\n找到 ${testTopicIds.size} 个测试选题：`);
  testTopicDetails.slice(0, 10).forEach((t) => console.log(`  - ${t.title} [${t.reason}]`));
  if (testTopicDetails.length > 10) console.log(`  ... 还有 ${testTopicDetails.length - 10} 个`);

  // ========== Step 4: Find test articles ==========
  const testArticleIds = new Set<string>();

  // Articles linked to test topics
  if (testTopicIds.size > 0) {
    const linkedArticles = await prisma.article.findMany({
      where: { topicId: { in: Array.from(testTopicIds) } },
      select: { id: true },
    });
    linkedArticles.forEach((a) => testArticleIds.add(a.id));
  }

  // Articles with test patterns
  const allArticles = await prisma.article.findMany({
    select: { id: true, title: true, markdown: true, summary: true },
  });
  for (const article of allArticles) {
    if (testArticleIds.has(article.id)) continue;
    const fields = [article.title, article.markdown, article.summary];
    if (fields.some(hasTestPattern)) {
      testArticleIds.add(article.id);
    }
  }

  console.log(`\n找到 ${testArticleIds.size} 篇测试文章`);

  // ========== Step 5: Find test publish tasks ==========
  let testPublishTaskCount = 0;
  const testPublishTaskIds = new Set<string>();

  // Tasks linked to test articles
  if (testArticleIds.size > 0) {
    const linkedTasks = await prisma.publishTask.findMany({
      where: { articleId: { in: Array.from(testArticleIds) } },
      select: { id: true },
    });
    linkedTasks.forEach((t) => testPublishTaskIds.add(t.id));
  }

  // Tasks with test patterns
  const allTasks = await prisma.publishTask.findMany({
    select: { id: true, title: true, outputMarkdown: true, outputHtml: true },
  });
  for (const task of allTasks) {
    if (testPublishTaskIds.has(task.id)) continue;
    const fields = [task.title, task.outputMarkdown, task.outputHtml];
    if (fields.some(hasTestPattern) || fields.some(hasLocalhostPattern)) {
      testPublishTaskIds.add(task.id);
    }
  }

  testPublishTaskCount = testPublishTaskIds.size;
  console.log(`\n找到 ${testPublishTaskCount} 个测试发布任务`);

  // ========== Step 6: Find test operation logs ==========
  const testLogCount = await prisma.operationLog.count({
    where: {
      OR: [
        { action: { contains: '[DEV]' } },
        { action: { contains: '[TEST]' } },
        { action: { contains: 'E2E' } },
        { module: { contains: '[DEV]' } },
        { module: { contains: '[TEST]' } },
        { module: { contains: 'E2E' } },
      ],
    },
  });
  console.log(`\n找到 ${testLogCount} 条测试操作日志`);

  // ========== Summary ==========
  const total =
    testPublishTaskCount +
    testArticleIds.size * 3 + // articles + versions + image slots
    testTopicIds.size +
    testSourceItemIds.size +
    testSourceIds.size +
    testLogCount;

  console.log('\n📊 清理统计：');
  console.log(`  源: ${testSourceIds.size}`);
  console.log(`  源条目: ${testSourceItemIds.size}`);
  console.log(`  选题: ${testTopicIds.size}`);
  console.log(`  文章: ${testArticleIds.size}`);
  console.log(`  发布任务: ${testPublishTaskCount}`);
  console.log(`  操作日志: ${testLogCount}`);
  console.log(`\n总计约 ${total} 条记录。`);

  if (DRY_RUN) {
    console.log('\n（预览模式，未实际删除。执行 npm run db:clear-demo 进行真实清理。）');
    return;
  }

  // ========== Execute deletion ==========
  console.log('\n🗑️ 开始清理...\n');

  const articleIdArr = Array.from(testArticleIds);
  const topicIdArr = Array.from(testTopicIds);
  const sourceItemIdArr = Array.from(testSourceItemIds);
  const sourceIdArr = Array.from(testSourceIds);
  const publishTaskIdArr = Array.from(testPublishTaskIds);

  // Delete in correct order (children first)
  if (publishTaskIdArr.length > 0) {
    stats.publishTasks = (await prisma.publishTask.deleteMany({ where: { id: { in: publishTaskIdArr } } })).count;
  }

  if (articleIdArr.length > 0) {
    stats.articleImageSlots = (await prisma.articleImageSlot.deleteMany({ where: { articleId: { in: articleIdArr } } })).count;
    stats.reviewLogs = (await prisma.reviewLog.deleteMany({ where: { articleId: { in: articleIdArr } } })).count;
    stats.articleVersions = (await prisma.articleVersion.deleteMany({ where: { articleId: { in: articleIdArr } } })).count;
    stats.articles = (await prisma.article.deleteMany({ where: { id: { in: articleIdArr } } })).count;
  }

  if (topicIdArr.length > 0) {
    stats.topics = (await prisma.topic.deleteMany({ where: { id: { in: topicIdArr } } })).count;
  }

  if (sourceItemIdArr.length > 0) {
    stats.sourceItems = (await prisma.sourceItem.deleteMany({ where: { id: { in: sourceItemIdArr } } })).count;
  }

  // FetchTasks linked to test sources
  if (sourceIdArr.length > 0) {
    stats.fetchTasks = (await prisma.fetchTask.deleteMany({ where: { sourceId: { in: sourceIdArr } } })).count;
  }

  // Operation logs with test patterns
  stats.operationLogs = (await prisma.operationLog.deleteMany({
    where: {
      OR: [
        { action: { contains: '[DEV]' } },
        { action: { contains: '[TEST]' } },
        { action: { contains: 'E2E' } },
        { module: { contains: '[DEV]' } },
        { module: { contains: '[TEST]' } },
        { module: { contains: 'E2E' } },
      ],
    },
  })).count;

  if (sourceIdArr.length > 0) {
    stats.sources = (await prisma.source.deleteMany({ where: { id: { in: sourceIdArr } } })).count;
  }

  // ========== Results ==========
  console.log('✅ 清理完成！\n');
  console.log('删除统计：');
  Object.entries(stats).forEach(([key, count]) => {
    if (count > 0) console.log(`  ${key}: ${count}`);
  });

  const totalDeleted = Object.values(stats).reduce((a, b) => a + b, 0);
  console.log(`\n总计删除 ${totalDeleted} 条记录。`);

  if (totalDeleted === 0) {
    console.log('\n✅ 数据库中没有测试数据，无需清理。');
  }
}

main()
  .catch((error) => {
    console.error('\n清理脚本异常退出');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
