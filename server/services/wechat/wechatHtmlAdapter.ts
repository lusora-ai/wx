const ALLOWED_TAGS = new Set(['article', 'section', 'h1', 'h2', 'h3', 'p', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'br', 'hr', 'span']);

export type WechatHtmlAdapterResult = {
  html: string;
  textFallback: string;
  warnings: string[];
};

function stripUnsafeBlocks(html: string, warnings: string[]) {
  let next = html;
  const unsafePatterns = [
    { pattern: /<script[\s\S]*?<\/script>/gi, label: 'script' },
    { pattern: /<iframe[\s\S]*?<\/iframe>/gi, label: 'iframe' },
    { pattern: /<link[\s\S]*?>/gi, label: 'link' },
    { pattern: /<style[\s\S]*?<\/style>/gi, label: 'style' },
  ];
  for (const item of unsafePatterns) {
    if (item.pattern.test(next)) warnings.push(`已移除 ${item.label} 标签。`);
    next = next.replace(item.pattern, '');
  }
  return next;
}

function sanitizeTags(html: string, warnings: string[]) {
  return html.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (match, rawTag) => {
    const tag = String(rawTag).toLowerCase();
    const closing = match.startsWith('</');
    if (!ALLOWED_TAGS.has(tag)) {
      warnings.push(`已移除不兼容标签：${tag}`);
      return '';
    }
    if (closing) return `</${tag}>`;
    if (tag === 'h1') return '<h1 style="font-size:24px;line-height:1.35;font-weight:700;margin:0 0 18px;">';
    if (tag === 'h2') return '<h2 style="font-size:19px;line-height:1.45;font-weight:700;margin:28px 0 12px;">';
    if (tag === 'h3') return '<h3 style="font-size:17px;line-height:1.45;font-weight:700;margin:22px 0 10px;">';
    if (tag === 'p') return '<p style="font-size:15px;line-height:1.85;margin:0 0 14px;color:#1f2937;">';
    if (tag === 'blockquote') return '<blockquote style="border-left:4px solid #d1d5db;margin:16px 0;padding:8px 12px;color:#4b5563;background:#f9fafb;">';
    if (tag === 'pre') return '<pre style="white-space:pre-wrap;background:#f6f8fa;border-radius:8px;padding:12px;overflow:auto;">';
    if (tag === 'code') return '<code style="font-family:Menlo,Consolas,monospace;font-size:13px;">';
    if (tag === 'ul' || tag === 'ol') return `<${tag} style="margin:0 0 14px 20px;padding:0;">`;
    if (tag === 'li') return '<li style="font-size:15px;line-height:1.8;margin:4px 0;">';
    if (tag === 'strong' || tag === 'b') return '<strong style="font-weight:700;">';
    if (tag === 'br' || tag === 'hr') return `<${tag}>`;
    return `<${tag}>`;
  });
}

function stripHtmlToText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|h2|h3|li|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function adaptHtmlForWechat(input: { html: string; privateDomainCta?: string | null }): WechatHtmlAdapterResult {
  const warnings: string[] = [];
  let html = stripUnsafeBlocks(input.html || '', warnings);
  html = html.replace(/\son\w+="[^"]*"/gi, '').replace(/\son\w+='[^']*'/gi, '');
  html = sanitizeTags(html, warnings);

  if (input.privateDomainCta?.trim()) {
    html += `<p style="font-size:15px;line-height:1.85;margin:24px 0 0;color:#1f2937;"><strong style="font-weight:700;">${input.privateDomainCta.trim()}</strong></p>`;
  }

  return {
    html,
    textFallback: stripHtmlToText(html),
    warnings: Array.from(new Set(warnings)),
  };
}
