import { prisma } from '../db/prisma';
import { parseJsonField } from '../types/api';

export type ArticleWorkflowStage =
  | 'draft'
  | 'needs_quality_check'
  | 'quality_outdated'
  | 'quality_failed'
  | 'quality_passed'
  | 'package_ready'
  | 'waiting_manual_publish';

export type WorkflowRiskSeverity = 'low' | 'medium' | 'high';

export type ArticleWorkflowStatus = {
  articleId: string;
  topicId: string | null;
  sourceItemId: string | null;
  audience: string | null;
  title: string;
  stage: ArticleWorkflowStage;
  quality: {
    checked: boolean;
    passed: boolean;
    score: number | null;
    riskCount: number;
    risks: Array<{
      code: string;
      message: string;
      severity: WorkflowRiskSeverity;
    }>;
    latestReviewLogId: string | null;
    checkedAt: string | null;
  };
  version: {
    currentVersion: number | null;
    latestSavedAt: string | null;
    manuallyEdited: boolean;
  };
  publish: {
    hasPackage: boolean;
    latestPublishTaskId: string | null;
    status: string | null;
    createdAt: string | null;
  };
  nextAction: {
    type: 'run_quality_check' | 'edit_article' | 'create_package' | 'view_publish_task' | 'none';
    label: string;
    reason: string;
  };
};

type StoredQualityResult = {
  passed?: boolean;
  score?: number;
  issues?: Array<{ type?: string; code?: string; message?: string; severity?: string }>;
};

function normalizeSeverity(value?: string): WorkflowRiskSeverity {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return 'medium';
}

function parseQualityResult(result: string | null | undefined): StoredQualityResult | null {
  if (!result) return null;
  return parseJsonField<StoredQualityResult | null>(result, null);
}

function buildNextAction(stage: ArticleWorkflowStage): ArticleWorkflowStatus['nextAction'] {
  if (stage === 'needs_quality_check') {
    return {
      type: 'run_quality_check',
      label: '运行质量检查',
      reason: '文章还没有 ReviewLog.check 结果。',
    };
  }
  if (stage === 'quality_outdated') {
    return {
      type: 'run_quality_check',
      label: '重新质量检查',
      reason: '文章已编辑，需重新质量检查后再生成发布包。',
    };
  }
  if (stage === 'quality_failed') {
    return {
      type: 'edit_article',
      label: '编辑修订',
      reason: '最新质量检查仍有风险项，发布包生成被阻止。',
    };
  }
  if (stage === 'quality_passed') {
    return {
      type: 'create_package',
      label: '生成发布包',
      reason: '文章已通过质量检查，可以生成 dry-run 发布包。',
    };
  }
  if (stage === 'package_ready' || stage === 'waiting_manual_publish') {
    return {
      type: 'view_publish_task',
      label: '查看发布任务',
      reason: '发布包已生成，可查看或执行微信 PoC。',
    };
  }
  return {
    type: 'none',
    label: '暂无下一步',
    reason: '文章内容为空或仍在草稿准备中。',
  };
}

export async function getArticleWorkflowStatus(articleId: string): Promise<ArticleWorkflowStatus | null> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      topic: true,
      versions: { orderBy: { version: 'desc' }, take: 1 },
      publishTasks: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!article) return null;

  const latestReviewLog = await prisma.reviewLog.findFirst({
    where: { articleId, action: 'check' },
    orderBy: { createdAt: 'desc' },
  });
  const qualityResult = parseQualityResult(latestReviewLog?.result);
  const risks = (qualityResult?.issues ?? []).map((issue) => ({
    code: issue.code || issue.type || 'quality_risk',
    message: issue.message || '质量检查发现风险项。',
    severity: normalizeSeverity(issue.severity),
  }));
  const checked = Boolean(latestReviewLog);
  // Match articleQuality.ts: passed only fails on HIGH severity issues
  const hasHighSeverity = risks.some((r) => r.severity === 'high');
  const passed = checked && qualityResult?.passed === true && !hasHighSeverity;
  const latestVersion = article.versions[0] ?? null;
  const latestPublishTask = article.publishTasks[0] ?? null;
  const hasPackage = Boolean(
    latestPublishTask &&
      (latestPublishTask.status === 'success' || latestPublishTask.outputMarkdown || latestPublishTask.outputHtml)
  );

  // Check if quality check is outdated: article was edited after the last quality check
  const qualityOutdated = checked && latestVersion
    ? latestVersion.createdAt > latestReviewLog!.createdAt
    : false;

  let stage: ArticleWorkflowStage;
  if (!article.markdown?.trim()) {
    stage = 'draft';
  } else if (hasPackage && latestPublishTask?.status === 'success' && !qualityOutdated) {
    stage = 'waiting_manual_publish';
  } else if (hasPackage && !qualityOutdated) {
    stage = 'package_ready';
  } else if (!checked) {
    stage = 'needs_quality_check';
  } else if (qualityOutdated) {
    stage = 'quality_outdated';
  } else if (!passed) {
    stage = 'quality_failed';
  } else {
    stage = 'quality_passed';
  }

  return {
    articleId: article.id,
    topicId: article.topicId,
    sourceItemId: article.topic?.sourceItemId ?? null,
    audience: article.audience,
    title: article.title,
    stage,
    quality: {
      checked,
      passed,
      score: typeof qualityResult?.score === 'number' ? qualityResult.score : null,
      riskCount: risks.length,
      risks,
      latestReviewLogId: latestReviewLog?.id ?? null,
      checkedAt: latestReviewLog?.createdAt.toISOString() ?? null,
    },
    version: {
      currentVersion: article.currentVersion ?? null,
      latestSavedAt: latestVersion?.createdAt.toISOString() ?? article.updatedAt.toISOString(),
      manuallyEdited: Boolean(latestVersion && !['ai_generated', 'regenerated'].includes(latestVersion.changeType)),
    },
    publish: {
      hasPackage,
      latestPublishTaskId: latestPublishTask?.id ?? null,
      status: latestPublishTask?.status ?? null,
      createdAt: latestPublishTask?.createdAt.toISOString() ?? null,
    },
    nextAction: buildNextAction(stage),
  };
}

export async function getArticleWorkflowStatusMap(articleIds: string[]) {
  const entries = await Promise.all(articleIds.map(async (id) => [id, await getArticleWorkflowStatus(id)] as const));
  return new Map(entries.filter((entry): entry is readonly [string, ArticleWorkflowStatus] => Boolean(entry[1])));
}
