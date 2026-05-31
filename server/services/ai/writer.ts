import type { Audience } from '../../types/api';
import { generateJson } from './client';
import { writerPrompt } from './prompts';

export type ArticleAIOutput = {
  audience: Audience;
  title: string;
  summary: string;
  markdown: string;
  cta: string;
  usedFacts: string[];
  imageSlots: {
    slotKey: string;
    paragraphIndex: number;
    marker: string;
    reason: string;
    promptZh: string;
    promptEn?: string;
    negativePrompt?: string;
    aspectRatio: '16:9' | '4:3' | '1:1';
    stylePreset: string;
    altText: string;
  }[];
};

export async function runWriterAgent(input: {
  topicTitle: string;
  topicAngle?: string | null;
  summary: string;
  audience: Audience;
  facts: string[];
  uncertainClaims: string[];
  privateLink?: string;
  tone?: string;
  targetLength?: number;
  model?: 'deepseek-v4-pro';
}) {
  return generateJson<ArticleAIOutput>(
    writerPrompt(input),
    'deepseek',
    {
      timeoutMs: Number(process.env.LLM_TIMEOUT_MS || '90000'),
      timeoutMessage: 'DeepSeek v4 Pro 响应超时，生成失败，请稍后重试。',
    },
  );
}
