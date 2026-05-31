export interface SourcePreset {
  id: string;
  name: string;
  type: 'rss' | 'url';
  url: string;
  region: 'global' | 'domestic';
  language?: string;
  description: string;
}

export const sourcePresets: SourcePreset[] = [
  {
    id: 'hackernews',
    name: 'Hacker News',
    type: 'rss',
    url: 'https://hnrss.org/frontpage',
    region: 'global',
    language: 'en',
    description: 'Hacker News 首页热帖 RSS',
  },
  {
    id: 'github-trending',
    name: 'GitHub Trending',
    type: 'url',
    url: 'https://github.com/trending',
    region: 'global',
    language: 'en',
    description: 'GitHub 每日热门项目',
  },
  {
    id: 'producthunt',
    name: 'Product Hunt',
    type: 'rss',
    url: 'https://www.producthunt.com/feed',
    region: 'global',
    language: 'en',
    description: 'Product Hunt 每日新产品',
  },
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    type: 'rss',
    url: 'https://openai.com/blog/rss.xml',
    region: 'global',
    language: 'en',
    description: 'OpenAI 官方博客',
  },
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    type: 'rss',
    url: 'https://blog.google/technology/ai/rss/',
    region: 'global',
    language: 'en',
    description: 'Google AI 官方博客',
  },
  {
    id: 'anthropic-news',
    name: 'Anthropic News',
    type: 'rss',
    url: 'https://www.anthropic.com/rss.xml',
    region: 'global',
    language: 'en',
    description: 'Anthropic 官方新闻',
  },
  {
    id: 'jiqizhixin',
    name: '机器之心',
    type: 'rss',
    url: 'https://www.jiqizhixin.com/rss',
    region: 'domestic',
    language: 'zh',
    description: '机器之心 AI 资讯',
  },
  {
    id: 'qbitai',
    name: '量子位',
    type: 'rss',
    url: 'https://www.qbitai.com/feed',
    region: 'domestic',
    language: 'zh',
    description: '量子位 AI 资讯',
  },
];
