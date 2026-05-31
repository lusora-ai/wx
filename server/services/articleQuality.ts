export type QualitySeverity = 'high' | 'medium' | 'low';

export type QualityIssue = {
  type: string;
  message: string;
  severity: QualitySeverity;
};

export type QualityResult = {
  passed: boolean;
  score: number;
  issues: QualityIssue[];
};

const bannedWords = ['赋能', '抓手', '颗粒度', '闭环', '矩阵'];

const aiTonePatterns = [
  '值得注意的是', '让我们', '在当今', '总而言之', '综上所述',
  '毋庸置疑', '众所周知', '不言而喻', '显而易见', '可以说',
  '毫无疑问', '在这个时代', '随着科技', '随着互联网',
];

export function checkArticleQuality(input: {
  title: string;
  markdown: string;
  cta?: string | null;
  imageSlots?: { slotKey: string; paragraphIndex: number }[];
  totalParagraphs?: number;
}): QualityResult {
  const { title, markdown, cta, imageSlots, totalParagraphs } = input;
  const issues: QualityIssue[] = [];
  const wordCount = markdown.replace(/\s/g, '').length;

  // 1. too_short
  if (wordCount < 500) {
    issues.push({ type: 'too_short', message: `正文过短（${wordCount} 字，最低 500 字）。`, severity: 'high' });
  }

  // 2. too_long
  if (wordCount > 1500) {
    issues.push({ type: 'too_long', message: `正文过长（${wordCount} 字，建议 1500 字以内）。`, severity: 'medium' });
  }

  // 3. missing_title
  if (!title.trim()) {
    issues.push({ type: 'missing_title', message: '标题为空。', severity: 'high' });
  }

  // 4. missing_subheadings
  const headingCount = (markdown.match(/^#{2,3}\s+/gm) ?? []).length;
  if (headingCount < 3) {
    issues.push({ type: 'missing_subheadings', message: `正文至少需要 3 个小标题（当前 ${headingCount} 个）。`, severity: 'medium' });
  }

  // 5. missing_cta
  if (!cta && !/(关注|私信|加入|领取|扫码|回复|点击|订阅)/.test(markdown)) {
    issues.push({ type: 'missing_cta', message: '结尾缺少私域 CTA。', severity: 'medium' });
  }

  // 6. ai_tone
  const foundAiTone = aiTonePatterns.filter((p) => markdown.includes(p));
  if (foundAiTone.length > 0) {
    issues.push({ type: 'ai_tone', message: `包含 AI 腔调用语：${foundAiTone.join('、')}。`, severity: 'low' });
  }

  // 7. forbidden_jargon
  const foundJargon = bannedWords.filter((w) => markdown.includes(w));
  if (foundJargon.length > 0) {
    issues.push({ type: 'forbidden_jargon', message: `包含禁用黑话：${foundJargon.join('、')}。`, severity: 'low' });
  }

  // 8. unverified_claim
  if (markdown.includes('[待核实]')) {
    issues.push({ type: 'unverified_claim', message: '正文出现 [待核实] 标记。', severity: 'high' });
  }

  // 9. image_slot_mismatch
  if (imageSlots && imageSlots.length > 0) {
    const paraCount = totalParagraphs ?? (markdown.split(/\n\s*\n/).filter((p) => p.trim()).length);
    const outOfRange = imageSlots.filter((s) => s.paragraphIndex > paraCount || s.paragraphIndex < 1);
    if (outOfRange.length > 0) {
      issues.push({
        type: 'image_slot_mismatch',
        message: `图片位 ${outOfRange.map((s) => s.slotKey).join('、')} 引用的段落序号超出正文范围（共 ${paraCount} 段）。`,
        severity: 'low',
      });
    }
  }

  // 10. html_risk
  if (/<script|<iframe|on\w+=/i.test(markdown)) {
    issues.push({ type: 'html_risk', message: '正文包含 script/iframe 或内联事件处理器。', severity: 'high' });
  }

  const highCount = issues.filter((i) => i.severity === 'high').length;
  const mediumCount = issues.filter((i) => i.severity === 'medium').length;
  const lowCount = issues.filter((i) => i.severity === 'low').length;
  const score = Math.max(0, 100 - highCount * 20 - mediumCount * 10 - lowCount * 5);

  return {
    passed: highCount === 0,
    score,
    issues,
  };
}
