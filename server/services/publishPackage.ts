import { prisma } from '../db/prisma';
import { markdownToWechatHtml } from './html';
import { writeLog } from './logger';
import { getArticleWorkflowStatus } from './articleWorkflowStatus';
import { generateArticleVisualPlan, parseVisualPlan, type VisualPlan, type VisualImagePrompt } from './articleImagePlanner';
import { ApiError, parseJsonField } from '../types/api';

export type ImagePrompt = VisualImagePrompt;

export type ImagePromptSet = {
  cover: ImagePrompt;
  inlineImages: ImagePrompt[];
  socialShare: ImagePrompt | null;
};

export type PublishPackagePayload = {
  title: string;
  titleAlternatives: string[];
  summary: string;
  markdown: string;
  html: string;
  privateDomainCta: string;
  visualPlan: VisualPlan | null;
  visualPlanStatus: 'ready' | 'stale' | 'missing' | 'failed';
  noVisualPlan: boolean;
  imagePromptSet: ImagePromptSet | null;
  imagePromptCount: number;
  imagePromptSource: 'kimi-2.6' | 'deepseek-v4-pro-fallback' | 'local_template_fallback' | 'legacy' | 'none';
  imagePromptWarnings: string[];
  imageSlots: {
    slotKey: string;
    promptZh: string;
    promptEn: string;
    negativePrompt: string;
    aspectRatio: string;
    stylePreset: string;
    altText: string;
  }[];
  tags: string[];
  cta: string;
  aiDisclosure: boolean;
  sourceUrl: string;
};

type ArticleForPackage = Awaited<ReturnType<typeof loadArticleForPackage>>;

const LEGACY_NEGATIVE_PROMPT = '不要文字、不要水印、不要 logo、不要二维码、不要真实品牌标识、不要政治人物、不要名人肖像、不要低俗夸张表情、不要廉价网赚风、不要赛博朋克过度特效、不要血腥暴力、不要色情暗示。';

async function getSettingValue<T>(key: string, fallback: T): Promise<T> {
  const item = await prisma.appSetting.findUnique({ where: { key } });
  return parseJsonField<T>(item?.value, fallback);
}

async function loadArticleForPackage(articleId: string) {
  return prisma.article.findUnique({
    where: { id: articleId },
    include: { imageSlots: { orderBy: { paragraphIndex: 'asc' } }, topic: true },
  });
}

function audienceTag(audience: string) {
  const labels: Record<string, string> = {
    officeWorker: '打工人',
    student: '大学生',
    freelancer: '自由职业者',
  };
  return labels[audience] || audience;
}

function legacyPromptSet(article: NonNullable<ArticleForPackage>): ImagePromptSet | null {
  if (article.imageSlots.length === 0) return null;
  const inlineImages: VisualImagePrompt[] = article.imageSlots.slice(0, 4).map((slot, index) => ({
    slot: `section_${index + 1}` as const,
    label: `旧配图提示词 ${index + 1}`,
    purpose: slot.reason || '旧文章图片位提示词兼容展示。',
    relatedSectionTitle: null,
    insertAfterParagraph: slot.paragraphIndex,
    prompt: slot.promptZh,
    negativePrompt: slot.negativePrompt || LEGACY_NEGATIVE_PROMPT,
    suggestedRatio: (slot.aspectRatio === '1:1' || slot.aspectRatio === '4:3' || slot.aspectRatio === '16:9') ? slot.aspectRatio : '16:9',
    placementHint: `原 ArticleImageSlot：${slot.slotKey}`,
  }));
  if (inlineImages.length === 0) return null;
  return {
    cover: {
      slot: 'cover',
      label: '旧发布包封面占位',
      purpose: '旧发布包没有文章阅读式封面规划，仅兼容展示。',
      relatedSectionTitle: null,
      insertAfterParagraph: null,
      prompt: '旧发布包未保存封面图提示词，请重新生成段落配图方案。',
      negativePrompt: LEGACY_NEGATIVE_PROMPT,
      suggestedRatio: '2.35:1',
      placementHint: '旧发布包兼容展示',
    },
    inlineImages,
    socialShare: null,
  };
}

function countPrompts(set: ImagePromptSet | null) {
  if (!set) return 0;
  return 1 + set.inlineImages.length + (set.socialShare ? 1 : 0);
}

function buildBasePackage(article: NonNullable<ArticleForPackage>, task?: {
  title?: string | null;
  outputMarkdown?: string | null;
  outputHtml?: string | null;
}) {
  const tags: string[] = [];
  if (article.topic?.category) tags.push(article.topic.category);
  if (article.audience) tags.push(audienceTag(article.audience));
  return {
    title: task?.title || article.title,
    summary: article.summary || '',
    markdown: task?.outputMarkdown || article.markdown,
    html: task?.outputHtml || article.html || '',
    privateDomainCta: article.cta || '',
    tags,
    cta: article.cta || '',
    sourceUrl: article.topic?.originalUrl || '',
  };
}

function imagePromptSource(visualPlan: VisualPlan | null, legacy: boolean): PublishPackagePayload['imagePromptSource'] {
  if (visualPlan?.generatedBy) return visualPlan.generatedBy;
  if (legacy) return 'legacy';
  return 'none';
}

function visualPlanStatus(visualPlan: VisualPlan | null, generationFailed: boolean): PublishPackagePayload['visualPlanStatus'] {
  if (generationFailed) return 'failed';
  if (!visualPlan) return 'missing';
  if (visualPlan.stale) return 'stale';
  return 'ready';
}

function buildPayload(input: {
  article: NonNullable<ArticleForPackage>;
  task?: {
    title?: string | null;
    outputMarkdown?: string | null;
    outputHtml?: string | null;
    packageJson?: string | null;
  };
  aiDisclosureEnabled: boolean;
  outputHtml: string;
  visualPlan: VisualPlan | null;
  generationFailed?: boolean;
  warnings?: string[];
}): PublishPackagePayload {
  const { article, task, aiDisclosureEnabled, outputHtml } = input;
  const base = buildBasePackage(article, task);
  const stored = parseJsonField<Partial<PublishPackagePayload> | null>(task?.packageJson, null);
  const visualPlan = input.visualPlan || stored?.visualPlan || null;
  const legacySet = !visualPlan ? legacyPromptSet(article) : null;
  const imagePromptSet = visualPlan?.imagePromptSet || stored?.imagePromptSet || legacySet;
  const legacy = Boolean(!visualPlan && legacySet);
  const warnings = [
    ...(stored?.imagePromptWarnings || []),
    ...(visualPlan?.warnings || []),
    ...(input.warnings || []),
  ];
  if (visualPlan?.stale) {
    warnings.push('文章已修改，当前段落配图方案可能已过期，建议重新生成段落配图方案。');
  }
  if (!imagePromptSet) {
    warnings.push('暂无段落配图方案；发布包仍可复制 Markdown/HTML，但没有可推荐的配图提示词。');
  }

  return {
    ...base,
    title: stored?.title || base.title,
    titleAlternatives: stored?.titleAlternatives || [],
    summary: stored?.summary || base.summary,
    html: outputHtml,
    visualPlan,
    visualPlanStatus: visualPlanStatus(visualPlan, Boolean(input.generationFailed)),
    noVisualPlan: !visualPlan,
    imagePromptSet,
    imagePromptCount: countPrompts(imagePromptSet),
    imagePromptSource: imagePromptSource(visualPlan, legacy),
    imagePromptWarnings: Array.from(new Set(warnings)),
    imageSlots: article.imageSlots.map((slot) => ({
      slotKey: slot.slotKey,
      promptZh: slot.promptZh,
      promptEn: slot.promptEn || '',
      negativePrompt: slot.negativePrompt || '',
      aspectRatio: slot.aspectRatio,
      stylePreset: slot.stylePreset,
      altText: slot.altText || '',
    })),
    tags: stored?.tags || base.tags,
    cta: stored?.cta || base.cta,
    aiDisclosure: aiDisclosureEnabled,
    sourceUrl: stored?.sourceUrl || base.sourceUrl,
  };
}

export async function buildPublishPackagePayload(article: NonNullable<ArticleForPackage>, task?: {
  title?: string | null;
  outputMarkdown?: string | null;
  outputHtml?: string | null;
  packageJson?: string | null;
}): Promise<PublishPackagePayload> {
  const aiDisclosureEnabled = await getSettingValue('aiDisclosureEnabled', true);
  const base = buildBasePackage(article, task);
  const html = base.html || markdownToWechatHtml(base.markdown, {
    cta: article.cta,
    aiDisclosureEnabled,
    imageSlots: article.imageSlots,
  });
  const stored = parseJsonField<Partial<PublishPackagePayload> | null>(task?.packageJson, null);
  const storedVisualPlan = stored?.visualPlan
    ? { ...stored.visualPlan, stale: stored.visualPlan.basedOnArticleVersion !== article.currentVersion }
    : null;
  const visualPlan = storedVisualPlan || parseVisualPlan(article.visualPlanJson, article.currentVersion);
  return buildPayload({
    article,
    task,
    aiDisclosureEnabled,
    outputHtml: html,
    visualPlan,
  });
}

export async function createDryRunPublishPackageFromArticle(articleId: string, forceRegenerate = false, bypassQualityGate = false) {
  const workflow = await getArticleWorkflowStatus(articleId);
  if (!workflow) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);

  // If current version already has a successful PublishTask with package, return existing unless force
  if (!forceRegenerate && workflow.publish.hasPackage && workflow.publish.latestPublishTaskId) {
    const existingTask = await prisma.publishTask.findUnique({
      where: { id: workflow.publish.latestPublishTaskId },
    });
    const existingArticle = await loadArticleForPackage(articleId);
    if (existingTask && existingTask.status === 'success' && existingArticle) {
      const existingPkg = await buildPublishPackagePayload(existingArticle, existingTask);
      return {
        publishTaskId: existingTask.id,
        task: existingTask,
        package: existingPkg,
        packageSummary: {
          imagePromptCount: existingPkg.imagePromptCount,
          imagePromptSource: existingPkg.imagePromptSource,
          warnings: existingPkg.imagePromptWarnings,
          visualPlanStatus: existingPkg.visualPlanStatus,
        },
        statusText: ['发布包已存在', 'dry-run 已记录', '可直接使用当前发布包'],
        reused: true,
      };
    }
  }

  // If a successful PublishTask exists but lacks packageJson, regenerate package without quality gate
  if (!forceRegenerate) {
    const existingSuccessTask = await prisma.publishTask.findFirst({
      where: { articleId, status: 'success' },
      orderBy: { createdAt: 'desc' },
    });
    if (existingSuccessTask) {
      const article = await loadArticleForPackage(articleId);
      if (article && article.markdown?.trim()) {
        const aiDisclosureEnabled = await getSettingValue('aiDisclosureEnabled', true);
        const outputHtml = article.html || markdownToWechatHtml(article.markdown, {
          cta: article.cta,
          aiDisclosureEnabled,
          imageSlots: article.imageSlots,
        });
        const visualPlan = parseVisualPlan(article.visualPlanJson, article.currentVersion);
        const packagePayload = buildPayload({ article, aiDisclosureEnabled, outputHtml, visualPlan });
        const updatedTask = await prisma.publishTask.update({
          where: { id: existingSuccessTask.id },
          data: { packageJson: JSON.stringify(packagePayload), outputHtml, outputMarkdown: article.markdown },
        });
        await prisma.article.update({ where: { id: articleId }, data: { html: outputHtml, status: 'exported' } });
        return {
          publishTaskId: updatedTask.id,
          task: updatedTask,
          package: packagePayload,
          packageSummary: {
            imagePromptCount: packagePayload.imagePromptCount,
            imagePromptSource: packagePayload.imagePromptSource,
            warnings: packagePayload.imagePromptWarnings,
            visualPlanStatus: packagePayload.visualPlanStatus,
          },
          statusText: ['发布包已补全', 'dry-run 已记录', '可直接使用当前发布包'],
          reused: true,
        };
      }
    }
  }

  // Quality gate: only for creating brand-new packages from articles without any PublishTask
  if (!bypassQualityGate) {
    if (!workflow.quality.checked) {
      throw new ApiError('NEEDS_QUALITY_CHECK', '这篇文章还没有做质量检查，请先在文章工作区运行质量检查。');
    }
    if (workflow.stage === 'quality_outdated') {
      throw new ApiError('QUALITY_OUTDATED', '文章已编辑，需重新质量检查后再生成发布包。');
    }
    if (!workflow.quality.passed) {
      throw new ApiError('QUALITY_FAILED', '这篇文章存在高风险质量项，暂不能生成发布包。');
    }
  }

  const article = await loadArticleForPackage(articleId);
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  if (!article.markdown?.trim()) {
    throw new ApiError('VALIDATION_ERROR', '文章内容为空，不能生成发布包。');
  }

  const aiDisclosureEnabled = await getSettingValue('aiDisclosureEnabled', true);
  const outputHtml = markdownToWechatHtml(article.markdown, {
    cta: article.cta,
    aiDisclosureEnabled,
    imageSlots: article.imageSlots,
  });

  let visualPlan = parseVisualPlan(article.visualPlanJson, article.currentVersion);
  let generationFailed = false;
  let visualPlanWarnings: string[] = [];
  if (!visualPlan || visualPlan.stale) {
    const result = await generateArticleVisualPlan(articleId);
    visualPlan = result.visualPlan;
    visualPlanWarnings = result.warnings;
    generationFailed = result.status === 'failed';
  }

  const packagePayload = buildPayload({
    article,
    aiDisclosureEnabled,
    outputHtml,
    visualPlan,
    generationFailed,
    warnings: visualPlanWarnings,
  });

  const latestTask = await prisma.publishTask.findFirst({
    where: { articleId },
    orderBy: { createdAt: 'desc' },
  });

  const taskData = {
    articleId,
    channel: 'wechat',
    mode: 'dry_run',
    status: 'success',
    title: article.title,
    outputMarkdown: article.markdown,
    outputHtml,
    packageJson: JSON.stringify(packagePayload),
    errorCode: null,
    errorMessage: null,
    syncedVersion: article.audience,
  };

  const task = latestTask
    ? await prisma.publishTask.update({ where: { id: latestTask.id }, data: taskData })
    : await prisma.publishTask.create({ data: taskData });

  await prisma.article.update({
    where: { id: articleId },
    data: { html: outputHtml, status: 'exported' },
  });

  if (packagePayload.imagePromptWarnings.length > 0) {
    await writeLog({
      module: '发布',
      action: `发布包段落配图方案提示：${packagePayload.imagePromptWarnings.join('；')}`,
      type: packagePayload.noVisualPlan ? 'warning' : 'info',
    });
  }
  await writeLog({
    module: '发布',
    action: `发布包已生成，dry-run 已记录，等待手动发布：${article.title}；段落配图方案 ${packagePayload.imagePromptCount} 条`,
    type: 'success',
  });

  return {
    publishTaskId: task.id,
    task,
    package: packagePayload,
    packageSummary: {
      imagePromptCount: packagePayload.imagePromptCount,
      imagePromptSource: packagePayload.imagePromptSource,
      warnings: packagePayload.imagePromptWarnings,
      visualPlanStatus: packagePayload.visualPlanStatus,
    },
    statusText: ['发布包已生成', 'dry-run 已记录', '等待手动发布', packagePayload.noVisualPlan ? '暂无段落配图方案' : `已生成 ${packagePayload.imagePromptCount} 条段落配图提示词`],
  };
}

export type EnsurePublishTaskResult = {
  ensured: boolean;
  reused: boolean;
  publishTaskId: string;
  stage: string;
  message: string;
};

export async function ensurePublishTaskForArticle(articleId: string): Promise<EnsurePublishTaskResult> {
  const workflow = await getArticleWorkflowStatus(articleId);
  if (!workflow) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);

  // If already has a PublishTask, return it
  if (workflow.publish.hasPackage && workflow.publish.latestPublishTaskId) {
    return {
      ensured: true,
      reused: true,
      publishTaskId: workflow.publish.latestPublishTaskId,
      stage: workflow.stage,
      message: '已有发布包，无需重复创建。',
    };
  }

  // If already has a success PublishTask (even without packageJson), try to fill it
  if (workflow.publish.latestPublishTaskId && workflow.publish.status === 'success') {
    const result = await createDryRunPublishPackageFromArticle(articleId);
    return {
      ensured: true,
      reused: result.reused,
      publishTaskId: result.publishTaskId,
      stage: 'package_ready',
      message: result.reused ? '已有发布包，已补全内容。' : '发布包已生成。',
    };
  }

  // Check if article has been approved/exported (user-level approval bypasses quality gate)
  const article = await prisma.article.findUnique({ where: { id: articleId }, select: { status: true } });
  const userApproved = article && (article.status === 'approved' || article.status === 'exported');

  // Quality gate: must have passed quality check, unless user-approved
  if (!userApproved) {
    if (!workflow.quality.checked) {
      return {
        ensured: false,
        reused: false,
        publishTaskId: '',
        stage: workflow.stage,
        message: '文章尚未进行质量检查，无法生成发布包。',
      };
    }
    if (workflow.stage === 'quality_outdated') {
      return {
        ensured: false,
        reused: false,
        publishTaskId: '',
        stage: workflow.stage,
        message: '文章已编辑，需重新质量检查后再生成发布包。',
      };
    }
    if (!workflow.quality.passed) {
      return {
        ensured: false,
        reused: false,
        publishTaskId: '',
        stage: workflow.stage,
        message: '文章质量检查未通过，无法生成发布包。',
      };
    }
  }

  // Quality passed or user-approved, create the package
  const result = await createDryRunPublishPackageFromArticle(articleId, false, userApproved);
  return {
    ensured: true,
    reused: result.reused,
    publishTaskId: result.publishTaskId,
    stage: 'package_ready',
    message: userApproved
      ? (result.reused ? '已有发布包。' : '已为已批准文章生成发布包。')
      : '质量检查通过，已生成发布包并进入微信发布中心。',
  };
}
