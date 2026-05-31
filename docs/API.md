# API

## Phase 16 Mainline Automation API

- `POST /api/automation/run` manually runs one PRD-bounded production pipeline: collect active content sources, select one qualified `SourceItem`, generate/reuse one `Topic`, generate/reuse one `Article`, run `ReviewLog.check`, create/reuse a dry-run `PublishTask`, and optionally call WeChat `inject-poc`.
- Request body accepts `sourceId`, `sourceItemId`, `topicId`, or `articleId` to start from a specific point; otherwise the pipeline fetches active local sources and selects the highest quality unused candidate.
- `audience` defaults to `officeWorker`; the pipeline generates at most one article per run.
- `fillWechat:true` only fills the WeChat editor through `POST /api/wechat/drafts/inject-poc`. It never calls `save-poc`, never saves a draft, never mass publishes, and never schedules publishing.
- HIGH quality risks block package creation and WeChat fill. MEDIUM/LOW risks are returned in `quality.issues` but do not block.
- Response includes ordered `steps`, `sourceItemId`, `topicId`, `articleId`, `publishTaskId`, optional `wechatRunId`, and a `boundary` object proving no save/publish/image generation/official WeChat API was attempted.

## Phase 15 WeChat Run API Rules

- `POST /api/wechat/drafts/inject-poc` now returns `runId` and diagnostics containing `keepBrowserOpen` and `keepAliveUntil`. On success the active run status is `waiting_user_review`.
- `POST /api/wechat/drafts/save-poc` accepts `{ "publishTaskId": "task_id", "confirm": true, "runId": "optional_run_id" }`. A matching injected run is reused instead of reopening a new editor page.
- `GET /api/wechat/runs/current` returns the active non-sensitive run state or `null`.
- `POST /api/wechat/runs/:runId/close` explicitly closes the active browser run.
- Concurrent inject/save flows are rejected with `WECHAT_RUN_IN_PROGRESS`; this prevents multiple WeChat editor pages from overwriting each other.
- New/used error codes: `WECHAT_RUN_IN_PROGRESS`, `WECHAT_BROWSER_CLOSED`, `WECHAT_PAGE_LOST`, and `WECHAT_SAVE_RESULT_UNKNOWN`.
- `WECHAT_SAVE_RESULT_UNKNOWN` means save was clicked but no clear WeChat success signal was detected. It must be shown as uncertain, not as a saved draft.
- `draftSaved=true` requires a real save-success signal from WeChat. If no readable `draftId` exists, `draftId` remains `null`.
- Browser keep-alive is controlled by `WECHAT_KEEP_BROWSER_OPEN_AFTER_INJECT`, `WECHAT_KEEP_BROWSER_OPEN_AFTER_SAVE`, and `WECHAT_BROWSER_KEEP_ALIVE_MS`.

## Phase 14 WeChat Draft Fill API Rules

- `POST /api/wechat/session/validate` uses the saved Playwright session to open the real WeChat backend. It returns `session_valid`, `session_expired`, or `WECHAT_LOGIN_REQUIRED` style evidence without cookies, session storage, or raw token values.
- `POST /api/wechat/editor/probe` accepts `{ "publishTaskId": "task_id" }`, loads the real `PublishTask` package, validates session, opens the WeChat draft editor, and returns `evidence`, `selectorReport`, redacted `currentUrl`, `pageTitle`, and `failedStep`. It does not fill content or save.
- `POST /api/wechat/drafts/inject-poc` accepts `{ "publishTaskId": "task_id" }`. It fills the resolved title, verifies the title value, injects WeChat-adapted HTML, verifies editor text length, leaves the browser open, and returns `draftSaved:false`.
- `inject-poc` evidence includes `titleFilled`, `htmlPrepared`, `contentInjected`, `injectionStrategy`, and diagnostics such as `htmlLength`, `textLength`, and `editorTextLengthAfterInject`.
- `injectionStrategy` is one of `dom_html`, `clipboard_html`, `text_fallback`, or `null`. `text_fallback` must include a warning.
- `POST /api/wechat/drafts/save-poc` accepts `{ "publishTaskId": "task_id", "confirm": true }`. `confirm !== true` returns `WECHAT_CONFIRM_REQUIRED`. A save run must validate session, fill title, inject content, find the save button, click save, and detect a real WeChat success signal before returning `draftSaved:true`.
- New/used WeChat PoC error codes include `WECHAT_TITLE_FILL_FAILED` and `WECHAT_SAVE_RESULT_UNKNOWN`.
- Recent PoC runs stored in `PublishTask.packageJson.wechatPocRuns` now include `title` and `injectionStrategy` when available.

## Phase 13 Mainline API Rules

- `GET /api/articles/:id/workflow-status` uses the Claude-fixed quality rule: HIGH risks block publishing; MEDIUM risks do not block but remain visible; no `ReviewLog.check` means `needs_quality_check`; saved edits after the latest check mean `quality_outdated`.
- `POST /api/articles/:id/publish-package` returns `reused:true` when a successful current package already exists. The returned `publishTaskId` can be used directly by the WeChat PoC APIs.
- `GET /api/wechat/status` must return `disabled` when `WECHAT_AUTOMATION_ENABLED=false`, and `need_login` when enabled with no `.local/wechat-session.json`.
- `POST /api/wechat/login/start` opens headed Chromium and returns login evidence: `browserLaunched`, `loginPageOpened`, `qrVisible`, `loginDetected`, `sessionSaved`.
- `POST /api/wechat/session/validate` performs real backend navigation with stored session and returns non-sensitive evidence only.
- `POST /api/wechat/editor/probe` returns selector evidence plus `selectorReport`; selector candidates are centralized in `server/services/wechat/wechatSelectors.ts`.
- `POST /api/wechat/drafts/inject-poc` injects content but never saves.
- `POST /api/wechat/drafts/save-poc` refuses unless `{ "confirm": true }` and only returns `draftSaved:true` after a real WeChat save-success signal.
- WeChat PoC run records are persisted in `PublishTask.packageJson.wechatPocRuns` with `runId`, `publishTaskId`, `mode`, `success`, `errorCode`, `evidence`, `message`, and `ranAt`.

## Phase 11 Article Pipeline API

`POST /api/articles/generate` is the single article generation entry. It does not accept frontend model selection. Backend flow: DeepSeek v4 Pro generates Markdown, saves `Article` / `ArticleVersion`, then Kimi 2.6 reads the saved article and attempts to generate `visualPlan`.

`POST /api/articles/:id/visual-plan` reads the latest article Markdown and generates a paragraph image plan. Inline image prompts must include `relatedSectionTitle`, `insertAfterParagraph`, `purpose`, and `placementHint`.

If Kimi times out, DeepSeek v4 Pro fallback is marked as `source: "fallback_after_kimi_timeout"` and `generatedBy: "deepseek-v4-pro-fallback"`. If both fail, `visualPlan` is `null`; local templates must not be treated as article-reading results.

## Phase 11 Publish Package API

`GET /api/publish/tasks/:id/package` returns the persisted package payload when available. New packages include `visualPlan` and `imagePromptSet` when visual planning succeeded; `imagePromptCount` follows article sections instead of being fixed at 5.

`POST /api/articles/:id/publish-package` creates a dry-run `PublishTask`, stores the package JSON on the task, and returns `packageSummary.imagePromptCount`. It still requires the latest quality check to pass with zero risks. If there is no current-version `visualPlan`, the API attempts to generate one. If visual planning fails, package creation continues with `noVisualPlan=true`.

The fixed negative prompt includes: `不要文字、不要水印、不要 logo、不要二维码、不要真实品牌标识、不要政治人物、不要名人肖像、不要低俗夸张表情、不要廉价网赚风、不要赛博朋克过度特效、不要血腥暴力、不要色情暗示。`

## Phase 12 WeChat Automation PoC API

`GET /api/wechat/status` returns only non-sensitive state: `disabled`, `not_configured`, `playwright_missing`, `chromium_missing`, `need_login`, `session_valid`, `session_expired`, `captcha_required`, `editor_unknown`, `editor_reachable`, `poc_ready`, or `last_run_failed`. It also returns non-sensitive capabilities for Playwright, Chromium, and whether the session file exists.

`POST /api/wechat/login/start` starts headed Chromium when `WECHAT_AUTOMATION_ENABLED=true`, opens `https://mp.weixin.qq.com/`, waits for manual QR login, and saves session only after a tokenized WeChat backend URL is detected. On timeout it returns `WECHAT_LOGIN_TIMEOUT` and does not save session.

`POST /api/wechat/drafts/poc` accepts `{ "publishTaskId": "task_id" }` and returns `mode: "poc_check"` plus evidence flags: `sessionChecked`, `editorReached`, `htmlPrepared`, `contentInjected`, and `draftSaved`. Current PoC mode verifies reachability and prepared HTML only; it does not inject content or save a real draft.

`POST /api/wechat/session/validate` validates the stored session by opening the WeChat backend home page.

`POST /api/wechat/editor/probe` accepts `{ "publishTaskId": "task_id" }`, opens the draft editor, and reports selector reachability without injecting content.

`POST /api/wechat/drafts/inject-poc` accepts `{ "publishTaskId": "task_id" }`, fills title and HTML, leaves the page open, and never saves a draft.

`POST /api/wechat/drafts/save-poc` accepts `{ "publishTaskId": "task_id", "confirm": true }`. It refuses missing confirmation. It can say draft save succeeded only after a real save click and a WeChat success signal.

Wechat PoC error codes: `WECHAT_DISABLED`, `WECHAT_PLAYWRIGHT_NOT_INSTALLED`, `WECHAT_CHROMIUM_NOT_INSTALLED`, `WECHAT_LOGIN_REQUIRED`, `WECHAT_LOGIN_TIMEOUT`, `WECHAT_SESSION_EXPIRED`, `WECHAT_PAGE_LOAD_TIMEOUT`, `WECHAT_EDITOR_NOT_FOUND`, `WECHAT_RUN_IN_PROGRESS`, `WECHAT_BROWSER_CLOSED`, `WECHAT_PAGE_LOST`, `WECHAT_TITLE_FILL_FAILED`, `WECHAT_INJECT_FAILED`, `WECHAT_SAVE_FAILED`, `WECHAT_SAVE_RESULT_UNKNOWN`, `WECHAT_CAPTCHA_DETECTED`, `WECHAT_ACCOUNT_RISK`, `WECHAT_CONFIRM_REQUIRED`, `WECHAT_UNKNOWN_ERROR`.

统一响应：

```json
{ "success": true, "data": {} }
```

```json
{ "success": false, "errorCode": "VALIDATION_ERROR", "message": "错误说明" }
```

主要接口：

- `GET /api/dashboard/summary`
- `POST /api/sources`
- `GET /api/sources`
- `PATCH /api/sources/:id`
- `DELETE /api/sources/:id`
- `POST /api/sources/:id/check`
- `POST /api/sources/:id/fetch`
- `POST /api/sources/fetch-all`
- `GET /api/source-items`
- `GET /api/source-items/:id`
- `PATCH /api/source-items/:id`
- `POST /api/source-items/:id/archive`
- `POST /api/source-items/:id/restore`
- `POST /api/source-items/:id/generate-topic`
- `POST /api/topics/generate`
- `GET /api/topics`
- `POST /api/topics/:id/push`
- `POST /api/topics/:id/archive`
- `POST /api/articles/generate`
- `POST /api/articles/:id/visual-plan`
- `GET /api/articles`
- `PATCH /api/articles/:id`
- `POST /api/articles/:id/export-html`
- `GET /api/articles/:articleId/image-slots`
- `POST /api/articles/:articleId/image-slots/generate`
- `PATCH /api/image-slots/:slotId`
- `POST /api/image-slots/:slotId/regenerate-prompt`
- `POST /api/image-slots/:slotId/skip`
- `POST /api/reviews/check`
- `POST /api/reviews/:articleId/approve`
- `POST /api/reviews/:articleId/reject`
- `POST /api/publish/tasks`
- `GET /api/publish/tasks`
- `GET /api/publish/tasks/:id/package`
- `POST /api/articles/:id/publish-package`
- `GET /api/wechat/status`
- `POST /api/wechat/login/start`
- `POST /api/wechat/drafts/poc`
- `POST /api/wechat/session/validate`
- `POST /api/wechat/editor/probe`
- `POST /api/wechat/drafts/inject-poc`
- `POST /api/wechat/drafts/save-poc`
- `GET /api/wechat/runs/current`
- `POST /api/wechat/runs/:runId/close`
- `GET /api/settings`
- `PATCH /api/settings`
- `GET /api/ai/health`
- `POST /api/ai/health/check`
- `GET /api/fetch-tasks`
- `GET /api/fetch-tasks/:id`
- `POST /api/fetch-tasks/source/:sourceId`
- `POST /api/fetch-tasks/all`
- `POST /api/automation/run`

`POST /api/publish/wechat/playwright` 是旧占位接口，保留为兼容并固定返回 `NOT_IMPLEMENTED`。Phase 10 的微信自动化 PoC 使用 `/api/wechat/*`，默认仍只做 `poc_check`，不保存真实微信草稿。

配图提示词接口只管理 marker 与提示词，不接收图片上传，不返回图片地址，不触发图片生成。

## 文章生成

`POST /api/articles/generate` 为单篇生成接口，不再接收 `audiences` 批量数组，也不接收前端模型选择。

请求：

```json
{
  "topicId": "topic_id",
  "audience": "officeWorker",
  "targetLength": 900
}
```

返回：

```json
{
  "article": {},
  "imageSlots": [],
  "visualPlan": {},
  "visualPlanStatus": "generated",
  "visualPlanWarnings": [],
  "elapsedMs": 60000
}
```

正文生成由 DeepSeek v4 Pro 执行；正文保存后由 Kimi 2.6 读取文章并生成段落配图方案。

## RSS/URL 抓取

RSS/URL 抓取是 v1.1 基础能力。抓取结果保存为 `SourceItem`，内容源删除使用软删除，不级联删除历史文章。

### SourceItem 查询

`GET /api/source-items` 支持查询参数：

- `status`：按状态筛选（pending / topic_generated / archived）。不传时默认排除 archived。
- `sourceId`：按来源筛选。
- `keyword`：按标题或内容关键词搜索。

### SourceItem 操作

- `PATCH /api/source-items/:id`：更新标题、摘要、状态。
- `POST /api/source-items/:id/archive`：归档。归档不影响已生成文章。
- `POST /api/source-items/:id/restore`：从归档恢复为 pending。
- `POST /api/source-items/:id/generate-topic`：从 SourceItem 生成选题，成功后 status 变为 topic_generated。

### 内容质量

抓取时自动进行质量评分，结果保存在 `SourceItem.qualityScore` 和 `SourceItem.qualityIssues`。

## AI 健康检查

`GET /api/ai/health`：获取上次检查结果。

`POST /api/ai/health/check`：执行实时健康检查，测试 DeepSeek 和 Kimi 的 API 连通性。返回每个 provider 的状态、耗时和消息。不暴露 API Key。

## 发布包

`GET /api/publish/tasks/:id/package`：返回完整发布包，包含 title、summary、markdown、html、imageSlots、tags、cta、aiDisclosure、sourceUrl。用于前端一键复制/下载。

## 质量检查

`POST /api/reviews/check`：对文章执行 10 项质量检查（too_short、too_long、missing_title、missing_subheadings、missing_cta、ai_tone、forbidden_jargon、unverified_claim、image_slot_mismatch、html_risk）。返回 passed、score、issues。

## FetchTask

`POST /api/fetch-tasks/source/:sourceId`：为单个源创建抓取任务，同步执行后返回任务结果。

`POST /api/fetch-tasks/all`：为全部活跃源创建抓取任务，同步执行后返回任务结果。

`GET /api/fetch-tasks`：查询任务列表，支持 `sourceId` 参数筛选。

`GET /api/fetch-tasks/:id`：查询单个任务详情。

## Content Tasks

`GET /api/tasks/today`：返回今日内容生产任务工作台数据。

响应结构：

```json
{
  "stats": {
    "fetchedItemsToday": 0,
    "usableSourceItems": 0,
    "topicsToday": 0,
    "articlesToday": 0,
    "passedQualityArticles": 0,
    "publishPackagesToday": 0
  },
  "primaryTask": null,
  "tasks": []
}
```

任务由现有数据计算生成，不持久化。任务状态包括 `pending`、`blocked`、`done`；任务类型包括 `FETCH_SOURCE`、`REVIEW_SOURCE_ITEM`、`CREATE_TOPIC`、`GENERATE_ARTICLE`、`QUALITY_CHECK`、`EDIT_ARTICLE`、`CREATE_PACKAGE`、`READY_TO_MANUAL_PUBLISH`。
## Phase 9 Workflow API

`GET /api/articles/:id/workflow-status` returns the computed production state for one article:

```json
{
  "articleId": "article_id",
  "topicId": "topic_id",
  "sourceItemId": "source_item_id",
  "audience": "officeWorker",
  "title": "title",
  "stage": "needs_quality_check",
  "quality": {
    "checked": false,
    "passed": false,
    "score": null,
    "riskCount": 0,
    "risks": [],
    "latestReviewLogId": null,
    "checkedAt": null
  },
  "version": {
    "currentVersion": 1,
    "latestSavedAt": "2026-05-24T00:00:00.000Z",
    "manuallyEdited": false
  },
  "publish": {
    "hasPackage": false,
    "latestPublishTaskId": null,
    "status": null,
    "createdAt": null
  },
  "nextAction": {
    "type": "run_quality_check",
    "label": "运行质量检查",
    "reason": "文章还没有 ReviewLog.check 结果。"
  }
}
```

`stage` values: `draft`, `needs_quality_check`, `quality_failed`, `quality_passed`, `package_ready`, `waiting_manual_publish`.

`POST /api/articles/:id/publish-package` creates or updates a dry-run `PublishTask` directly from an Article. It requires a non-empty article and a latest `ReviewLog.check` that passes with zero risks. It returns `publishTaskId`, `task`, `package`, and `statusText`. It does not create a real WeChat draft, does not store any WeChat draft identifier, and does not perform automatic publishing.

`GET /api/tasks/today` tasks now include `actionPayload` so the frontend can navigate to the concrete Source, SourceItem, Topic, Article, or PublishTask.
