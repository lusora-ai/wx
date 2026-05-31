# 小顺 AI 内容工作台 v1.0

## Phase 16：手动触发端到端自动化主线

目标是把既有单步能力串成一条可验收的主线：收集信息 -> 生成选题 -> 生成文章 -> 质量检查 -> 发布包 -> 微信编辑器填入。

验收规则：
- 入口必须是用户手动点击，不做后台定时、不做批处理发布。
- 每次只生成一篇单受众文章，默认 `officeWorker`，不恢复三篇并发。
- 未指定 `sourceId/sourceItemId/topicId/articleId` 时，必须先查找可续跑的已有文章；优先补齐质检、发布包和微信填入，只有没有可续跑对象时才从内容源选择新候选。
- 候选内容自动选择只接受质量分 `>=60` 且未生成选题的 `SourceItem`；指定候选内容低于 40 分时阻断。
- 质量检查继续以 HIGH 风险为阻断项；HIGH 风险存在时不生成发布包、不进入微信填入。
- 发布包继续是 dry-run `PublishTask`，可复用当前版本发布包，不能写入微信草稿 ID。
- 微信步骤只允许 `inject-poc` 填入标题和正文，保持页面打开供人工检查；不调用 `save-poc`，不自动保存草稿。
- 响应必须返回每一步 evidence/状态，失败时说明真实 gate。

禁止项继续有效：不群发、不定时发布、不批量自动保存、不绕过验证码、不调用微信官方 API、不接图片生成 API、不新增登录/多用户/SaaS、不插入 mock/demo/fake/sample 数据。

## Phase 13：微信自动化真实 PoC 验证与 PRD 主线固化

目标是把系统推进为真实可用的公众号内容自动化工作台，而不是继续修按钮和局部 UI。

验收规则：
- 内容链路保持 `SourceItem -> Topic -> Article -> ArticleVersion -> ReviewLog -> PublishTask`。
- 质量检查以 HIGH 风险为阻断项；MEDIUM 风险不阻断发布包，但必须展示。
- 无 `ReviewLog.check` 才是 `needs_quality_check`；编辑后必须进入 `quality_outdated`。
- 发布包生成后再次调用必须 `reused=true`，发布中心使用当前发布包继续进入微信 PoC。
- 微信自动化默认关闭；只有 `WECHAT_AUTOMATION_ENABLED=true` 且后端重启后才允许手动触发。
- `need_login -> session_valid -> editor probe -> inject-poc -> save-poc` 是受控 gate，任何一步失败都返回真实 evidence。
- `inject-poc` 不保存草稿；`save-poc` 必须二次确认，且只有微信页面真实保存反馈才能返回 `draftSaved=true`。
- 最近 PoC 运行记录按探测、注入、保存分别展示最近 3 次。
- 连续 3 次同一公众号真实 `draftSaved=true` 后，才允许升级为“保存到微信公众号草稿箱”的受控功能。

禁止项继续有效：不群发、不定时发布、不批量自动保存、不绕过验证码、不调用微信官方 API、不接图片生成 API、不新增登录/多用户/SaaS、不插入 mock/demo/fake/sample 数据。

## Phase 12：微信公众号自动化 PoC 真实验证

Phase 12 推进 PRD 的物理执行层：Playwright 微信公众号草稿自动化。

5 个 Gate：
- Gate 1：Playwright / Chromium 环境可用。
- Gate 2：有头 Chromium 扫码登录并保存本地 session。
- Gate 3：复用 session 访问微信公众号后台并校验登录态。
- Gate 4：探测草稿编辑器并执行 HTML 注入测试，不保存草稿。
- Gate 5：二次确认后执行真实保存草稿 PoC。

安全边界：
- `WECHAT_AUTOMATION_ENABLED=false` 默认关闭。
- 所有自动化操作必须用户手动触发。
- 不做群发、定时发布、批量发布。
- 不绕过验证码、扫码登录或账号风控。
- 不调用微信官方 API。
- 没有真实点击保存并检测到微信成功反馈时，不能写“微信草稿已保存”。

新增/增强 API：
- `GET /api/wechat/status`
- `POST /api/wechat/login/start`
- `POST /api/wechat/session/validate`
- `POST /api/wechat/editor/probe`
- `POST /api/wechat/drafts/inject-poc`
- `POST /api/wechat/drafts/save-poc`

连续 3 次 PoC 成功记录作为进入下一阶段的人工验收标准。

## Phase 11：单入口自动化生成流水线

Phase 11 resets the production path:
- Frontend exposes one main article generation entry. Users do not choose Kimi or DeepSeek as article writers.
- DeepSeek v4 Pro generates the article outline/body and quality repair drafts.
- Kimi 2.6 reads the saved final Markdown and produces `visualPlan`: cover, paragraph-bound inline images, and social share card.
- `visualPlan` stores `source`, `generatedBy`, `basedOnArticleVersion`, `visualStrategy`, `imagePromptSet`, and `warnings`.
- If the article is edited after the plan is generated, the plan is treated as stale and the UI suggests regeneration.
- If Kimi times out, fallback is explicitly marked as `deepseek-v4-pro-fallback`. If both fail, no fake template prompt plan is generated.
- Product wording is “段落配图方案”, not “固定配图提示词矩阵”.

## Phase 10: 自动化主线推进

Phase 10 focuses on automation capability instead of Dashboard polish. The main path is: content source fetch -> AI topic -> AI article -> quality check -> publish package -> WeChat draft automation PoC.

Scope:
- Publish packages now produce `imagePromptSet` through Phase 11 `visualPlan`; prompt count follows article sections rather than a fixed count.
- No image-generation API is connected. The prompts are for manual copy to external tools.
- Kimi 2.6 handles article-reading visual planning; DeepSeek v4 Pro is the marked fallback when Kimi times out or fails.
- WeChat automation is a Playwright PoC only. It is disabled by default, manually triggered, and must not bypass captcha, account risk controls, or QR login.
- The PoC checks session/editor reachability and prepared HTML. It does not perform scheduled publishing, batch publishing, image upload, or real draft save.
- Product models remain limited to DeepSeek v4 Pro and Kimi 2.6.

本仓库在保留 AI Studio 生成的 Vite React 苹果系前端基础上，升级为 Express API + SQLite/Prisma 驱动的内容生产 MVP。

核心链路：

内容源录入/抓取 -> 数据库存储 -> DeepSeek 提炼选题 -> 推送写作工坊 -> DeepSeek 生成单受众单篇文章 -> Kimi 阅读文章生成段落配图方案 -> 编辑保存版本 -> 审核 -> 导出 HTML/Markdown -> 创建 dry-run 发布任务。

v1.0 不做真实微信公众号自动发布、定时发布、多账号管理或反自动化绕过。Phase 10 只新增 Playwright 微信草稿自动化 PoC 基础层：默认关闭、手动触发、扫码由用户完成，当前仅做 session/editor/HTML 检查，不保存真实草稿。

## Phase 8：每日内容生产任务工作台

系统首页从模块聚合改为任务驱动工作台。用户每天打开后，首先看到今日生产进度、当前最该处理的任务、待处理任务列表和真实空状态。

任务流：

内容源抓取 -> 候选内容筛选 -> 今日任务生成 -> 选题确认 -> 文章生成 -> 质量检查 -> 编辑修订 -> 发布包 -> dry-run 发布记录。

任务生成不依赖 AI，不新增项目管理表，优先复用 Source、SourceItem、Topic、Article、ReviewLog、PublishTask 等现有数据。

产品边界：
- 本地个人工作台
- 不做登录、多用户、权限或 SaaS 化
- 不做真实微信公众号自动发布
- 不插入 mock/demo/fake/sample 数据
- 发布中心只提供 dry-run 记录、发布包、Markdown/HTML 复制与下载

## 配图提示词系统

文章生成后，Kimi 2.6 会判断哪些段落适合配图，并在 Markdown 中插入 `{{IMAGE_SLOT:img_1}}` 标记。系统同步保存对应的中文提示词、英文提示词、负面提示词、推荐原因、比例、风格和 Alt 文案。

本系统只管理提示词，不接入图片生成 API，不保存图片地址，不展示图片生成状态。导出 HTML 时，未跳过的图片位输出"此处建议配图"提示块，供编辑手动替换。

## v1.1 P0 调整

- 本地前端地址统一为 `http://localhost:3100/`，API 地址为 `http://localhost:8787`。
- AI 写作工坊默认单篇生成，不再默认三篇并发。单篇生成超时为 90 秒。
- RSS/URL 抓取作为基础能力进入 `SourceItem`，支持从抓取内容生成选题。
- 内容源删除为软删除，不删除历史文章。

## v1.2 本轮新增

- **SourceItem 独立管理**：内容源中心新增"抓取结果"Tab，支持筛选、归档、恢复、生成选题。
- **内容质量规则**：抓取时自动评分，检测过短、缺标题、重复、疑似反爬、低文本密度。
- **AI 健康检查**：设置页可检查 DeepSeek v4 Pro 和 Kimi 2.6 的 API 连通性。
- **FetchTask 轻量任务**：抓取操作支持任务记录，可查看执行状态和结果。

## v1.3 本轮新增

- **每日工作流**：Dashboard 新增"今日内容生产流程"5 步骤面板，一键抓取今日内容。
- **常用内容源预设**：8 个常用预设（Hacker News, GitHub Trending, Product Hunt, OpenAI Blog, Google AI Blog, Anthropic News, 机器之心, 量子位），一键添加。
- **Topic.sourceItemId**：选题关联 SourceItem，支持去重保护，防止重复生成选题。
- **候选内容池优化**：新增今日/高质量筛选、按时间/质量排序、URL 复制按钮。
## Phase 9：工作流状态打通与文章生产闭环加固

Phase 9 不新增复杂项目管理模块，只加固现有生产链路：`SourceItem -> Topic -> Article -> QualityCheck -> EditVersion -> PublishPackage -> PublishTask`。

核心变化：
- Dashboard 任务按钮必须携带 `relatedEntityType`、`relatedEntityId` 和 `actionPayload`，点击后直达具体对象并高亮。
- Article 工作区新增后端驱动的工作流状态卡，状态来自 `GET /api/articles/:id/workflow-status`，前端不自行猜测。
- 质量检查以 `ReviewLog.check` 为准；没有检查就是“待质量检查”，有风险项就是“需修改”，通过且无风险项才是“可生成发布包”。
- 发布包可以从 Article 直接创建：`POST /api/articles/:id/publish-package`。默认禁止未质检或质检未通过文章生成发布包。
- PublishTask 文案保持 dry-run 边界：`发布包已生成`、`dry-run 已记录`、`等待手动发布`。

模型边界保持不变：产品内只使用 DeepSeek v4 Pro 和 Kimi 2.6；不接图片生成 API；不做真实微信公众号自动发布；不做登录、多用户、权限或 SaaS 化。
