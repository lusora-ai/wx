# Publish Package

## Phase 15: WeChat Run Reuse

- Publish packages remain dry-run artifacts and are still the input to WeChat automation.
- `inject-poc` uses the package title/HTML/private-domain CTA, fills the real WeChat editor, records a `runId`, and keeps the browser open for review.
- `save-poc` may reuse that `runId` so it saves the already-filled page instead of reopening and refilling a new editor.
- `PublishTask.packageJson.wechatPocRuns` records `runId`, `mode`, `injectionStrategy`, `titleFilled`, `contentInjected`, `saveClicked`, `draftSaved`, `keepBrowserOpen`, and `userConfirmed` when available.
- `draftSaved=true` is written only after a real WeChat save-success signal. `WECHAT_SAVE_RESULT_UNKNOWN` means the save button was clicked but the system could not confirm success.
- The package path still does not support mass publish, scheduled publish, batch publish, captcha bypass, official WeChat API calls, or image upload/generation.
- Three consecutive real `draftSaved=true` runs plus manual draft-box confirmation are required before the PoC can become a controlled draft-save feature.

# 发布包（PublishPackage）

## Phase 13: Publish Package Reuse And WeChat PoC

- 发布包仍是 dry-run package；它是微信 PoC 的输入，不代表自动发布。
- 已有成功 `PublishTask` 时，`POST /api/articles/:id/publish-package` 返回 `reused:true`，不重新生成包，也不重新走质量 gate。
- 质量 gate 只由 HIGH 风险阻断；MEDIUM 风险进入发布包 warnings/展示路径，但不阻断。
- 文章编辑后最新 `ArticleVersion.createdAt` 晚于最新 `ReviewLog.check.createdAt` 时，工作流进入 `quality_outdated`，必须重新质检。
- `inject-poc` 使用发布包的 title/html/private-domain CTA 填入微信编辑器，但不保存草稿。
- `save-poc` 使用同一发布包执行真实保存草稿 PoC，必须 `confirm:true`，并且只在检测到微信保存成功反馈后写入 `draftSaved:true`。
- `PublishTask.packageJson.wechatPocRuns` 保存最近 PoC 运行记录；前端按 probe、inject_poc、draft_save_poc 分别显示最近 3 次。
- 连续 3 次 `draft_save_poc` 成功后，才可把 PoC 升级为受控“保存到微信公众号草稿箱”；仍保留 Markdown/HTML 手动复制路径。

## Phase 12: WeChat automation PoC package usage

Publish packages remain dry-run packages. Phase 12 allows a selected package to be used by Playwright automation:

- `editor/probe` reads the package and checks whether the WeChat draft editor is reachable.
- `drafts/inject-poc` adapts package HTML, fills title/body, and does not save.
- `drafts/save-poc` requires `confirm: true` and can only report saved after a real save click and detected WeChat success feedback.
- `visualPlan` / `imagePromptSet` are reference material only; images are not uploaded to WeChat and no image-generation API is connected.
- PoC results are recorded in `PublishTask.packageJson.wechatPocRuns`.

## Phase 11: visualPlan / 段落配图方案

New publish packages include `visualPlan` when the system has successfully read the article and planned images. `imagePromptSet` remains as the low-level field for compatibility.

Required shape:

```json
{
  "visualPlan": {
    "source": "kimi_article_reading",
    "generatedBy": "kimi-2.6",
    "basedOnArticleVersion": 1,
    "stale": false,
    "visualStrategy": {
      "overallStyle": "string",
      "audienceFit": "string",
      "avoid": ["string"]
    }
  },
  "imagePromptSet": {
    "cover": { "slot": "cover", "label": "封面图", "suggestedRatio": "2.35:1" },
    "inlineImages": [
      { "slot": "section_1", "label": "正文配图 1", "relatedSectionTitle": "小节标题", "insertAfterParagraph": 3, "suggestedRatio": "16:9" },
      { "slot": "section_2", "label": "正文配图 2", "relatedSectionTitle": "小节标题", "insertAfterParagraph": 6, "suggestedRatio": "4:3" }
    ],
    "socialShare": { "slot": "social_share", "label": "社交传播卡", "suggestedRatio": "1:1" }
  }
}
```

Rules:

- Prompt count follows the article structure: cover + 2-4 paragraph-bound inline images + social share card.
- Prompts are Chinese text only and are meant to be copied into external image tools.
- The system does not call image-generation APIs and does not create image files.
- Every prompt includes subject, scene, mood, composition, color, and style guidance.
- Every prompt avoids text, watermark, logo, QR code, real celebrities, copyrighted IP, politics, pornography, and violence.
- Every inline prompt must include `relatedSectionTitle`, `insertAfterParagraph`, `purpose`, and `placementHint`.
- The negative prompt includes: `不要文字、不要水印、不要 logo、不要二维码、不要真实品牌标识、不要政治人物、不要名人肖像、不要低俗夸张表情、不要廉价网赚风、不要赛博朋克过度特效、不要血腥暴力、不要色情暗示。`
- Audience visual direction is different for office workers, students, and freelancers.

Kimi 2.6 reads the saved article first. DeepSeek v4 Pro is only a marked fallback for visual planning. If both providers fail, the package is created with `noVisualPlan=true`; local templates must not be presented as Kimi article-reading results. Old packages without `visualPlan` remain readable through legacy `imageSlots`.

## 概述

发布包是 dry-run 发布任务的完整输出，包含手动粘贴到微信公众号后台所需的全部素材。

## 内容

| 字段 | 说明 |
|------|------|
| `title` | 文章标题 |
| `summary` | 微信图文摘要 |
| `markdown` | Markdown 正文 |
| `html` | 公众号兼容 HTML（inline styles） |
| `visualPlan` | Phase 11 段落配图方案，记录来源、生成模型、文章版本、视觉策略和 warnings |
| `imagePromptSet` | 底层配图提示词集合：封面图、正文段落插图、社交传播卡 |
| `imagePromptCount` | 由文章结构决定，通常为 4-6；旧发布包可能少于 4 并通过 `imageSlots` 兼容 |
| `imageSlots` | 配图提示词列表（中文、英文、负面提示词、比例、风格、Alt 文案） |
| `tags` | 标签（分类 + 受众） |
| `cta` | 私域 CTA 文案 |
| `aiDisclosure` | 是否包含 AI 声明 |
| `sourceUrl` | 原文来源链接 |

## API

```
GET /api/publish/tasks/:id/package
```

返回：

```json
{
  "success": true,
  "data": {
    "title": "文章标题",
    "summary": "摘要",
    "markdown": "...",
    "html": "<article>...</article>",
    "imagePromptSet": {
      "cover": { "slot": "cover", "label": "封面图", "prompt": "..." },
      "inlineImages": [
        { "slot": "section_1", "label": "正文配图 1", "prompt": "..." },
        { "slot": "section_2", "label": "正文配图 2", "prompt": "..." },
        { "slot": "section_3", "label": "正文配图 3", "prompt": "..." }
      ],
      "socialShare": { "slot": "social_share", "label": "社交传播卡", "prompt": "..." }
    },
    "imagePromptCount": 5,
    "imageSlots": [
      {
        "slotKey": "img_1",
        "promptZh": "中文提示词",
        "promptEn": "English prompt",
        "negativePrompt": "负面提示词",
        "aspectRatio": "16:9",
        "stylePreset": "公众号科技资讯插图",
        "altText": "替代文案"
      }
    ],
    "tags": ["海外资讯", "打工人"],
    "cta": "关注小顺 AI 内容工作台。",
    "aiDisclosure": true,
    "sourceUrl": "https://example.com/article"
  }
}
```

## 前端交互

发布中心页面在左侧显示"发布包一键复制"面板，并新增“段落配图方案”区域：

1. **复制标题** — 复制文章标题
2. **复制摘要** — 复制微信图文摘要
3. **复制 Markdown** — 复制 Markdown 正文
4. **复制 HTML** — 复制公众号兼容 HTML
5. **一键复制段落配图** — 复制 `imagePromptSet` 中的封面图、正文段落插图和社交传播卡
6. **复制单条配图提示词** — 每条配图提示词都有独立复制按钮
7. **复制标签** — 复制分类和受众标签
8. **复制 CTA** — 复制私域 CTA 文案
9. **复制 AI 声明** — 复制 AI 辅助生成声明
10. **复制来源链接** — 复制原文 URL

另有下载按钮：

- **下载 HTML** — 下载 `.html` 文件
- **下载 Markdown** — 下载 `.md` 文件
- **下载 JSON** — 下载包含完整 `visualPlan` / `imagePromptSet` 的发布包 JSON

## 使用流程

1. 在 AI 写作工坊生成文章
2. 导入草稿库
3. 在草稿库审核通过
4. 前往发布中心，点击"创建 dry-run 草稿任务"
5. 在左侧"发布包一键复制"面板中，逐个复制所需素材
6. 打开微信公众号后台，粘贴到对应位置
## Phase 9：从 Article 直接生成发布包

新增接口：

```http
POST /api/articles/:id/publish-package
```

生成规则：
- Article 必须存在，正文不能为空。
- 必须存在最新 `ReviewLog.check`。
- 质量检查必须通过，并且风险项数量必须为 0。
- 成功后创建或更新 dry-run `PublishTask`，保存 Markdown 和 HTML。
- 返回 `publishTaskId`、`task`、`package` 和 `statusText`。

状态文案固定为：
- 发布包已生成
- dry-run 已记录
- 等待手动发布

边界：系统只生成发布包和 dry-run 记录，不创建真实微信公众号草稿，不保存任何微信草稿标识，不自动发布。
