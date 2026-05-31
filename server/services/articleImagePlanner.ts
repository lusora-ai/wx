import { prisma } from '../db/prisma';
import { generateJson, type AiProvider } from './ai/client';
import { writeLog } from './logger';
import { ApiError, parseJsonField } from '../types/api';

export type VisualImagePrompt = {
  slot: 'cover' | `section_${number}` | 'social_share';
  label: string;
  purpose: string;
  relatedSectionTitle: string | null;
  insertAfterParagraph: number | null;
  prompt: string;
  negativePrompt: string;
  suggestedRatio: '2.35:1' | '16:9' | '4:3' | '1:1' | '3:4';
  placementHint: string;
};

export type VisualPlan = {
  articleId: string;
  articleVersion: number;
  source: 'kimi_article_reading' | 'fallback_after_kimi_timeout' | 'fallback_after_kimi_error' | 'local_template_fallback';
  generatedBy: 'kimi-2.6' | 'deepseek-v4-pro-fallback' | 'local_template_fallback';
  basedOnArticleVersion: number;
  generatedAt: string;
  stale: boolean;
  visualStrategy: {
    overallStyle: string;
    audienceFit: string;
    avoid: string[];
  };
  imagePromptSet: {
    cover: VisualImagePrompt;
    inlineImages: VisualImagePrompt[];
    socialShare: VisualImagePrompt;
  };
  warnings: string[];
};

export type VisualPlanResult = {
  articleId: string;
  articleVersion: number;
  visualPlan: VisualPlan | null;
  status: 'generated' | 'fallback' | 'failed';
  warnings: string[];
};

type VisualPlanAiOutput = {
  articleId?: string;
  visualStrategy?: VisualPlan['visualStrategy'];
  imagePromptSet?: VisualPlan['imagePromptSet'];
};

const NEGATIVE_PROMPT = '不要文字、不要水印、不要 logo、不要二维码、不要真实品牌标识、不要政治人物、不要名人肖像、不要低俗夸张表情、不要廉价网赚风、不要赛博朋克过度特效、不要血腥暴力、不要色情暗示。';

type ArticleWithTopic = NonNullable<Awaited<ReturnType<typeof loadArticleForPlanning>>>;

async function loadArticleForPlanning(articleId: string) {
  return prisma.article.findUnique({
    where: { id: articleId },
    include: { topic: true },
  });
}

function audienceDirection(audience: string) {
  if (audience === 'student') {
    return '大学生：校园、图书馆、宿舍学习、求职准备、课程项目；年轻、清晰、有成长感；避免幼稚卡通、教辅封面、廉价鸡汤。';
  }
  if (audience === 'freelancer') {
    return '自由职业者：个人工作室、远程办公、创作者桌面、客户沟通、个人品牌；自由但专业，强调自我管理；避免躺赚、暴富、网赚骗局感。';
  }
  return '打工人：办公室、通勤、电脑、协作、任务流、效率工具；现实、克制、有压力但不焦虑营销；避免老板压迫、打鸡血、裁员恐吓。';
}

function paragraphList(markdown: string) {
  return markdown
    .split(/\n\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => ({ index: index + 1, text: item.replace(/\s+/g, ' ').slice(0, 260) }));
}

function buildPlannerPrompt(article: ArticleWithTopic, sourceTitle?: string | null, sourceUrl?: string | null) {
  const paragraphs = paragraphList(article.markdown);
  return `你是小顺 AI 内容工作台的公众号视觉编辑。请阅读这篇已经完成的公众号文章，为它规划封面图、正文段落插图和社交传播卡。

你的任务不是重写正文。不要修改正文，不要生成图片，不要返回图片 URL。
必须只输出严格 JSON，不要 Markdown，不要解释。

配图数量规则：
- 最低：1 张封面图、2 张正文段落插图、1 张社交传播卡。
- 推荐：每个核心小节 1 张正文插图，最多 4 张。
- 如果文章有 3 个小节，通常返回 cover + section_1 + section_2 + section_3 + social_share。
- 如果文章有 4 个小节，通常返回 cover + section_1 + section_2 + section_3 + section_4 + social_share。

每条正文插图必须绑定文章内容，并填写 relatedSectionTitle、insertAfterParagraph、placementHint、purpose。
negativePrompt 必须完整包含：${NEGATIVE_PROMPT}

视觉方向：${audienceDirection(article.audience)}

JSON 结构：
{
  "articleId": "${article.id}",
  "visualStrategy": {
    "overallStyle": "string",
    "audienceFit": "string",
    "avoid": ["string"]
  },
  "imagePromptSet": {
    "cover": {
      "slot": "cover",
      "label": "封面图",
      "purpose": "吸引点击，概括文章核心冲突",
      "relatedSectionTitle": null,
      "insertAfterParagraph": null,
      "prompt": "中文提示词，说明主体、场景、氛围、构图、颜色、风格，不出现文字/水印/logo",
      "negativePrompt": "${NEGATIVE_PROMPT}",
      "suggestedRatio": "2.35:1",
      "placementHint": "公众号封面"
    },
    "inlineImages": [
      {
        "slot": "section_1",
        "label": "正文配图 1",
        "purpose": "解释第一部分核心观点",
        "relatedSectionTitle": "文章中的小节标题",
        "insertAfterParagraph": 3,
        "prompt": "中文提示词，必须对应这一小节观点和插入段落",
        "negativePrompt": "${NEGATIVE_PROMPT}",
        "suggestedRatio": "16:9",
        "placementHint": "建议插入在「xxx」小节后"
      }
    ],
    "socialShare": {
      "slot": "social_share",
      "label": "社交传播卡",
      "purpose": "适合朋友圈/社群转发",
      "relatedSectionTitle": null,
      "insertAfterParagraph": null,
      "prompt": "中文提示词",
      "negativePrompt": "${NEGATIVE_PROMPT}",
      "suggestedRatio": "1:1",
      "placementHint": "用于朋友圈或社群转发"
    }
  }
}

输入：
articleId: ${article.id}
title: ${article.title}
audience: ${article.audience}
outlineOrTopic: ${article.topic?.title || ''}
sourceTitle: ${sourceTitle || article.topic?.originalTitle || ''}
sourceUrl: ${sourceUrl || article.topic?.originalUrl || ''}
privateDomainCta: ${article.cta || ''}

段落编号：
${paragraphs.map((item) => `${item.index}. ${item.text}`).join('\n')}

Markdown 正文：
${article.markdown.slice(0, 7000)}`;
}

function normalizeRatio(value: string | undefined, fallback: VisualImagePrompt['suggestedRatio']): VisualImagePrompt['suggestedRatio'] {
  if (value === '2.35:1' || value === '16:9' || value === '4:3' || value === '1:1' || value === '3:4') return value;
  return fallback;
}

function normalizeNegativePrompt(value?: string) {
  if (!value) return NEGATIVE_PROMPT;
  return value.includes('不要文字') && value.includes('不要二维码') && value.includes('不要色情暗示')
    ? value
    : `${value} ${NEGATIVE_PROMPT}`;
}

function normalizePrompt(item: Partial<VisualImagePrompt>, fallback: {
  slot: VisualImagePrompt['slot'];
  label: string;
  purpose: string;
  ratio: VisualImagePrompt['suggestedRatio'];
  placementHint: string;
}): VisualImagePrompt {
  return {
    slot: item.slot || fallback.slot,
    label: item.label || fallback.label,
    purpose: item.purpose || fallback.purpose,
    relatedSectionTitle: item.relatedSectionTitle ?? null,
    insertAfterParagraph: typeof item.insertAfterParagraph === 'number' ? item.insertAfterParagraph : null,
    prompt: item.prompt || '',
    negativePrompt: normalizeNegativePrompt(item.negativePrompt),
    suggestedRatio: normalizeRatio(item.suggestedRatio, fallback.ratio),
    placementHint: item.placementHint || fallback.placementHint,
  };
}

function normalizePlan(data: VisualPlanAiOutput, article: ArticleWithTopic, meta: {
  source: VisualPlan['source'];
  generatedBy: VisualPlan['generatedBy'];
  warnings: string[];
}): VisualPlan {
  const set = data.imagePromptSet;
  if (!set?.cover?.prompt || !set?.socialShare?.prompt || !Array.isArray(set.inlineImages)) {
    throw new Error('模型未返回完整 imagePromptSet。');
  }
  const inlineImages = set.inlineImages
    .slice(0, 4)
    .map((item, index) => normalizePrompt(item, {
      slot: `section_${index + 1}`,
      label: `正文配图 ${index + 1}`,
      purpose: '解释对应小节核心观点',
      ratio: index % 2 === 0 ? '16:9' : '4:3',
      placementHint: '建议插入在对应小节后',
    }))
    .filter((item) => item.prompt && item.relatedSectionTitle && item.insertAfterParagraph);

  if (inlineImages.length < 2) {
    throw new Error('正文段落插图少于 2 条，或缺少小节/段落绑定。');
  }

  return {
    articleId: article.id,
    articleVersion: article.currentVersion,
    source: meta.source,
    generatedBy: meta.generatedBy,
    basedOnArticleVersion: article.currentVersion,
    generatedAt: new Date().toISOString(),
    stale: false,
    visualStrategy: {
      overallStyle: data.visualStrategy?.overallStyle || '公众号专业内容插图，克制、清晰、贴合文章观点。',
      audienceFit: data.visualStrategy?.audienceFit || audienceDirection(article.audience),
      avoid: data.visualStrategy?.avoid?.length ? data.visualStrategy.avoid : ['文字', '水印', 'logo', '二维码', '名人肖像', '低俗夸张表情'],
    },
    imagePromptSet: {
      cover: normalizePrompt(set.cover, {
        slot: 'cover',
        label: '封面图',
        purpose: '吸引点击，概括文章核心冲突',
        ratio: '2.35:1',
        placementHint: '公众号封面',
      }),
      inlineImages,
      socialShare: normalizePrompt(set.socialShare, {
        slot: 'social_share',
        label: '社交传播卡',
        purpose: '适合朋友圈/社群转发',
        ratio: '1:1',
        placementHint: '用于朋友圈或社群转发',
      }),
    },
    warnings: meta.warnings,
  };
}

async function runPlanner(provider: AiProvider, article: ArticleWithTopic, warnings: string[], sourceTitle?: string | null, sourceUrl?: string | null) {
  const prompt = buildPlannerPrompt(article, sourceTitle, sourceUrl);
  return generateJson<VisualPlanAiOutput>(prompt, provider, {
    timeoutMs: Number(provider === 'kimi' ? process.env.KIMI_TIMEOUT_MS || process.env.LLM_TIMEOUT_MS || '90000' : process.env.LLM_TIMEOUT_MS || '90000'),
    timeoutMessage: provider === 'kimi' ? 'Kimi 响应超时，段落配图规划失败。' : 'DeepSeek v4 Pro 兜底段落配图规划超时。',
  }).then((result) => ({ ...result, warnings }));
}

export function parseVisualPlan(value?: string | null, currentVersion?: number | null): VisualPlan | null {
  const plan = parseJsonField<VisualPlan | null>(value, null);
  if (!plan) return null;
  return {
    ...plan,
    stale: currentVersion ? plan.basedOnArticleVersion !== currentVersion : Boolean(plan.stale),
  };
}

export async function generateArticleVisualPlan(articleId: string): Promise<VisualPlanResult> {
  const article = await loadArticleForPlanning(articleId);
  if (!article) throw new ApiError('ARTICLE_NOT_FOUND', '文章不存在。', 404);
  if (!article.markdown.trim()) throw new ApiError('VALIDATION_ERROR', '文章正文为空，不能生成段落配图方案。');

  const sourceItem = article.topic?.sourceItemId
    ? await prisma.sourceItem.findUnique({ where: { id: article.topic.sourceItemId } })
    : null;
  const warnings: string[] = [];
  const existingVisualPlan = parseVisualPlan(article.visualPlanJson, article.currentVersion);

  try {
    const result = await runPlanner('kimi', article, warnings, sourceItem?.title, sourceItem?.url);
    const visualPlan = normalizePlan(result.data, article, {
      source: 'kimi_article_reading',
      generatedBy: 'kimi-2.6',
      warnings,
    });
    await prisma.article.update({
      where: { id: articleId },
      data: { visualPlanJson: JSON.stringify(visualPlan) },
    });
    await writeLog({ module: '配图', action: `Kimi 已生成段落配图方案：${article.title}`, type: 'success', tokensUsed: result.tokenUsage });
    return { articleId, articleVersion: article.currentVersion, visualPlan, status: 'generated', warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const kimiTimedOut = /超时|timeout|aborted/i.test(message);
    warnings.push(kimiTimedOut
      ? 'Kimi 响应超时，已使用 DeepSeek 兜底生成段落配图方案。'
      : `Kimi 段落配图规划失败：${message}`);
    try {
      const result = await runPlanner('deepseek', article, warnings, sourceItem?.title, sourceItem?.url);
      const visualPlan = normalizePlan(result.data, article, {
        source: kimiTimedOut ? 'fallback_after_kimi_timeout' : 'fallback_after_kimi_error',
        generatedBy: 'deepseek-v4-pro-fallback',
        warnings,
      });
      await prisma.article.update({
        where: { id: articleId },
        data: { visualPlanJson: JSON.stringify(visualPlan) },
      });
      await writeLog({ module: '配图', action: `DeepSeek 兜底生成段落配图方案：${article.title}`, type: 'warning', tokensUsed: result.tokenUsage });
      return { articleId, articleVersion: article.currentVersion, visualPlan, status: 'fallback', warnings };
    } catch (fallbackError) {
      warnings.push(fallbackError instanceof Error ? `DeepSeek 兜底段落配图规划失败：${fallbackError.message}` : 'DeepSeek 兜底段落配图规划失败。');
      if (existingVisualPlan) {
        warnings.push(existingVisualPlan.stale
          ? '本次重新生成失败，已保留上一版段落配图方案；文章已修改，建议稍后重试生成。'
          : '本次重新生成失败，已保留当前可用的段落配图方案。');
        await writeLog({ module: '配图', action: `段落配图重新生成失败，保留已有方案：${article.title}；${warnings.join('；')}`, type: 'warning' });
        return {
          articleId,
          articleVersion: article.currentVersion,
          visualPlan: existingVisualPlan,
          status: existingVisualPlan.generatedBy === 'kimi-2.6' ? 'generated' : 'fallback',
          warnings,
        };
      }
      await writeLog({ module: '配图', action: `段落配图方案生成失败：${article.title}；${warnings.join('；')}`, type: 'error' });
      return { articleId, articleVersion: article.currentVersion, visualPlan: null, status: 'failed', warnings };
    }
  }
}
