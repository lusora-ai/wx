function stripTags(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(input: string) {
  return input
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function extractHtmlContent(html: string, url?: string) {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || url || '未命名网页');
  const description = decodeEntities(
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1]
      || '',
  );
  const paragraphs = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => decodeEntities(stripTags(match[1])))
    .filter((text) => text.length >= 20);
  const rawText = [description, ...paragraphs].filter(Boolean).join('\n\n').slice(0, 12000);

  return {
    title,
    description,
    rawText: rawText || stripTags(decodeEntities(html)).slice(0, 12000),
  };
}

export function extractXmlText(input = '') {
  return decodeEntities(stripTags(input.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')));
}
