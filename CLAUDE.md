# CLAUDE.md

## Phase 15: WeChat draft automation stabilization

Codex added run-state management for the Playwright WeChat PoC. Claude should not rename the capability to a controlled draft-save feature until 3 real saves succeed.

- `inject-poc` returns `runId`, keeps the browser open by default, and marks the active run as `waiting_user_review`.
- `save-poc` accepts an optional `runId` and reuses the already-filled page when possible.
- Current run APIs are `GET /api/wechat/runs/current` and `POST /api/wechat/runs/:runId/close`.
- Keep-alive env vars are `WECHAT_KEEP_BROWSER_OPEN_AFTER_INJECT`, `WECHAT_KEEP_BROWSER_OPEN_AFTER_SAVE`, and `WECHAT_BROWSER_KEEP_ALIVE_MS`.
- `WECHAT_SAVE_RESULT_UNKNOWN` means save was clicked but no clear WeChat save-success feedback was detected. It must not be displayed as `draftSaved=true`.
- The browser should remain open after inject/save until explicit close, timeout, severe startup failure, or service shutdown.
- Still no mass publish, scheduled publish, batch publish, captcha bypass, official WeChat API, or silent background save.

## Phase 14: WeChat draft fill automation

Codex advanced the backend Playwright mainline after QR login. Claude should avoid UI style/layout work unless explicitly asked.

- The active flow is `session_valid` -> `editor/probe` -> `inject-poc` -> optional `save-poc`.
- `inject-poc` fills the resolved title and WeChat-adapted HTML into the real draft editor, verifies both, leaves the browser open, and must not save.
- Title priority is package title, publish task title, article title, then Markdown H1.
- HTML injection strategy is DOM HTML, clipboard HTML paste, then plain-text fallback with warning.
- `contentInjected=true` requires detected editor content after injection; do not display inferred success as real success.
- `save-poc` requires `confirm:true`, second confirmation, title/content injection, save-button detection, save click, and a real WeChat success signal before `draftSaved=true`.
- Selector candidates remain centralized in `server/services/wechat/wechatSelectors.ts`; do not scatter selectors into components.
- API diagnostics redact WeChat URL tokens and must never expose cookies or session contents.
- Phase 14 verification target is 3 consecutive probe successes and 3 consecutive inject successes; 3 save successes require explicit user approval and manual draft-box confirmation.

## Phase 13: WeChat real draft PoC mainline

Codex has advanced the PRD mainline to real WeChat draft PoC gates. Claude should not re-open button/card/style polish as the primary task.

- Quality rule is fixed: HIGH risks block packages; MEDIUM risks do not block but must remain visible.
- `workflow-status` must treat missing `ReviewLog.check` as `needs_quality_check`, and edited articles after review as `quality_outdated`.
- Existing successful publish packages must return `reused:true`; PublishCenter should keep “使用当前发布包” for selected existing tasks.
- WeChat automation remains opt-in through `WECHAT_AUTOMATION_ENABLED=true`; `false` must return `WECHAT_DISABLED`.
- AppID/AppSecret do not affect Playwright QR login.
- `server/services/wechat/wechatSelectors.ts` is the only selector candidate registry.
- `inject-poc` may fill title/body but must not save; fallback order is HTML -> clipboard -> plain text warning.
- `save-poc` requires `confirm:true` and second confirmation, and can only claim success after real WeChat save-success feedback.
- PoC run records live in `PublishTask.packageJson.wechatPocRuns`; UI shows last 3 probe, inject, and save runs.
- Do not upgrade to controlled “保存到微信公众号草稿箱” until 3 consecutive real `draftSaved=true` runs are manually verified in the WeChat drafts box.

## Phase 12: WeChat automation PoC real verification

Codex owns the Phase 12 physical execution layer. Claude should not redo generation pipeline, Dashboard, or visual-plan architecture work.

- WeChat automation remains disabled by default with `WECHAT_AUTOMATION_ENABLED=false`.
- New/updated endpoints: `GET /api/wechat/status`, `POST /api/wechat/login/start`, `POST /api/wechat/session/validate`, `POST /api/wechat/editor/probe`, `POST /api/wechat/drafts/inject-poc`, `POST /api/wechat/drafts/save-poc`.
- Selector candidates live in `server/services/wechat/wechatSelectors.ts`.
- Session files stay in `.local/wechat-session.json` by default and are never logged or returned.
- `inject-poc` may fill title/body but must not save.
- `save-poc` requires `confirm: true` and can only claim success after real save click plus detected WeChat success feedback.
- No batch publish, scheduled publish, captcha bypass, WeChat official API, or fake draft-save success.

## Phase 11: single-entry generation pipeline

Codex reset the model pipeline in Phase 11. Claude should avoid redoing pipeline architecture and focus only on small UI wording or bug polish when requested.

- Frontend article generation is single-entry and must not expose Kimi/DeepSeek writer selection.
- DeepSeek v4 Pro generates article Markdown. Kimi 2.6 reads the saved article and generates `visualPlan` / 段落配图方案.
- `Article.visualPlanJson` stores the latest plan with `basedOnArticleVersion`; edited articles may make the plan stale.
- `PublishTask.packageJson` persists `visualPlan`, `imagePromptSet`, and package payloads; old tasks stay compatible through `imageSlots`.
- Kimi timeout fallback must be clearly marked as `deepseek-v4-pro-fallback`. Do not present local templates as Kimi article-reading results.
- No Gemini, Claude, OpenAI, or image-generation APIs are product model options.
- WeChat automation PoC is added through Playwright and is disabled by default via `WECHAT_AUTOMATION_ENABLED=false`.
- New endpoints: `GET /api/wechat/status`, `POST /api/wechat/login/start`, `POST /api/wechat/drafts/poc`.
- Current PoC checks session/editor reachability and HTML preparation only. It must not be presented as real draft save or real publishing.

## Phase 8：每日内容生产任务工作台

已在 Phase 6 数据清理验收后进入主线推进。不要重复 Phase 6 清理验收任务。

本阶段把 Dashboard 改为“今日内容生产工作台”，新增计算型任务服务 `server/services/contentTaskService.ts` 和接口 `GET /api/tasks/today`。任务不持久化，不新增数据库表。

任务类型：`FETCH_SOURCE`、`REVIEW_SOURCE_ITEM`、`CREATE_TOPIC`、`GENERATE_ARTICLE`、`QUALITY_CHECK`、`EDIT_ARTICLE`、`CREATE_PACKAGE`、`READY_TO_MANUAL_PUBLISH`。

前端变化：
- Dashboard 展示今日生产进度、当前最该处理、待处理任务和真实空状态。
- SourceItem 候选池展示可处理状态。
- TopicWorkbench 作为选题队列，仅展示绑定 SourceItem 的真实选题。
- AiWorkshop 展示关联 Topic、SourceItem、质量检查状态和下一步建议。
- PublishCenter 文案保持 dry-run 边界：发布包已生成、dry-run 已记录、等待手动发布。

下一阶段建议：补充工作流状态 API，例如 `GET /api/articles/:id/workflow-status`，并把质量检查结果持久化摘要到文章视图中，减少前端临时状态依赖。

## 本轮 Claude/Mimo 工作范围（Phase 6）

本轮在 Phase 5 基础上，彻底清理数据库中的测试数据残留，增强清理脚本，新增永久删除能力，前端默认隐藏测试数据。

具体完成：
1. **清理数据库残留**：删除 13 个 E2E 测试源、7 个源条目、13 个选题、19 篇文章、12 个发布任务，共 119 条记录
2. **强化 db:clear-demo 脚本**：支持 [DEV]/[TEST]/[MOCK]/E2E/localhost/127.0.0.1/feeed.xml 多种测试数据模式，默认 dry-run 模式
3. **新增永久删除 API**：`DELETE /api/sources/:id/permanent`，级联删除关联的 SourceItem/Topic/Article/ArticleVersion/ArticleImageSlot/PublishTask/ReviewLog/FetchTask
4. **前端默认隐藏测试数据**：SourceCenterView/TopicWorkbenchView/PublishCenterView 默认过滤 [DEV]/[TEST]/[MOCK]/E2E 数据，提供"显示测试/开发数据"开关
5. **E2E 测试自动清理**：测试前后自动清理 [TEST] 数据，支持 `KEEP_E2E_DATA=true` 保留调试数据
6. **更新 README**：seed 改为可选步骤，新增永久删除和 E2E 自动清理说明

## 当前项目结构

```
wx/
├── src/                    # React 前端
│   ├── api/                # API 客户端
│   ├── components/         # UI 组件（苹果系风格）
│   ├── hooks/              # 数据获取 hooks
│   ├── types.ts            # 前端类型
│   └── App.tsx             # 主应用
├── server/                 # Express 后端
│   ├── routes/             # API 路由
│   ├── services/           # 业务逻辑
│   │   ├── ai/             # AI 调用（client, editor, writer）
│   │   ├── fetch/          # 抓取服务（rssFetcher, urlFetcher, contentExtractor, contentQuality）
│   │   ├── html.ts         # HTML 导出
│   │   ├── imageSlotPrompt.ts
│   │   └── logger.ts       # OperationLog
│   ├── types/api.ts        # 共享类型
│   └── index.ts            # 服务入口
├── prisma/
│   ├── schema.prisma       # 数据模型
│   ├── push.ts             # 幂等迁移脚本
│   └── seed.ts             # 开发种子数据
├── scripts/
│   ├── e2e-main-flow.ts    # E2E 测试
│   ├── ai-health-smoke.ts  # AI 烟雾测试
│   └── clear-demo-data.ts  # 清理 DEV/TEST/MOCK 数据
└── docs/                   # 文档
```

## 当前运行方式

```bash
npm install
npm run db:push
npm run dev
```

- 前端：http://localhost:3100/
- API：http://localhost:8787/

可选步骤：
```bash
npm run db:seed             # 写入 [DEV] 开发演示数据（可选）
npm run db:clear-demo       # 清理测试数据
npm run db:clear-demo:dry   # 预览清理（不实际删除）
```

测试：
```bash
npm run lint
npm run build
npm run test:e2e            # 自动清理测试数据
KEEP_E2E_DATA=true npm run test:e2e  # 保留测试数据用于调试
```

真实 AI 测试：
```bash
TEST_USE_AI=true npm run test:e2e
```

## 模型配置

- DeepSeek v4 Pro：内容源理解、事实提取、选题、审核辅助
- Kimi 2.6：阅读最终文章，生成段落配图方案和提示词
- API Key 只在 `.env` 配置，前端不接触 Key
- 两者通过 OpenAI 兼容 `/chat/completions` 接口调用

## 已完成能力

- **Source**：内容源 CRUD，软删除（archived），RSS/URL/手动三种类型，永久删除（级联删除关联数据）
- **SourceItem**：抓取结果管理，筛选、归档、恢复、生成选题，质量评分，今日推荐标签
- **Topic**：选题生成、推送、归档，sourceItemId 关联 SourceItem，前置检查
- **Article**：DeepSeek 单篇正文生成（90s 超时）、编辑保存版本、审核、HTML 导出
- **ArticleQuality**：10 项质量检查规则（too_short, too_long, missing_title, missing_subheadings, missing_cta, ai_tone, forbidden_jargon, unverified_claim, image_slot_mismatch, html_risk）
- **Article.visualPlanJson**：Kimi 阅读文章后的段落配图方案，按文章版本判断是否过期
- **PublishTask**：dry-run 发布任务
- **PublishPackage**：发布包聚合（标题/摘要/MD/HTML/`visualPlan`/`imagePromptSet`/旧 `imageSlots`/标签/CTA/AI声明/来源链接），支持单条/全部段落配图提示词复制和 JSON 下载
- **FetchTask**：轻量抓取任务记录
- **AI Health Check**：模型连通性检查
- **AI Smoke Test**：npm run ai:smoke 端到端烟雾测试
- **OperationLog**：操作日志
- **AppSetting**：系统设置
- **SourcePresets**：常用内容源预设（8 个）
- **Daily API**：每日摘要 + 一键抓取
- **Demo 清理**：npm run db:clear-demo 清理 DEV/TEST/MOCK/E2E/localhost 测试数据
- **测试数据隔离**：前端默认隐藏测试数据，E2E 测试自动清理

## 本轮新增能力（Phase 2）

1. **Topic.sourceItemId**：Topic 新增 sourceItemId 字段，关联 SourceItem，支持去重保护。
2. **常用内容源预设**：`server/services/fetch/sourcePresets.ts`，8 个预设（HN, GH, PH, OpenAI, Google AI, Anthropic, 机器之心, 量子位），前端预设弹窗一键添加。
3. **每日工作流 API**：`GET /api/daily/summary` 返回今日摘要，`POST /api/daily/fetch-today` 一键抓取全部活跃源。
4. **Dashboard 今日流程**：新增"今日内容生产流程"5 步骤面板（抓取→候选→选题→文章→发布）。
5. **SourceCenterView 增强**：预设弹窗、今日/高质量筛选、按时间/质量排序、URL 复制按钮。
6. **选题去重保护**：已生成选题的 SourceItem 重复生成会返回错误提示。

## 验证结果

- `npm run lint`：通过
- `npm run build`：通过
- `npm run test:e2e`：通过（mock 模式，自动清理）
- `npm run db:clear-demo:dry`：通过（0 条测试数据）
- `npm run db:clear-demo`：已清理 119 条测试数据

## 已知风险

- Kimi 2.6 可能响应慢，健康检查可能显示 slow/timeout
- URL 抓取不处理 JS 渲染页面
- 不做反爬，被拦截的页面会标记 blocked
- test:e2e 默认 mock 模式，真实 AI 模式需要配置 Key
- SQLite 适合本地 MVP，不适合多人生产
- FetchTask 同步执行，大量源时会阻塞

## 禁止事项

- 不要真实自动发微信公众号
- 不要接入图片生成 API
- 不要暴露 Kimi / DeepSeek API Key
- 不要恢复三篇文章并发生成
- 不要破坏苹果系 UI
- 不要把核心业务数据写回 localStorage
- 不要让文章生成超过 90 秒还继续 loading
- 不要伪造 AI 成功、抓取成功、发布成功
- 不要在前端硬编码 mock/fake/demo 数据
- 不要在非测试环境使用 [DEV]/[TEST]/[MOCK] 前缀数据
## Phase 9：工作流状态打通与文章生产闭环加固

本阶段在 Phase 8 的每日任务工作台基础上打通对象直达和文章生产闭环。新增 `server/services/articleWorkflowStatus.ts`，统一计算 Article 的 `draft / needs_quality_check / quality_failed / quality_passed / package_ready / waiting_manual_publish` 状态；新增 `GET /api/articles/:id/workflow-status` 给前端工作流状态卡使用。

新增 `server/services/publishPackage.ts` 和 `POST /api/articles/:id/publish-package`，支持从 Article 直接生成 dry-run 发布包和 `PublishTask`。生成前必须通过最新 `ReviewLog.check`，且风险项为 0。发布文案只使用“发布包已生成 / dry-run 已记录 / 等待手动发布”，不做真实微信自动发布，不保存任何微信草稿标识。

Dashboard 的任务对象增加 `actionPayload`，前端通过内存状态选中并高亮 Source、SourceItem、Topic、Article、PublishTask，不把核心业务 selectedId 写入 localStorage。Phase 11 后 Kimi 不再生成正文，只阅读 DeepSeek 已保存的文章并生成段落配图方案。

边界继续保持：不回退 Streamlit/CrewAI，不接图片生成 API，不新增登录/多用户/权限/SaaS，不插入 mock/demo/fake/sample 数据，产品内模型只允许 DeepSeek v4 Pro 和 Kimi 2.6。
