# 抓取系统说明

## RSS 抓取范围

- 解析标准 RSS 2.0 和 Atom 格式的 `<item>` / `<entry>` 标签。
- 提取 title、link、description/content、pubDate/published。
- 最多抓取每个 RSS 源的前 10 条条目。
- 20 秒超时，超时返回 `SOURCE_FETCH_FAILED`。

## URL 抓取范围

- 抓取 HTML 页面，提取 `<title>`、`<meta description>`、`<p>` 段落。
- 正文最多保留 12000 字符。
- 20 秒超时，超时返回 `SOURCE_FETCH_FAILED`。

## 不做的事情

- 不做登录态抓取。
- 不绕反爬机制。
- 不处理 JavaScript 渲染页面。
- 不做复杂反爬或代理池。

## SourceItem 状态

| 状态 | 含义 |
|------|------|
| `pending` | 新抓取，待处理 |
| `topic_generated` | 已从此内容生成选题 |
| `archived` | 已归档，默认不显示 |

## 内容质量规则

抓取时自动执行质量评分（`checkContentQuality`），结果保存在 `SourceItem.qualityScore` 和 `SourceItem.qualityIssues`。

| 规则 | 类型 | 严重度 | 扣分 | 说明 |
|------|------|--------|------|------|
| 内容过短 | `too_short` | high | -40 | rawText 少于 200 字 |
| 缺少标题 | `no_title` | medium | -20 | 标题为空或默认值 |
| 内容重复 | `duplicate` | medium | -30 | contentHash 与已有记录重复 |
| 疑似反爬 | `blocked` | high | -50 | 包含 "Access Denied"、"403"、"登录后查看" 等 |
| 低文本密度 | `low_text_density` | low | -15 | 有效段落少于 3 个 |
| URL 无效 | `invalid_url` | low | -10 | URL 格式不合法 |

总分 100，低于 40 分或存在 high 级别问题时 `passed = false`。

前端标签：

- 高质量：score >= 60 且无 high 级别问题
- 需检查：40 <= score < 60
- 抓取失败：score < 40 或有 high 级别问题
- 疑似反爬：存在 blocked 问题
- 内容过短：存在 too_short 问题

## FetchTask 任务状态

| 状态 | 含义 |
|------|------|
| `pending` | 等待执行 |
| `running` | 正在执行 |
| `success` | 执行完成 |
| `failed` | 执行失败 |

任务类型：

- `single_source`：抓取单个源。
- `all_active_sources`：抓取全部活跃源。

## 常见失败原因

1. RSS/URL 返回非 200 状态码。
2. 网络超时（20 秒内未响应）。
3. 页面需要登录或被反爬拦截。
4. 内容过短（少于 200 字）。
5. 内容与已有记录重复。

## 手动测试抓取

```bash
# 启动服务
npm run dev

# 通过 API 测试
# 新增 RSS 源
curl -X POST http://localhost:8787/api/sources \
  -H "content-type: application/json" \
  -d '{"type":"rss","name":"Test RSS","url":"https://example.com/feed.xml"}'

# 抓取单个源
curl -X POST http://localhost:8787/api/sources/{id}/fetch

# 创建抓取任务
curl -X POST http://localhost:8787/api/fetch-tasks/source/{id}

# 查看任务列表
curl http://localhost:8787/api/fetch-tasks
```
