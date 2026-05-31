import { ApiError } from '../../types/api';
import { extractHtmlContent } from './contentExtractor';

export async function fetchUrlContent(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'XiaoshunAIContentWorkbench/1.1',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) {
      throw new ApiError('SOURCE_FETCH_FAILED', `URL 抓取失败：${response.status}`, 502);
    }
    const html = await response.text();
    return extractHtmlContent(html, url);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('SOURCE_FETCH_FAILED', 'URL 抓取超时或网络失败。', 502);
  } finally {
    clearTimeout(timeout);
  }
}
