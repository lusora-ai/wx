import { ApiError } from '../types/api';
import { runKimiJson } from './ai/client';

export type ImageSlotInput = {
  slotKey?: string;
  paragraphIndex?: number;
  marker?: string;
  reason?: string;
  promptZh?: string;
  promptEn?: string;
  negativePrompt?: string;
  aspectRatio?: string;
  stylePreset?: string;
  altText?: string;
};

export type NormalizedImageSlot = {
  slotKey: string;
  paragraphIndex: number;
  marker: string;
  reason: string;
  promptZh: string;
  promptEn?: string;
  negativePrompt?: string;
  aspectRatio: '16:9' | '4:3' | '1:1';
  stylePreset: string;
  altText?: string;
};

type SlotGenerationOutput = {
  markdown: string;
  imageSlots: ImageSlotInput[];
};

type PromptRegenerationOutput = {
  reason?: string;
  promptZh: string;
  promptEn?: string;
  negativePrompt?: string;
  aspectRatio?: string;
  stylePreset?: string;
  altText?: string;
};

const markerPattern = /\{\{IMAGE_SLOT:(img_\d+)\}\}/g;
const allowedRatios = new Set(['16:9', '4:3', '1:1']);
const defaultNegativePrompt = '不要文字，不要水印，不要品牌 logo，不要真实人物肖像，不要夸张赛博朋克，不要杂乱背景，不要低质卡通风，不要复杂小字。';
const defaultStyle = '公众号科技资讯插图';

export function extractImageSlotKeys(markdown: string): string[] {
  return Array.from(markdown.matchAll(markerPattern)).map((match) => match[1]);
}

export function removeSkippedImageSlotMarkers(markdown: string, skippedKeys: string[]): string {
  return skippedKeys.reduce((current, slotKey) => current.replace(new RegExp(`\\n?\\{\\{IMAGE_SLOT:${slotKey}\\}\\}`, 'g'), ''), markdown);
}

function normalizeAspectRatio(value?: string): '16:9' | '4:3' | '1:1' {
  return allowedRatios.has(value || '') ? (value as '16:9' | '4:3' | '1:1') : '16:9';
}

function insertMarkerAfterParagraph(markdown: string, marker: string, paragraphIndex: number): string {
  if (markdown.includes(marker)) return markdown;
  const blocks = markdown.split(/\n{2,}/);
  const targetIndex = Math.max(0, Math.min(blocks.length - 1, paragraphIndex - 1));
  blocks[targetIndex] = `${blocks[targetIndex].trimEnd()}\n\n${marker}`;
  return blocks.join('\n\n');
}

export function normalizeGeneratedImageSlots(
  markdown: string,
  imageSlots: ImageSlotInput[] = [],
  existingKeys: string[] = [],
  maxSlots = 3,
) {
  const usedKeys = new Set(existingKeys);
  let nextIndex = 1;
  let normalizedMarkdown = markdown;
  const slots: NormalizedImageSlot[] = [];

  for (const rawSlot of imageSlots) {
    if (slots.length >= maxSlots) break;
    while (usedKeys.has(`img_${nextIndex}`)) nextIndex += 1;
    const proposedKey = rawSlot.slotKey && /^img_\d+$/.test(rawSlot.slotKey) ? rawSlot.slotKey : `img_${nextIndex}`;
    const slotKey = usedKeys.has(proposedKey) ? `img_${nextIndex}` : proposedKey;
    usedKeys.add(slotKey);
    nextIndex += 1;

    const marker = `{{IMAGE_SLOT:${slotKey}}}`;
    const paragraphIndex = Number.isFinite(rawSlot.paragraphIndex) ? Math.max(1, Number(rawSlot.paragraphIndex)) : 1;
    const promptZh = rawSlot.promptZh?.trim();
    if (!promptZh) continue;

    normalizedMarkdown = normalizedMarkdown.replace(rawSlot.marker || marker, marker);
    normalizedMarkdown = insertMarkerAfterParagraph(normalizedMarkdown, marker, paragraphIndex);
    slots.push({
      slotKey,
      paragraphIndex,
      marker,
      reason: rawSlot.reason?.trim() || '该段落适合用一张信息化插图帮助读者理解。',
      promptZh,
      promptEn: rawSlot.promptEn?.trim(),
      negativePrompt: rawSlot.negativePrompt?.trim() || defaultNegativePrompt,
      aspectRatio: normalizeAspectRatio(rawSlot.aspectRatio),
      stylePreset: rawSlot.stylePreset?.trim() || defaultStyle,
      altText: rawSlot.altText?.trim() || '公众号科技资讯配图',
    });
  }

  return { markdown: normalizedMarkdown, slots };
}

function buildSlotGenerationPrompt(input: { title: string; markdown: string; existingKeys: string[]; remainingSlots: number }) {
  return `
你是公众号科技文章的配图策划。请只基于输入文章，判断哪些段落适合配图，并返回严格 JSON。
不要生成图片，不要输出任何图片地址、文件路径或图片服务字段。
最多新增 ${input.remainingSlots} 个图片位。图片位必须服务于文章理解，不要为了装饰硬塞。
如果文章不需要配图，返回原 markdown 和 imageSlots=[]。
不要选择包含名人、政治人物、真实公司 logo、可识别品牌 logo、侵权角色的画面。

JSON 结构：
{
  "markdown": "插入 {{IMAGE_SLOT:img_1}} 标记后的完整 Markdown",
  "imageSlots": [
    {
      "slotKey": "img_1",
      "paragraphIndex": 2,
      "marker": "{{IMAGE_SLOT:img_1}}",
      "reason": "推荐原因",
      "promptZh": "中文提示词",
      "promptEn": "English prompt",
      "negativePrompt": "不要文字，不要水印，不要品牌 logo，不要真实人物肖像，不要夸张赛博朋克，不要杂乱背景，不要低质卡通风，不要复杂小字。",
      "aspectRatio": "16:9",
      "stylePreset": "公众号科技资讯插图",
      "altText": "Alt 文案"
    }
  ]
}

提示词必须包含主体画面、场景、构图、风格、色彩、画面禁忌，并说明适合公众号文中插图。风格高级、干净、苹果系、浅色背景、柔和阴影、科技资讯感、克制；不要赛博朋克，不要廉价科技蓝，不要杂乱背景；不要文字、水印、logo、真实人物肖像和复杂小字。
已存在 slotKey：${input.existingKeys.join(', ') || '无'}，不要重复。

文章标题：${input.title}
文章 Markdown：
${input.markdown}
`.trim();
}

export async function generateImageSlotsForArticle(input: {
  title: string;
  markdown: string;
  existingKeys?: string[];
  remainingSlots?: number;
}) {
  const remainingSlots = Math.max(0, Math.min(input.remainingSlots ?? 3, 3));
  if (remainingSlots === 0) return { markdown: input.markdown, slots: [], tokenUsage: undefined };
  const { data, tokenUsage } = await runKimiJson<SlotGenerationOutput>(buildSlotGenerationPrompt({
    title: input.title,
    markdown: input.markdown,
    existingKeys: input.existingKeys ?? extractImageSlotKeys(input.markdown),
    remainingSlots,
  }));
  const normalized = normalizeGeneratedImageSlots(
    data.markdown || input.markdown,
    data.imageSlots || [],
    input.existingKeys ?? [],
    remainingSlots,
  );
  return { ...normalized, tokenUsage };
}

function getParagraphBeforeMarker(markdown: string, marker: string) {
  const before = markdown.split(marker)[0] || markdown;
  const blocks = before.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  return blocks.at(-1) || before.slice(-800);
}

function buildRegeneratePrompt(input: { title: string; markdown: string; marker: string; reason?: string }) {
  return `
你是公众号科技文章的配图提示词编辑。请为指定图片位重新生成提示词，只返回严格 JSON。
不要生成图片，不要输出任何图片地址、文件路径或图片服务字段。
画面不能包含名人肖像、政治人物、真实公司 logo、可识别品牌 logo、侵权角色。
提示词要适合公众号科技资讯文中插图，高级、干净、苹果系、浅色背景、柔和阴影、克制，科技感但不赛博朋克，不要廉价科技蓝，不要杂乱背景。

JSON 结构：
{
  "reason": "推荐原因",
  "promptZh": "中文提示词",
  "promptEn": "English prompt",
  "negativePrompt": "不要文字，不要水印，不要品牌 logo，不要真实人物肖像，不要夸张赛博朋克，不要杂乱背景，不要低质卡通风，不要复杂小字。",
  "aspectRatio": "16:9",
  "stylePreset": "公众号科技资讯插图",
  "altText": "Alt 文案"
}

文章标题：${input.title}
图片位：${input.marker}
原推荐原因：${input.reason || ''}
绑定段落：
${getParagraphBeforeMarker(input.markdown, input.marker)}
`.trim();
}

export async function regenerateImageSlotPrompt(input: { title: string; markdown: string; marker: string; reason?: string }) {
  const { data, tokenUsage } = await runKimiJson<PromptRegenerationOutput>(buildRegeneratePrompt(input));
  if (!data.promptZh?.trim()) {
    throw new ApiError('AI_OUTPUT_INVALID', 'Kimi 2.6 未返回可用的中文配图提示词。', 502);
  }
  return {
    tokenUsage,
    data: {
      reason: data.reason?.trim(),
      promptZh: data.promptZh.trim(),
      promptEn: data.promptEn?.trim(),
      negativePrompt: data.negativePrompt?.trim() || defaultNegativePrompt,
      aspectRatio: normalizeAspectRatio(data.aspectRatio),
      stylePreset: data.stylePreset?.trim() || defaultStyle,
      altText: data.altText?.trim() || '公众号科技资讯配图',
    },
  };
}
