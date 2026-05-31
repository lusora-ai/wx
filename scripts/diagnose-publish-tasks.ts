import 'dotenv/config';
import { prisma } from '../server/db/prisma';
import { buildPublishPackagePayload } from '../server/services/publishPackage';

function parsePackageTitle(packageJson?: string | null) {
  if (!packageJson) return null;
  try {
    const parsed = JSON.parse(packageJson) as { title?: unknown };
    return typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : null;
  } catch {
    return null;
  }
}

function hasStoredPackageContent(packageJson?: string | null) {
  if (!packageJson) return false;
  try {
    const parsed = JSON.parse(packageJson) as { title?: unknown; markdown?: unknown; html?: unknown };
    return Boolean(parsed.title || parsed.markdown || parsed.html);
  } catch {
    return false;
  }
}

async function main() {
  const tasks = await prisma.publishTask.findMany({
    where: { status: 'success' },
    orderBy: { createdAt: 'desc' },
    include: {
      article: {
        include: {
          topic: true,
          imageSlots: { orderBy: { paragraphIndex: 'asc' } },
        },
      },
    },
  });

  const diagnostics = await Promise.all(tasks.map(async (task) => {
    const packageJsonExists = hasStoredPackageContent(task.packageJson);
    let packageTitle = parsePackageTitle(task.packageJson);
    let canSaveToWechatDraft = false;
    let reason = '';

    try {
      const pkg = await buildPublishPackagePayload(task.article, task);
      packageTitle ||= pkg.title || null;
      canSaveToWechatDraft = Boolean(pkg.title && (pkg.markdown || pkg.html));
      reason = canSaveToWechatDraft
        ? (packageJsonExists ? 'stored packageJson is available' : 'package is fetchable through GET /api/publish/tasks/:id/package')
        : 'package payload is missing title or body';
    } catch (error) {
      reason = error instanceof Error ? error.message : 'failed to build package payload';
    }

    return {
      publishTaskId: task.id,
      title: task.title || task.article.title,
      status: task.status,
      channel: task.channel,
      articleId: task.articleId,
      topicId: task.article.topicId,
      packageJsonExists,
      packageTitle,
      canSaveToWechatDraft,
      reason,
    };
  }));

  console.log(JSON.stringify(diagnostics, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
