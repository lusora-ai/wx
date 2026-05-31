import { markdownToHtml, stripUnsafeHtml } from './markdown';

export type HtmlOptions = {
  cta?: string;
  aiDisclosureEnabled?: boolean;
  imageSlots?: { slotKey: string; status?: string }[];
};

export function markdownToWechatHtml(markdown: string, options: HtmlOptions = {}): string {
  const slotStatuses = new Map((options.imageSlots ?? []).map((slot) => [slot.slotKey, slot.status]));
  const body = markdownToHtml(markdown).replace(/<p>\{\{IMAGE_SLOT:(img_\d+)\}\}<\/p>|\{\{IMAGE_SLOT:(img_\d+)\}\}/g, (_match, blockKey, inlineKey) => {
    const slotKey = blockKey || inlineKey;
    if (slotStatuses.get(slotKey) === 'skipped') return '';
    return `<section style="border:1px dashed #d1d5db;padding:16px;border-radius:12px;color:#6b7280;margin:20px 0;">
  <p style="margin:0;font-weight:600;">此处建议配图：${slotKey}</p>
  <p style="margin:8px 0 0;">可根据小顺 AI 内容工作台中的配图提示词生成图片后手动插入。</p>
</section>`;
  });
  const cta = options.cta
    ? `<section style="margin:24px 0;padding:14px 16px;border-left:4px solid #0066cc;background:#f5f7fb;color:#1d1d1f;font-size:15px;line-height:1.8;">${options.cta}</section>`
    : '';
  const disclosure = options.aiDisclosureEnabled === false
    ? ''
    : '<p style="margin-top:28px;color:#86868b;font-size:12px;line-height:1.7;">本文由 AI 辅助生成，并经过人工审核编辑。</p>';

  return stripUnsafeHtml(`
<article style="max-width:680px;margin:0 auto;color:#1d1d1f;font-size:16px;line-height:1.85;">
  ${body}
  ${cta}
  ${disclosure}
</article>
  `.trim());
}
