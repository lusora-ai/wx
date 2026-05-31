# 小顺 AI 内容工作台

## Phase 13: 微信自动化真实 PoC 验证与主线固化

Phase 13 keeps the system on the PRD mainline: content source -> topic -> article -> quality check -> publish package -> controlled WeChat draft PoC.

- Claude 修复后的质量规则已固化：只有 HIGH 风险阻断发布包；MEDIUM 风险展示但不阻断；无 `ReviewLog.check` 才是 `needs_quality_check`；文章编辑后进入 `quality_outdated`。
- `POST /api/articles/:id/publish-package` 对已有成功发布包返回 `reused=true`，发布中心选中已有 `PublishTask` 时显示“使用当前发布包”，不重新走质量 gate。
- 开启微信 PoC 需要在 `.env` 设置 `WECHAT_AUTOMATION_ENABLED=true`、`WECHAT_HEADLESS=false`、`WECHAT_SESSION_PATH=.local/wechat-session.json`，然后重启后端。
- `WECHAT_AUTOMATION_ENABLED=false` 时微信接口保持安全禁用；AppID / AppSecret 不影响 Playwright 扫码登录。
- session 文件默认保存到 `.local/wechat-session.json`，`.local/` 已被 `.gitignore` 排除。
- selector candidates 统一维护在 `server/services/wechat/wechatSelectors.ts`。
- `inject-poc` 只填标题和正文，不保存草稿；`save-poc` 必须 `confirm=true` 且前端二次确认。
- PoC 初步通过标准是同一公众号账号连续 3 次真实 `draftSaved=true`，并由人工确认草稿箱存在草稿。
- 通过 3 次后才允许升级为“保存到微信公众号草稿箱”的受控功能；仍不群发、不定时发布、不后台静默执行。

## Phase 12: 微信公众号自动化 PoC 真实验证

Phase 12 adds the physical Playwright verification layer for WeChat draft automation:

- `GET /api/wechat/status` now distinguishes disabled, Playwright missing, Chromium missing, need login, editor reachable, and last-run failed states.
- `POST /api/wechat/session/validate` validates a saved session without exposing cookies.
- `POST /api/wechat/editor/probe` probes title/editor/save selectors from centralized candidates.
- `POST /api/wechat/drafts/inject-poc` fills title and injects HTML but does not save.
- `POST /api/wechat/drafts/save-poc` requires `confirm: true` and only reports success after a real save click plus a detected WeChat success signal.
- Chromium is installed with `npx playwright install chromium`; session data stays in `.local/wechat-session.json` by default and is gitignored.

The boundary stays unchanged: no batch publish, no scheduled publish, no captcha bypass, no WeChat official API, and no fake draft-save success.

## Phase 11: 单入口自动化生成流水线

Phase 11 resets the model pipeline around one user-facing generation entry:

- DeepSeek v4 Pro generates the final article Markdown. The frontend no longer exposes Kimi/DeepSeek as competing article writer choices.
- Kimi 2.6 reads the saved article and generates a `visualPlan`: cover, paragraph-bound inline images, and social share card.
- Inline image prompts must include `relatedSectionTitle`, `insertAfterParagraph`, `purpose`, and `placementHint`.
- If Kimi times out or fails, DeepSeek v4 Pro may generate a clearly marked fallback visual plan. If both fail, no fake template plan is generated; the package is marked as `noVisualPlan`.
- `visualPlan` is stored on `Article.visualPlanJson` and copied into `PublishTask.packageJson` when a dry-run package is created.
- If the article version changes, the previous `visualPlan` is treated as stale and the UI suggests regenerating the paragraph image plan.
- Product copy uses “段落配图方案”, not a generic fixed prompt matrix.

## Phase 10: Automation mainline

Phase 10 moves the product from manual dry-run packaging toward the automation path, while keeping all risky WeChat actions opt-in and user-triggered.

- Publish packages include `imagePromptSet` when a `visualPlan` is available. The prompt count follows the article structure instead of being mechanically fixed at five.
- Kimi 2.6 is used to read the completed article and plan paragraph images. DeepSeek v4 Pro is the marked fallback. Local templates must not be presented as Kimi article-reading results.
- `PublishTask.packageJson` stores the generated package payload for new tasks. Old tasks without `imagePromptSet` are displayed through legacy `imageSlots` compatibility.
- WeChat automation PoC is added behind `WECHAT_AUTOMATION_ENABLED=false` by default. It uses Playwright only, does not call WeChat official APIs, does not bypass captcha/risk controls, and does not save real drafts in PoC mode.
- New APIs: `GET /api/wechat/status`, `POST /api/wechat/login/start`, and `POST /api/wechat/drafts/poc`.
- Playwright browser binaries are not downloaded automatically during install. Run `npx playwright install chromium` only when you decide to test the WeChat PoC locally.

WeChat PoC session files are stored under `.local/wechat-session.json` by default and are ignored by git. Cookies/session data must never be logged or returned to the frontend.

本项目保持 Vite + React + TypeScript + Tailwind + Express + Prisma + SQLite 技术栈。产品内模型只使用 DeepSeek v4 Pro 与 Kimi 2.6。

## 本地启动

```bash
npm install
npm run db:push
npm run dev
```

前端默认运行在 `http://localhost:3100/`，API 默认运行在 `http://localhost:8787`。

## 数据库初始化

Prisma 7 在 Windows 下使用项目内幂等初始化脚本：

```bash
npm run db:push
```

脚本会创建/补齐 SQLite 表，并执行 Prisma Client generate。

### 可选：开发种子数据

```bash
npm run db:seed        # 写入 [DEV] 前缀的开发演示数据
npm run db:clear-demo  # 清理所有 [DEV]/[TEST]/[MOCK]/E2E 测试数据
```

种子数据仅供开发演示，日常使用不需要执行 `db:seed`。所有种子数据均以 `[DEV]` 前缀标记，可通过 `db:clear-demo` 一键清理。

## 模型配置

在 `.env` 中配置服务端密钥，前端不会打包这些 key：

```bash
DATABASE_URL="file:./prisma/dev.db"
DEEPSEEK_API_KEY="..."
DEEPSEEK_BASE_URL="https://api.deepseek.com"
DEEPSEEK_MODEL="deepseek-v4-pro"
KIMI_API_KEY="..."
KIMI_BASE_URL="https://api.moonshot.cn/v1"
KIMI_MODEL="kimi-k2.6"
APP_URL="http://localhost:3100"
API_PORT="8787"
LLM_TIMEOUT_MS="90000"
```

模型分工：

- DeepSeek v4 Pro：内容源理解、事实点提取、选题生成、审核辅助。
- Kimi 2.6：阅读最终文章，规划封面图、段落插图、社交传播卡和摘要/标题备选。

## 测试

```bash
npm run lint
npm run build
npm run test:e2e
```

真实 AI 测试：

```bash
TEST_USE_AI=true npm run test:e2e
```

`npm run test:e2e` 默认以 `TEST_USE_AI=false` mock 模式执行。需要真实 AI 单篇生成时可设置 `TEST_USE_AI=true`，超时会失败而不是伪装成功。

## 清理开发数据

```bash
npm run db:clear-demo:dry   # 预览模式，不实际删除
npm run db:clear-demo       # 实际执行清理
```

清理范围：
- `[DEV]` 前缀数据（种子数据）
- `[TEST]` 前缀数据（E2E 测试数据）
- `[MOCK]` 前缀数据
- `E2E` 关键词数据
- `127.0.0.1` / `localhost` URL 数据

如果前端看到 E2E RSS 源或测试数据残留，执行 `npm run db:clear-demo` 即可清理。

## E2E 测试

```bash
npm run test:e2e              # mock 模式，测试后自动清理
KEEP_E2E_DATA=true npm run test:e2e  # 保留测试数据用于调试
```

E2E 测试会自动清理测试数据，不会污染正常前端。

## 永久删除

已归档的内容源支持永久删除（级联删除关联的抓取结果、选题、文章等数据）。

前端"已删除"筛选下，每张内容源卡片提供"恢复"和"永久删除"按钮。

## 单篇生成

AI 写作工坊默认只生成当前受众的一篇文章，目标长度 700-1000 字。服务端正文生成由 DeepSeek v4 Pro 执行，超时会返回清晰错误并建议稍后重试或缩短文章长度。

## RSS/URL 抓取

v1.1 基础抓取支持 RSS 和 URL，不做登录态抓取，不做绕反爬。RSS/URL 抓取结果进入 `SourceItem`，可从抓取内容生成选题。内容源删除为软删除：`Source.status = archived`，不会删除历史文章。

抓取内容支持质量评分，自动检测内容过短、缺少标题、疑似反爬等问题。详见 [docs/FETCHING.md](docs/FETCHING.md)。

## 配图提示词系统

文章生成后，系统会在适合视觉表达的段落后插入 `{{IMAGE_SLOT:img_1}}` 标记，并保存对应的中文提示词、英文提示词、负面提示词、比例、风格、Alt 文案和推荐原因。系统不接入图片接口，不保存图片文件，不生成图片。

## 文章质量检查

文章生成后可执行 10 项质量检查（过短、过长、缺标题、缺小标题、缺 CTA、AI 腔调、禁用黑话、待核实声明、图片位不匹配、HTML 风险），返回通过/不通过、得分和问题列表。

## 发布包

dry-run 发布任务会生成完整发布包，包含标题、摘要、Markdown、HTML、段落配图方案、标签、CTA、AI 声明、来源链接。前端支持单条/全部段落配图提示词复制，并可下载包含完整 `visualPlan` / `imagePromptSet` 的发布包 JSON，方便手动粘贴到微信公众号后台或外部图片工具。

## AI 烟雾测试

`npm run ai:smoke` 执行轻量级端到端烟雾测试，验证 AI 链路正常。需在 `.env` 中配置真实 API Key。

## AI 健康检查

设置页"模型健康检查"Tab 可检查 DeepSeek v4 Pro 和 Kimi 2.6 的 API 连通性，不暴露 API Key。

## FetchTask

抓取任务支持轻量任务记录，可通过 `POST /api/fetch-tasks/source/:sourceId` 或 `POST /api/fetch-tasks/all` 创建，任务状态可通过 `GET /api/fetch-tasks` 查看。

## Phase 8：每日内容生产任务工作台

首页已改为“今日内容生产工作台”，通过 `GET /api/tasks/today` 从现有 Source、SourceItem、Topic、Article、ReviewLog、PublishTask 计算今日任务，不新增任务表。

任务类型包括：内容源抓取、候选内容筛选、可生成选题、待生成文章、需质量检查、需修改、可生成发布包、等待手动发布。

发布边界保持 dry-run：系统只生成发布包、记录 PublishTask，并提供 Markdown/HTML 复制与下载；不做真实微信公众号自动发布。
## Phase 9：工作流状态打通与文章生产闭环加固

本阶段新增 `GET /api/articles/:id/workflow-status`，由 `server/services/articleWorkflowStatus.ts` 统一计算文章状态。状态只从 `Article`、`ArticleVersion`、`ReviewLog.check`、`PublishTask` 读取，不新增数据库表；没有 `ReviewLog.check` 的文章一律显示为“待质量检查”，有任意风险项显示为“需修改”，通过质检且无风险项才允许生成发布包。

新增 `POST /api/articles/:id/publish-package`，可以从 Article 直接生成 dry-run 发布包并创建或更新 `PublishTask`。生成前会校验文章存在、正文非空、质量检查已通过且无风险项。发布文案固定为“发布包已生成 / dry-run 已记录 / 等待手动发布”，仍然不做真实微信自动发布，不写入任何微信草稿标识。

Dashboard 任务现在携带 `actionPayload`，前端用内存状态直达并高亮 Source、SourceItem、Topic、Article 或 PublishTask；不把业务 selectedId 写入 localStorage。Phase 11 后正文生成固定为 DeepSeek v4 Pro，Kimi 2.6 只负责阅读正文后的段落配图方案。
