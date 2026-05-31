import { ApiError } from '../../types/api';
import { extractXmlText } from './contentExtractor';

export type RssFetchItem = {
  title: string;
  url?: string;
  rawText: string;
  summary?: string;
  publishedAt?: Date;
};

function tagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? extractXmlText(match[1]).trim() : '';
}

export async function fetchRssItems(url: string): Promise<RssFetchItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'XiaoshunAIContentWorkbench/1.1',
        accept: 'application/rss+xml,application/xml,text/xml',
      },
    });
    if (!response.ok) {
      throw new ApiError('SOURCE_FETCH_FAILED', `RSS 抓取失败：${response.status}`, 502);
    }
    const xml = await response.text();
    const blocks = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/gi)).map((match) => match[0]);
    return blocks.slice(0, 10).map((block) => {
      const title = tagValue(block, 'title') || '未命名 RSS 条目';
      const urlMatch = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      const link = tagValue(block, 'link') || urlMatch?.[1];
      const summary = tagValue(block, 'content:encoded') || tagValue(block, 'description') || tagValue(block, 'summary') || tagValue(block, 'content');
      const dateText = tagValue(block, 'pubDate') || tagValue(block, 'published') || tagValue(block, 'updated');
      const publishedAt = dateText && !Number.isNaN(Date.parse(dateText)) ? new Date(dateText) : undefined;
      return {
        title,
        url: link || undefined,
        rawText: `${title}\n\n${summary}`.trim(),
        summary: summary.slice(0, 500) || undefined,
        publishedAt,
      };
    }).filter((item) => item.rawText.length >= 10);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('SOURCE_FETCH_FAILED', 'RSS 抓取超时或网络失败。', 502);
  } finally {
    clearTimeout(timeout);
  }
}
