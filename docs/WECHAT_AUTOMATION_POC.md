# WeChat Automation PoC

## Phase 15: Draft Automation Lifecycle Stabilization

Phase 15 stabilizes browser lifecycle and the real save PoC evidence chain.

- `inject-poc` success now creates an in-memory automation run and keeps the Chromium page open by default for human review.
- Browser keep-alive config: `WECHAT_KEEP_BROWSER_OPEN_AFTER_INJECT=true`, `WECHAT_KEEP_BROWSER_OPEN_AFTER_SAVE=true`, `WECHAT_BROWSER_KEEP_ALIVE_MS=600000`.
- `server/services/wechat/wechatRunManager.ts` owns the active browser/context/page, prevents concurrent write flows, tracks run state, and closes runs only by explicit close API, timeout, severe startup failure, or service shutdown.
- `GET /api/wechat/runs/current` returns the active non-sensitive run state.
- `POST /api/wechat/runs/:runId/close` explicitly closes the active browser run.
- A new inject/save request is rejected with `WECHAT_RUN_IN_PROGRESS` while another run is active, except `save-poc` may reuse the matching injected `runId`.
- `save-poc` body may include `{ "runId": "..." }`. When the run already has `titleFilled=true` and `contentInjected=true`, save reuses that page instead of opening and filling a fresh editor.
- Filled title inputs may stop matching placeholder selectors after content is inserted; save reuse trusts the run evidence for `titleFilled=true` and still requires the editor/save button gates before clicking save.
- `draftSaved=true` is allowed only after a real WeChat save-success signal. If save was clicked but no clear success feedback was detected, the result is `WECHAT_SAVE_RESULT_UNKNOWN`, `draftSaved:false`, and the browser remains open for manual draft-box inspection.
- Phase 15 still does not support mass publish, scheduled publish, batch publish, captcha bypass, official WeChat API usage, or silent background save.
- The PoC can be renamed to a controlled "save to WeChat drafts" capability only after 3 consecutive real `draftSaved=true` runs and manual confirmation that the drafts exist.

## Phase 14: Fill Draft Content After Login

Phase 14 verifies the real logged-in path from a `PublishTask` package into the WeChat draft editor. It does not save by default.

- `POST /api/wechat/session/validate` opens the tokenized WeChat backend with the saved Playwright storage state and returns only non-sensitive evidence. API diagnostics redact the WeChat `token` query value.
- `POST /api/wechat/editor/probe` reads `PublishTask.packageJson`, validates session, opens the tokenized `appmsg_edit` draft page, and checks title input, body editor, and save button selectors without filling or saving.
- Title source priority is `packageJson.title` -> `PublishTask.title` -> `Article.title` -> first Markdown `#` heading.
- Body source priority is `PublishTask.packageJson.html` -> `PublishTask.outputHtml` -> package Markdown converted to HTML -> article Markdown converted to HTML.
- `server/services/wechat/wechatHtmlAdapter.ts` removes scripts, iframes, external style/link blocks, and inline event handlers; keeps common article tags; applies inline styles; appends `privateDomainCta`; and does not upload or insert images.
- `POST /api/wechat/drafts/inject-poc` clears and fills the title, verifies the filled title, injects body content, verifies non-empty editor content, leaves the browser open, and always returns `draftSaved:false`.
- HTML injection strategy order is direct DOM HTML -> clipboard HTML paste -> plain-text fallback. `contentInjected=true` only when the editor text length is detected after injection. Plain-text fallback must include a warning.
- `POST /api/wechat/drafts/save-poc` refuses unless `confirm:true`. It must redo session validation, title fill, content injection, and save-button detection before clicking save. `draftSaved=true` requires a real WeChat save-success signal; unknown save result is `WECHAT_SAVE_RESULT_UNKNOWN` with `draftSaved:false`.
- Selector candidates for QR login, account home, new draft entry, title input, editor, save button, save success, and captcha/risk live in `server/services/wechat/wechatSelectors.ts`. Probe failures return `selectorReport`, `currentUrl`, `pageTitle`, and `failedStep`.
- Phase 14 pass target is 3 consecutive successful `editor/probe` runs and 3 consecutive successful `inject-poc` runs. Three `save-poc` successes are allowed only after explicit user approval and manual draft-box confirmation.

## Phase 13: Real Draft PoC Verification

Phase 13 moves the PoC from disabled/status-only into the real gated workflow.

- Required `.env` for local verification: `WECHAT_AUTOMATION_ENABLED=true`, `WECHAT_HEADLESS=false`, `WECHAT_SESSION_PATH=.local/wechat-session.json`, `WECHAT_OPERATION_DELAY_MIN_MS=1000`, `WECHAT_OPERATION_DELAY_MAX_MS=3000`.
- With no session file, `GET /api/wechat/status` must return `need_login`; with `WECHAT_AUTOMATION_ENABLED=false`, all execution endpoints must refuse with `WECHAT_DISABLED`.
- `POST /api/wechat/login/start` opens headed Chromium on `https://mp.weixin.qq.com/`, waits for human QR scan, saves storage state only after login is detected, and never returns cookies/session contents.
- `POST /api/wechat/session/validate` verifies the session by visiting the WeChat backend home page.
- `POST /api/wechat/editor/probe` reads the selected `PublishTask` package, validates session, opens the draft editor, and reports title/editor/save selector evidence. Candidates live only in `server/services/wechat/wechatSelectors.ts`.
- `POST /api/wechat/drafts/inject-poc` fills title and content, tries HTML injection first, then clipboard paste, then plain-text fallback with warning. It never saves and returns `draftSaved:false`.
- `POST /api/wechat/drafts/save-poc` requires `confirm:true` and front-end second confirmation. It returns `draftSaved:true` only after a real save click and a detected WeChat success signal.
- Recent run records are stored in `PublishTask.packageJson.wechatPocRuns`; the UI shows the latest 3 probe, inject, and save runs separately.
- PoC is considered initially passed only after the same real public account completes 3 consecutive `draft_save_poc` runs with `draftSaved=true` and the user confirms the drafts exist in WeChat.
- After 3 successes, the capability may be upgraded to controlled “保存到微信公众号草稿箱”; it is still not mass publish, scheduled publish, batch save, captcha bypass, or background silent execution.

Phase 10 adds the base layer for a WeChat public account automation proof of concept. This is not production publishing.

Phase 11 does not change the WeChat boundary. Publish packages may now contain a `visualPlan` / 段落配图方案, but the WeChat PoC still only checks session/editor reachability and prepared HTML. It does not upload images, inject generated images, or save a real draft in `poc_check` mode.

## Boundary

- Disabled by default with `WECHAT_AUTOMATION_ENABLED=false`.
- Only manual user actions can start login or a draft PoC check.
- Uses Playwright browser automation only.
- Does not use WeChat official APIs.
- Does not bypass captcha, QR login, or account risk controls.
- Does not run scheduled or batch publishing.
- Does not upload images.
- Does not save a real draft in the current `poc_check` mode.
- Does not log or return cookies/session data.
- Any future real draft save must require a second confirmation.

Claude owns UI wording and small bug polish. Codex owns the automation mainline and backend capability direction.

## Configuration

```env
WECHAT_AUTOMATION_ENABLED="false"
WECHAT_SESSION_PATH=".local/wechat-session.json"
WECHAT_HEADLESS="false"
WECHAT_OPERATION_DELAY_MIN_MS="1000"
WECHAT_OPERATION_DELAY_MAX_MS="3000"
WECHAT_LOGIN_TIMEOUT_MS="120000"
```

Session files are ignored by git. The default path is `.local/wechat-session.json`.

Playwright is declared as a dependency, but browser binaries are not downloaded automatically during dependency updates. To test the PoC locally:

```bash
npx playwright install chromium
```

## Status API

`GET /api/wechat/status`

Returns non-sensitive status only:

- `disabled`
- `not_configured`
- `playwright_missing`
- `need_login`
- `session_valid`
- `session_expired`
- `captcha_required`
- `poc_ready`
- `last_run_failed`

Errors:

- `WECHAT_DISABLED`
- `WECHAT_PLAYWRIGHT_NOT_INSTALLED`
- `WECHAT_LOGIN_REQUIRED`
- `WECHAT_LOGIN_TIMEOUT`
- `WECHAT_SESSION_EXPIRED`
- `WECHAT_PAGE_LOAD_TIMEOUT`
- `WECHAT_EDITOR_NOT_FOUND`
- `WECHAT_INJECT_FAILED`
- `WECHAT_SAVE_FAILED`
- `WECHAT_CAPTCHA_DETECTED`
- `WECHAT_ACCOUNT_RISK`
- `WECHAT_UNKNOWN_ERROR`

## Login Start

`POST /api/wechat/login/start`

When enabled, starts headed Chromium and opens `https://mp.weixin.qq.com/`. The user scans the QR code manually. The service saves session only when it detects a tokenized WeChat backend URL. If login is not detected before timeout, it returns `WECHAT_LOGIN_TIMEOUT` and does not save session.

## Draft PoC

`POST /api/wechat/drafts/poc`

Body:

```json
{ "publishTaskId": "task_id" }
```

The service reads the dry-run publish package, adapts HTML for WeChat editor compatibility, opens the editor page with the stored session, and reports evidence:

```json
{
  "sessionChecked": true,
  "editorReached": true,
  "htmlPrepared": true,
  "contentInjected": false,
  "draftSaved": false
}
```

Current mode is `poc_check`. It does not inject article content and does not save a real draft.

## Phase 12 Real Verification Gates

Phase 12 moves the PoC from status checks toward real Playwright verification:

1. Gate 1: Playwright and Chromium availability.
2. Gate 2: headed QR login and local session save.
3. Gate 3: session reuse by visiting the WeChat backend home page.
4. Gate 4: draft editor probing and HTML injection test.
5. Gate 5: second-confirmation draft save PoC.

Gate 5 is never the default path. It only runs when `WECHAT_AUTOMATION_ENABLED=true`, a valid session exists, and the request sends `confirm: true`.

## Phase 12 APIs

`POST /api/wechat/session/validate` validates the local session by opening the WeChat backend home page.

`POST /api/wechat/editor/probe` opens the draft editor and reports whether title input, editor, and save button candidates were found. Selectors are centralized in `server/services/wechat/wechatSelectors.ts`.

`POST /api/wechat/drafts/inject-poc` prepares WeChat-compatible HTML, fills the title, and injects content into the editor. It does not click save and returns `draftSaved: false`.

`POST /api/wechat/drafts/save-poc` attempts a real draft save only after explicit confirmation. It can return `draftSaved: true` only after clicking save and detecting a WeChat save-success signal.

## HTML Adapter

`server/services/wechat/wechatHtmlAdapter.ts` removes `script`, `iframe`, external style/link blocks, and inline event handlers. It keeps common article tags, converts them to inline styles, appends the private-domain CTA, and returns warnings. It does not upload images or insert QR-code images.

Run:

```bash
npm run wechat:html:test
```

## PoC Run Records

Recent runs are stored on `PublishTask.packageJson.wechatPocRuns`. The Phase 12 pass target is three consecutive successful runs on the user's machine.
