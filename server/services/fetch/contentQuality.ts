export type QualityIssue = {
  type: 'too_short' | 'no_title' | 'duplicate' | 'blocked' | 'low_text_density' | 'invalid_url';
  message: string;
  severity: 'low' | 'medium' | 'high';
};

export type ContentQualityResult = {
  passed: boolean;
  score: number;
  issues: QualityIssue[];
};

const BLOCKED_PATTERNS = [
  /access\s*denied/i,
  /\b403\b/,
  /登录后查看/,
  /登录后阅读/,
  /请登录/,
  /captcha/i,
  /robot\s*check/i,
  /verify\s*you\s*are\s*human/i,
  /cloudflare\s*challenge/i,
  /too\s*many\s*requests/i,
  /\b429\b/,
];

export function checkContentQuality(input: {
  title?: string;
  rawText: string;
  url?: string;
  existingHashes?: string[];
  contentHash?: string;
}): ContentQualityResult {
  const issues: QualityIssue[] = [];
  let score = 100;

  // Rule 1: too_short
  const textLength = input.rawText.trim().length;
  if (textLength < 200) {
    issues.push({
      type: 'too_short',
      message: `正文仅 ${textLength} 字，少于 200 字最低要求。`,
      severity: 'high',
    });
    score -= 40;
  }

  // Rule 2: no_title
  if (!input.title || input.title.trim().length < 2 || input.title === '未命名 RSS 条目' || input.title === '未命名网页') {
    issues.push({
      type: 'no_title',
      message: '缺少有效标题。',
      severity: 'medium',
    });
    score -= 20;
  }

  // Rule 3: duplicate
  if (input.contentHash && input.existingHashes?.includes(input.contentHash)) {
    issues.push({
      type: 'duplicate',
      message: '内容哈希与已有记录重复。',
      severity: 'medium',
    });
    score -= 30;
  }

  // Rule 4: blocked (anti-scrape / login page)
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(input.rawText) || (input.title && pattern.test(input.title))) {
      issues.push({
        type: 'blocked',
        message: '页面疑似反爬或需要登录。',
        severity: 'high',
      });
      score -= 50;
      break;
    }
  }

  // Rule 5: low_text_density (< 3 paragraphs of >= 20 chars)
  const paragraphs = input.rawText
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 20);
  if (paragraphs.length < 3) {
    issues.push({
      type: 'low_text_density',
      message: `有效段落仅 ${paragraphs.length} 个，少于 3 个。`,
      severity: 'low',
    });
    score -= 15;
  }

  // Rule 6: invalid_url
  if (input.url && !/^https?:\/\/.+/i.test(input.url.trim())) {
    issues.push({
      type: 'invalid_url',
      message: 'URL 格式无效。',
      severity: 'low',
    });
    score -= 10;
  }

  score = Math.max(0, Math.min(100, score));
  const passed = score >= 40 && !issues.some((i) => i.severity === 'high');

  return { passed, score, issues };
}

export function qualityLabel(result: ContentQualityResult): string {
  if (result.issues.some((i) => i.type === 'blocked')) return '疑似反爬';
  if (result.issues.some((i) => i.type === 'too_short')) return '内容过短';
  if (!result.passed) return '抓取失败';
  if (result.score < 60) return '需检查';
  return '高质量';
}

export function qualityColor(result: ContentQualityResult): string {
  if (result.issues.some((i) => i.type === 'blocked')) return 'rose';
  if (result.issues.some((i) => i.type === 'too_short')) return 'amber';
  if (!result.passed) return 'rose';
  if (result.score < 60) return 'amber';
  return 'emerald';
}
