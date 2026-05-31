import type { Audience } from '../../types/api';

export function editorPrompt(input: { rawText: string; title?: string; url?: string }) {
  return `
你是科技内容主编。请只基于输入源提炼事实和选题，不得编造数据、人名、时间、融资金额、公司关系。
不确定、来源不足、无法核验的内容必须放入 uncertainClaims，不能写成事实。
输出中文，且只输出严格 JSON，不要 Markdown。

JSON 结构：
{
  "coreEvent": "一句话核心事件",
  "facts": ["只来自原文的事实点"],
  "uncertainClaims": ["来源不足或无法核实的说法"],
  "topicSuggestions": [
    {
      "title": "中文选题标题",
      "angle": "内容角度",
      "reason": "为什么适合写",
      "audiences": ["officeWorker", "student", "freelancer"]
    }
  ]
}

标题：${input.title ?? ''}
链接：${input.url ?? ''}
原文：
${input.rawText}
`.trim();
}

const audienceMap: Record<Audience, string> = {
  officeWorker: '打工人：关注职场效率、岗位变化、AI 工具实操、焦虑缓解。',
  student: '大学生：关注学习、求职、入门路径、技能积累。',
  freelancer: '自由职业者：关注接单、商业化、个人品牌、风险控制。',
};

export function writerPrompt(input: {
  topicTitle: string;
  topicAngle?: string | null;
  summary: string;
  audience: Audience;
  facts: string[];
  uncertainClaims: string[];
  privateLink?: string;
  tone?: string;
  targetLength?: number;
}) {
  return `
你是中文公众号内容写作者。请只基于 facts 为指定受众写一篇 700-1000 字文章，严格 JSON 输出，不要额外说明。
要求：
1. 不编造 facts 外的数据；uncertainClaims 只能谨慎表达，不能写成事实。
2. Markdown 正文固定为 3 个小节 + 结尾 CTA。
3. 不使用“赋能、抓手、颗粒度、闭环、矩阵”等黑话，不出现 [待核实]。
4. 不要规划配图，不要插入图片占位符，不要输出图片提示词。段落配图会由 Kimi 2.6 在正文完成后单独阅读生成。

JSON 结构：
{
  "audience": "${input.audience}",
  "title": "文章标题",
  "summary": "微信摘要",
  "markdown": "完整 Markdown 正文",
  "cta": "私域 CTA",
  "usedFacts": ["实际使用的事实点"],
  "imageSlots": []
}

选题：${input.topicTitle}
角度：${input.topicAngle ?? ''}
摘要：${input.summary}
受众：${audienceMap[input.audience]}
语气：${input.tone ?? 'casual'}
目标字数：${input.targetLength ?? 900}
私域链接或引导：${input.privateLink ?? '关注小顺 AI 内容工作台，继续获取 AI 工具实操拆解。'}
facts：
${input.facts.map((fact) => `- ${fact}`).join('\n')}
uncertainClaims：
${input.uncertainClaims.map((claim) => `- ${claim}`).join('\n')}
`.trim();
}
