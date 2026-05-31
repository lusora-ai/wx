# Dev Notes

## Phase 15 Notes

- Phase 15 stabilizes WeChat browser lifecycle and save PoC evidence. It is not a UI styling phase.
- `server/services/wechat/wechatRunManager.ts` owns the active Playwright browser/context/page and exposes non-sensitive run state.
- Successful `inject-poc` keeps the Chromium page open by default and marks the run as `waiting_user_review`.
- `save-poc` can reuse an injected `runId`; when `titleFilled=true` and `contentInjected=true` are already proven by the run, it does not reopen or refill the editor unless the page state is gone.
- New run APIs: `GET /api/wechat/runs/current` and `POST /api/wechat/runs/:runId/close`.
- New keep-alive env vars: `WECHAT_KEEP_BROWSER_OPEN_AFTER_INJECT`, `WECHAT_KEEP_BROWSER_OPEN_AFTER_SAVE`, `WECHAT_BROWSER_KEEP_ALIVE_MS`.
- Use `WECHAT_RUN_IN_PROGRESS` for concurrent inject/save attempts, `WECHAT_BROWSER_CLOSED` when the user closed Chromium, and `WECHAT_PAGE_LOST` when a run no longer matches the requested task.
- `WECHAT_SAVE_RESULT_UNKNOWN` is the correct result when save was clicked but no explicit WeChat success feedback was found. Do not convert it into `draftSaved=true`.
- Save success selectors remain in `server/services/wechat/wechatSelectors.ts`; add candidates there only, not in route/component code.
- The feature cannot be renamed from PoC to controlled draft save until 3 consecutive real `draftSaved=true` runs are manually verified in the WeChat draft box.

## Phase 14 Notes

- Active backend mainline: logged-in WeChat draft editor fill from an existing `PublishTask`. Do not spend Phase 14 work on UI style, layout, cards, or visual polish.
- Session validation uses saved Playwright storage plus a tokenized WeChat backend URL. API diagnostics redact the `token` query parameter and must never expose cookies or session contents.
- `openDraftPage` opens the tokenized `appmsg_edit` page after `session_valid`; failures should report `currentUrl`, `pageTitle`, `failedStep`, and selector evidence.
- Title resolution priority is package title, task title, article title, then Markdown H1. `titleFilled=true` requires reading the field back and matching the resolved title.
- Body HTML resolution priority is stored package HTML, task HTML, package Markdown converted to HTML, then article Markdown converted to HTML.
- `server/services/wechat/wechatHtmlAdapter.ts` is the only WeChat HTML sanitizer/adapter. It strips unsafe tags/attributes, appends private-domain CTA, and does not insert or upload paragraph images.
- `server/services/wechat/wechatSelectors.ts` owns all selector candidates: QR code, account home, new draft entry, title input, editor, save button, save success, and captcha/risk.
- `contentInjected=true` requires detected editor text after injection. The strategy order is DOM HTML, clipboard HTML, then plain-text fallback with warning.
- `inject-poc` never saves and intentionally leaves the browser open for human inspection.
- `save-poc` requires `confirm:true`, repeats title/content injection, clicks save only after detection gates pass, and returns `draftSaved=true` only after a real WeChat success signal. Unknown save state is `WECHAT_SAVE_RESULT_UNKNOWN`.
- Phase 14 local verification target is 3 consecutive successful `editor/probe` runs and 3 consecutive successful `inject-poc` runs. Three `save-poc` successes require explicit user permission and manual confirmation in the WeChat drafts box.

## Phase 13 Notes

- Do not return to UI polish loops. The active mainline is real WeChat draft PoC verification.
- Quality rule source of truth: `server/services/articleQuality.ts` passes when `highCount === 0`; `server/services/articleWorkflowStatus.ts` must match this and only block HIGH risks.
- `MEDIUM` risks do not block package creation. They should be visible to the user.
- `quality_outdated` is based on latest `ArticleVersion.createdAt > latest ReviewLog.check.createdAt`.
- Existing successful publish packages are reused with `reused:true`; `PublishCenterView` must show “使用当前发布包” for selected existing tasks.
- WeChat env is intentionally opt-in: default disabled, local verification enabled by setting `WECHAT_AUTOMATION_ENABLED=true` and restarting the backend.
- Playwright session path is `.local/wechat-session.json`; never log or return session data.
- Selector changes must be made in `server/services/wechat/wechatSelectors.ts`, with multiple candidates per target.
- `inject-poc` strategy order is direct HTML injection -> clipboard paste -> plain-text fallback with warning. It must not save.
- `save-poc` requires backend `confirm=true` and frontend second confirmation; never treat inject success as save success.
- Keep PoC records in `PublishTask.packageJson.wechatPocRuns` unless this outgrows the package payload; no new DB table is required yet.
- Upgrade from PoC to controlled draft save only after 3 consecutive real `draftSaved=true` runs on the same public account.

## Phase 11 Pipeline Notes

- `server/services/articleGenerationPipeline.ts` is the single article generation pipeline: Topic -> DeepSeek article -> saved Article/ArticleVersion -> Kimi visual plan attempt.
- `server/services/articleImagePlanner.ts` makes Kimi read the saved Markdown and produce `visualPlan.imagePromptSet`.
- Frontend article generation no longer sends `model`, `writerModel`, or `imageModel`.
- `Article.visualPlanJson` stores the latest plan with `basedOnArticleVersion`; when `Article.currentVersion` changes, the plan is stale.
- `POST /api/articles/:id/visual-plan` manually regenerates the paragraph image plan.
- `POST /api/articles/:id/publish-package` reuses the current-version plan or attempts to generate one. If Kimi and fallback fail, package creation continues with `noVisualPlan=true`.
- Local template fallback must not be presented as a Kimi article-reading result.

## Phase 10 Automation Notes

- `server/services/publishPackage.ts` persists `visualPlan` and `imagePromptSet` on new `PublishTask.packageJson` payloads.
- Prompt count follows the article sections: cover + 2-4 inline paragraph images + social share card.
- Kimi 2.6 reads the article first; DeepSeek v4 Pro fallback is marked as `deepseek-v4-pro-fallback`.
- WeChat PoC code lives under `server/services/wechat/*` and `server/routes/wechat.ts`.
- Default config keeps automation disabled: `WECHAT_AUTOMATION_ENABLED=false`.
- Session path defaults to `.local/wechat-session.json`; `.local/` and `wechat-session*.json` are gitignored.
- Install browser binaries manually only when testing the PoC: `npx playwright install chromium`.
- Current `/api/wechat/drafts/poc` mode is `poc_check`: session/editor/HTML evidence only, no content injection and no real draft save.

## Phase 12 WeChat PoC Notes

- Phase 12 gates: Playwright/Chromium, QR login/session save, session reuse, editor probe/inject test, second-confirmation save PoC.
- `server/services/wechat/wechatSession.ts` distinguishes `playwright_missing`, `chromium_missing`, `need_login`, `editor_reachable`, and `last_run_failed`.
- `server/services/wechat/wechatSelectors.ts` centralizes selector candidates for title input, editor, save button, QR code, account home, and captcha/risk signals.
- `POST /api/wechat/drafts/inject-poc` injects content but does not save. It leaves the browser open for visual inspection when injection succeeds.
- `POST /api/wechat/drafts/save-poc` requires `confirm: true` and only returns `draftSaved=true` after a real save click and a detected success signal.
- PoC run records are stored on `PublishTask.packageJson.wechatPocRuns`; this avoids adding a table during PoC.
- HTML adapter checks are available with `npm run wechat:html:test`.
- No cookie or session content is logged or returned to the frontend.

## 启动

```bash
npm install
npm run db:push
npm run dev
```

前端默认 `http://localhost:3100/`，API 默认 `http://localhost:8787`。

## 环境变量

复制 `.env.example` 为 `.env`，只在服务端配置模型密钥。`.env` 被 `.gitignore` 忽略，不要提交。

当前支持：

- `LLM_PROVIDER=deepseek`
- `LLM_PROVIDER=kimi`

产品内固定使用 DeepSeek v4 Pro 与 Kimi 2.6。两者均通过服务端 `/chat/completions` 兼容接口调用，密钥不进入前端 bundle。

## 数据库

开发环境使用 SQLite，数据库文件默认在 `prisma/dev.db`。`npm run db:push` 使用幂等初始化脚本并生成 Prisma Client。

Prisma schema 保留为 ORM 契约；SQLite 不支持 Prisma Json 字段，因此数组/对象以 JSON 字符串存储，API 层负责 parse/stringify。

Prisma 7 在 Windows 下使用 `prisma/push.ts` 创建/补齐表结构，再调用 Prisma Client generate，避免依赖本机 schema engine 行为差异。

## 发布

发布中心只创建 dry-run 任务，保存 Markdown 和公众号兼容 HTML，支持复制和下载，不请求微信接口。

`GET /api/publish/tasks/:id/package` 返回完整发布包（标题、摘要、Markdown、HTML、`visualPlan`、`imagePromptSet`、旧 `imageSlots`、标签、CTA、AI 声明、来源链接）。前端支持单条/全部段落配图提示词复制，并可下载包含完整 `visualPlan` 的发布包 JSON。

## 质量检查

`POST /api/articles/:id/quality-check` 或 `POST /api/reviews/check` 对文章执行 10 项质量检查。规则定义在 `server/services/articleQuality.ts`，包括：too_short、too_long、missing_title、missing_subheadings、missing_cta、ai_tone、forbidden_jargon、unverified_claim、image_slot_mismatch、html_risk。返回 passed（是否通过）、score（0-100）、issues（问题列表）。

## AI 烟雾测试

`npm run ai:smoke` 执行轻量级 AI 端到端烟雾测试，验证 DeepSeek/Kimi 的真实连通性。测试链路：创建 RSS 源 → 抓取 → 生成选题 → 生成文章 → 质量检查 → HTML 导出。需在 `.env` 中配置真实 API Key。

## 单篇生成

`POST /api/articles/generate` 只生成一个受众版本。请求包含 `topicId`、`audience`、`tone` 和 `targetLength`，不接收前端模型选择。服务端固定用 DeepSeek v4 Pro 生成正文，再让 Kimi 2.6 阅读正文生成 `visualPlan`。

## RSS/URL 抓取

v1.1 基础能力支持 RSS 和 URL 抓取，结果保存到 `SourceItem`。不做登录态抓取，不做绕反爬。内容源删除为软删除：`Source.status = archived`，历史文章不受影响。

## 内容质量

抓取时自动执行质量评分，结果保存在 `SourceItem.qualityScore` 和 `SourceItem.qualityIssues`。详见 [FETCHING.md](FETCHING.md)。

## AI 健康检查

`GET /api/ai/health` 获取缓存结果，`POST /api/ai/health/check` 执行实时检查。不暴露 API Key，不返回完整堆栈。

## FetchTask

抓取任务支持轻量任务记录。`POST /api/fetch-tasks/source/:sourceId` 同步执行单源抓取，`POST /api/fetch-tasks/all` 同步执行全部活跃源抓取。任务状态通过 `GET /api/fetch-tasks` 查看。

## 每日工作流

`GET /api/daily/summary` 返回今日摘要（抓取数、待写选题、今日文章、已发布等）。`POST /api/daily/fetch-today` 一键抓取全部活跃源，返回每个源的抓取结果。

## 内容源预设

`GET /api/source-presets` 返回常用预设列表（含是否已添加标记）。`POST /api/source-presets/:presetId/add` 从预设添加内容源。预设定义在 `server/services/fetch/sourcePresets.ts`。

## 选题去重

SourceItem 生成选题时，如果已存在 `status=topic_generated` 且有关联 Topic（通过 `sourceItemId`），会返回错误提示，防止重复生成。

## 测试

```bash
npm run lint
npm run build
npm run test:e2e          # mock AI 模式
TEST_USE_AI=true npm run test:e2e  # 真实 AI 模式
```

## Phase 8 任务工作台

`server/services/contentTaskService.ts` 基于现有表生成计算型任务视图，不新增数据库表。`GET /api/tasks/today` 用于首页 Dashboard。

核心规则：
- Source 今日未抓取或最近失败 -> `FETCH_SOURCE`
- SourceItem 质量分达到 60 且未关联 Topic -> `CREATE_TOPIC`
- SourceItem 质量分 40-59 -> `REVIEW_SOURCE_ITEM`
- Topic 必须绑定 `sourceItemId`，且没有 Article -> `GENERATE_ARTICLE`
- Article 没有质量检查 -> `QUALITY_CHECK`
- Article 最新质量检查未通过 -> `EDIT_ARTICLE`
- Article 通过质检且没有 PublishTask -> `CREATE_PACKAGE`
- PublishTask dry-run 成功 -> `READY_TO_MANUAL_PUBLISH`

发布中心文案必须保持 dry-run 边界：发布包已生成、dry-run 已记录、等待手动发布。
## Phase 9 Workflow Notes

- `server/services/articleWorkflowStatus.ts` is the single helper for article production state. Dashboard tasks and Article workflow API should use the same rules.
- `GET /api/articles/:id/workflow-status` computes stage from `Article`, latest `ArticleVersion`, latest `ReviewLog.check`, and latest `PublishTask`.
- `POST /api/articles/:id/publish-package` uses `server/services/publishPackage.ts` and blocks package creation unless quality is checked, passed, and has zero risks.
- Dashboard task navigation uses in-memory selected IDs in `App.tsx`; only the active tab remains a UI preference in localStorage.
- Kimi 2.6 is not a writer. Kimi calls use `KIMI_TIMEOUT_MS` for article-reading visual plans; timeout fallback must be marked in `visualPlan.source` and `warnings`.
- Keep publish copy dry-run only. Do not add real WeChat publish, image generation API, login, multi-user permissions, SaaS flows, or product models beyond DeepSeek v4 Pro and Kimi 2.6.
