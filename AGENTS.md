# AGENTS.md — 小顺 AI 内容中控系统长期推进规则

## 最高目标

本项目的长期目标是：在不破坏现有稳定微信自动公众号草稿链路的前提下，持续按照《小顺 AI 内容中控系统 PRD v1.0 优化版》推进功能开发、稳定性增强、验收测试和工程规范化，强化并优化整体自动化能力。

最终产品方向是本地个人内容工作台，稳定完成：

`自动化收集信息 -> 生成选题 -> 生成单篇文章 -> 质量检查 -> 生成发布包 -> 自动填入微信公众号编辑器`

任何 agent 在本仓库工作时，都必须优先保护这条主线。

## 不可破坏的边界

- 不做群发。
- 不做定时发布。
- 不做批量自动保存。
- 不绕过验证码、扫码登录或账号风控。
- 不调用微信官方 API。
- 不接入图片生成 API。
- 不新增登录、多用户、权限系统或 SaaS 化能力。
- 不插入 mock/demo/fake/sample 数据到产品主流程。
- 不把 `inject-poc`、编辑器填入、DOM 可见内容，描述成“微信草稿已保存”。
- 只有检测到真实微信保存成功反馈时，才允许返回或展示 `draftSaved=true`。

## 当前主线状态

当前系统主线围绕这些实体推进：

`SourceItem -> Topic -> Article -> ArticleVersion -> ReviewLog -> PublishTask`

优先保持并强化这条链路，不新增平行的复杂项目管理模型，除非 PRD 明确要求并且旧链路已经无法表达。

当前微信能力仍属于受控 PoC：

- `session_valid -> editor/probe -> inject-poc -> save-poc`
- `inject-poc` 只填入标题和正文，不保存草稿。
- `save-poc` 必须二次确认，并且只能在真实保存反馈出现后返回成功。
- 从 PoC 升级为正式“保存到微信公众号草稿箱”前，必须有同一公众号连续 3 次真实 `draftSaved=true`，并由用户人工确认草稿箱结果。

## 推进优先级

优先级从高到低：

1. 端到端自动化主线可用性：抓取、选题、文章、质检、发布包、微信填入。
2. 微信自动化稳定性：session、编辑器探测、标题填入、HTML/剪贴板/纯文本注入、页面保持、真实 evidence。
3. 质量门禁：HIGH 风险阻断；MEDIUM 风险展示但不阻断；编辑后进入 `quality_outdated`。
4. 数据真实与去重：软删除、SourceItem 去重、Topic.sourceItemId 绑定、禁止测试数据污染产品视图。
5. 工程稳定性：类型检查、构建、E2E、日志、错误码、文档同步。
6. UI 改善：只在不干扰主线时做，避免陷入按钮、卡片、视觉细节循环。

## 微信链路保护规则

涉及 `server/services/wechat/*`、`server/routes/wechat.ts`、`src/api/wechat.ts`、`PublishCenterView` 的改动必须遵守：

- selector 只能集中维护在 `server/services/wechat/wechatSelectors.ts`。
- 不在组件或路由中散落新的微信 DOM selector。
- 不记录、返回、展示 cookie、storageState、token 原值或 session 文件内容。
- 微信 URL 中的 `token` 必须脱敏。
- `WECHAT_AUTOMATION_ENABLED=false` 是默认状态。
- 微信自动化必须用户手动触发，不能后台静默运行。
- 浏览器关闭、页面丢失、运行冲突必须返回真实错误码，例如 `WECHAT_BROWSER_CLOSED`、`WECHAT_PAGE_LOST`、`WECHAT_RUN_IN_PROGRESS`。
- `WECHAT_SAVE_RESULT_UNKNOWN` 必须展示为不确定状态，不能转成成功。

## AI 与内容生成规则

- 文章正文只由 DeepSeek v4 Pro 生成。
- Kimi 2.6 只负责阅读已保存文章并生成段落配图方案。
- 前端不暴露模型选择，不允许把 Kimi 当成正文写手。
- Kimi 超时时，DeepSeek fallback 必须标记为 `deepseek-v4-pro-fallback`。
- 如果 Kimi 和 fallback 都失败，可以继续生成发布包，但必须明确 `noVisualPlan=true` 或等价状态。
- 本地模板不得伪装成 Kimi 文章阅读结果。
- 配图提示词只用于人工复制，不上传图片、不保存图片地址、不触发图片生成。

## 自动化流水线规则

`POST /api/automation/run` 或后续同类主线 API 必须保持：

- 手动触发。
- 每次最多生成一篇单受众文章。
- 自动候选内容选择只使用真实 `SourceItem`。
- 默认候选内容质量分必须达到主线阈值，低质量内容必须阻断或要求人工筛选。
- 质量检查必须写入 `ReviewLog.check`。
- HIGH 风险阻断发布包与微信填入。
- 发布包必须是 dry-run `PublishTask`。
- 微信填入只能调用 `inject-poc`，不能自动调用 `save-poc`。
- 返回结果必须包含每一步状态和阻断原因，不能吞掉失败。

## 验收测试要求

后端、主链路或微信相关改动至少运行：

```bash
npm run build
npm run wechat:html:test
npm run test:e2e
```

如果改动涉及真实 AI，需要在配置真实 Key 后补充：

```bash
TEST_USE_AI=true npm run test:e2e
npm run ai:smoke
```

如果改动涉及前端交互，必须用浏览器打开本地页面检查：

- 页面能加载。
- 关键按钮可见。
- 控制台没有新的前端错误。
- 文案没有越界承诺，例如把 dry-run 或填入说成已保存。

如果改动涉及微信真实保存，必须由用户明确确认后执行，并在结果里说明：

- 是否点击保存。
- 是否检测到微信成功反馈。
- 是否有 `draftSaved=true`。
- 是否已人工在草稿箱核对。

## 文档同步规则

新增或改变主线能力时，至少检查是否需要同步：

- `docs/PRD.md`
- `docs/API.md`
- `docs/DEV_NOTES.md`
- `README.md`
- `CLAUDE.md`
- `AGENTS.md`

API 行为、边界、错误码、验收规则发生变化时，必须同步文档。

## 数据与安全规则

- `.env`、`.local/`、微信 session、日志、错误输出、数据库文件、构建产物不得提交。
- API Key 只能存在服务端环境变量。
- 不在前端 bundle 中暴露模型密钥。
- 日志不记录密钥、cookie、session、微信 token。
- 测试数据必须带明显标记，并由测试脚本自动清理。
- 产品默认视图必须过滤 `[TEST]`、`[DEV]`、`[MOCK]`、`E2E`、`localhost`、`127.0.0.1` 等测试数据。

## 工程协作规则

- 从当前稳定基线开分支，不直接在 `main` 上推进。
- 每个阶段保持一个可解释的小提交或小 PR。
- 不重写用户已有改动，不随意回滚。
- 修改共享服务前先读调用方。
- 优先复用现有服务，不重复实现抓取、质量检查、发布包或微信注入逻辑。
- 错误要返回结构化 `errorCode` 和可读 `message`。
- 不把 UI 状态当后端事实，关键状态以后端 API 和数据库为准。

## 当前推荐推进方向

短期继续推进：

1. 强化 `POST /api/automation/run` 的真实 AI 场景验收。
2. 增加自动化流水线历史记录或最近运行摘要，但优先复用 `OperationLog`，不急于新增表。
3. 改进 Dashboard 对阻断原因的展示，例如 HIGH 风险、无合格 SourceItem、微信未登录。
4. 完成 3 次连续 `editor/probe` 与 `inject-poc` 实测记录。
5. 在用户明确授权后，推进 3 次真实 `save-poc` 验收，并人工核对微信公众号草稿箱。

长期升级为正式保存能力前，必须先完成真实证据闭环，不能只因为代码路径存在就改产品文案。
