import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { parseJsonField } from '../../types/api';
import { buildPublishPackagePayload } from '../publishPackage';
import { markdownToWechatHtml } from '../html';
import { adaptHtmlForWechat } from './wechatHtmlAdapter';
import { firstVisibleLocator, type WechatSelectorResolution } from './wechatSelectors';
import {
  ensureSessionDir,
  getWechatConfig,
  hasSessionFile,
  readWechatSessionMeta,
  requireWechatEnabled,
  requireWechatRuntime,
  saveWechatSessionMeta,
  setWechatEditorReachable,
  setWechatRuntimeError,
  type WechatErrorCode,
} from './wechatSession';
import {
  attachWechatRunBrowser,
  closeWechatRun,
  createWechatRun,
  failWechatRun,
  getActiveWechatRun,
  getCurrentWechatRun,
  hasActiveWechatRun,
  keepWechatRunOpen,
  updateWechatRun,
  type WechatAutomationRunState,
} from './wechatRunManager';

type InjectionStrategy = 'dom_html' | 'clipboard_html' | 'text_fallback' | null;
type EvidenceValue = boolean | string | number | null;
type PocEvidence = Record<string, EvidenceValue>;
type SelectorReport = {
  titleInput: 'found' | 'not_found';
  editor: 'found' | 'not_found';
  saveButton: 'found' | 'not_found';
  candidates?: {
    titleInput: Record<string, WechatSelectorResolution>;
    editor: Record<string, WechatSelectorResolution>;
    saveButton: Record<string, WechatSelectorResolution>;
  };
};
type PageDiagnostics = {
  currentUrl: string;
  pageTitle: string;
  failedStep?: string | null;
  htmlLength?: number;
  textLength?: number;
  editorTextLengthAfterInject?: number;
  wechatWordCountText?: string | null;
  wechatWordCountNumber?: number | null;
  keepBrowserOpen?: boolean;
  keepAliveUntil?: string | null;
  saveFeedbackText?: string | null;
  draftId?: string | null;
  visibleTextSummary?: string[];
};

export type WechatLoginResult = {
  success: boolean;
  status: 'session_valid' | 'login_timeout' | 'captcha_required' | 'account_risk' | 'failed';
  message: string;
  errorCode: WechatErrorCode | null;
  evidence: {
    browserLaunched: boolean;
    loginPageOpened: boolean;
    qrVisible: boolean;
    loginDetected: boolean;
    sessionSaved: boolean;
  };
};

export type WechatSessionValidateResult = {
  success: boolean;
  status: 'session_valid' | 'session_expired' | 'need_login' | 'failed';
  message: string;
  errorCode: WechatErrorCode | null;
  evidence: {
    sessionFileFound: boolean;
    browserLaunched: boolean;
    homePageOpened: boolean;
    loginRedirected: boolean;
    accountPageDetected: boolean;
  };
};

export type WechatProbeResult = {
  success: boolean;
  message: string;
  errorCode: WechatErrorCode | null;
  evidence: {
    sessionChecked: boolean;
    draftPageOpened: boolean;
    titleInputFound: boolean;
    editorFound: boolean;
    saveButtonFound: boolean;
    htmlPrepared: boolean;
  };
  selectorReport: SelectorReport;
  currentUrl?: string;
  pageTitle?: string;
  failedStep?: string | null;
  diagnostics?: PageDiagnostics;
  warnings?: string[];
  recentRuns?: WechatPocRun[];
};

export type WechatInjectResult = {
  success: boolean;
  mode: 'poc_check' | 'inject_poc' | 'draft_save_poc';
  runId?: string | null;
  message: string;
  errorCode: WechatErrorCode | null;
  evidence: PocEvidence;
  warnings: string[];
  draftId?: string | null;
  diagnostics?: PageDiagnostics;
  recentRuns?: WechatPocRun[];
};

export type WechatPocRun = {
  runId: string;
  publishTaskId: string;
  mode: 'probe' | 'inject_poc' | 'draft_save_poc';
  success: boolean;
  errorCode: string | null;
  evidence: PocEvidence;
  message: string;
  title?: string;
  injectionStrategy?: InjectionStrategy;
  keepBrowserOpen?: boolean;
  userConfirmed?: boolean;
  ranAt: string;
};

type LoadedPackage = {
  task: NonNullable<Awaited<ReturnType<typeof loadTask>>>;
  pkg: Awaited<ReturnType<typeof buildPublishPackagePayload>>;
  adapted: ReturnType<typeof adaptHtmlForWechat>;
  title: string;
  markdown: string;
  html: string;
  privateDomainCta: string;
};

const heldBrowsers: any[] = [];

function loginEvidence(overrides: Partial<WechatLoginResult['evidence']> = {}): WechatLoginResult['evidence'] {
  return {
    browserLaunched: false,
    loginPageOpened: false,
    qrVisible: false,
    loginDetected: false,
    sessionSaved: false,
    ...overrides,
  };
}

function validateEvidence(overrides: Partial<WechatSessionValidateResult['evidence']> = {}): WechatSessionValidateResult['evidence'] {
  return {
    sessionFileFound: false,
    browserLaunched: false,
    homePageOpened: false,
    loginRedirected: false,
    accountPageDetected: false,
    ...overrides,
  };
}

function probeEvidence(overrides: Partial<WechatProbeResult['evidence']> = {}): WechatProbeResult['evidence'] {
  return {
    sessionChecked: false,
    draftPageOpened: false,
    titleInputFound: false,
    editorFound: false,
    saveButtonFound: false,
    htmlPrepared: false,
    ...overrides,
  };
}

function injectEvidence(overrides: Partial<WechatInjectResult['evidence']> = {}): PocEvidence {
  return {
    sessionChecked: false,
    draftPageOpened: false,
    titleInputFound: false,
    editorFound: false,
    saveButtonFound: false,
    titleFilled: false,
    htmlPrepared: false,
    contentInjected: false,
    contentVisibleInEditor: false,
    contentRecognizedByWechat: false,
    editorTextLengthAfterInject: 0,
    editorHtmlLengthAfterInject: 0,
    wechatWordCountNumber: null as unknown as EvidenceValue,
    wechatWordCountText: null as unknown as EvidenceValue,
    injectionStrategy: null,
    saveClicked: false,
    draftSaved: false,
    ...overrides,
  };
}

function probeFailure(
  errorCode: WechatErrorCode,
  message: string,
  evidence = probeEvidence(),
  warnings: string[] = [],
  diagnostics?: PageDiagnostics,
  selectorReport: SelectorReport = { titleInput: 'not_found', editor: 'not_found', saveButton: 'not_found' },
): WechatProbeResult {
  setWechatRuntimeError(errorCode);
  return {
    success: false,
    message,
    errorCode,
    evidence,
    selectorReport,
    currentUrl: diagnostics?.currentUrl,
    pageTitle: diagnostics?.pageTitle,
    failedStep: diagnostics?.failedStep ?? null,
    diagnostics,
    warnings,
  };
}

function injectFailure(
  mode: WechatInjectResult['mode'],
  errorCode: WechatErrorCode,
  message: string,
  evidence: PocEvidence = injectEvidence(),
  warnings: string[] = [],
  diagnostics?: PageDiagnostics,
  runId?: string | null,
): WechatInjectResult {
  setWechatRuntimeError(errorCode);
  return { success: false, mode, runId, message, errorCode, evidence, warnings, diagnostics };
}

function runInProgressFailure(mode: WechatInjectResult['mode']) {
  const current = getCurrentWechatRun();
  return injectFailure(
    mode,
    'WECHAT_RUN_IN_PROGRESS',
    '已有微信自动化流程正在运行，请先完成或关闭当前窗口。',
    injectEvidence(),
    [],
    current ? {
      currentUrl: '',
      pageTitle: '',
      failedStep: 'run_in_progress',
      keepBrowserOpen: true,
      keepAliveUntil: current.keepAliveUntil,
    } : undefined,
    current?.runId ?? null,
  );
}

async function loadTask(publishTaskId: string) {
  if (!publishTaskId) return null;
  return prisma.publishTask.findUnique({
    where: { id: publishTaskId },
    include: { article: { include: { imageSlots: { orderBy: { paragraphIndex: 'asc' } }, topic: true } } },
  });
}

async function loadPackage(publishTaskId: string): Promise<LoadedPackage | null> {
  const task = await loadTask(publishTaskId);
  if (!task) return null;
  const pkg = await buildPublishPackagePayload(task.article, task);
  const stored = parseJsonField<Partial<{
    title: string;
    html: string;
    markdown: string;
    privateDomainCta: string;
    cta: string;
  }> | null>(task.packageJson, null);
  const markdown = stored?.markdown || task.outputMarkdown || task.article.markdown || pkg.markdown || '';
  const title = pickTitle(stored?.title, task.title, task.article.title, markdown, pkg.title);
  const privateDomainCta = stored?.privateDomainCta || stored?.cta || pkg.privateDomainCta || task.article.cta || '';
  const html =
    stored?.html ||
    task.outputHtml ||
    (stored?.markdown ? markdownToWechatHtml(stored.markdown, { cta: privateDomainCta, aiDisclosureEnabled: true, imageSlots: task.article.imageSlots }) : '') ||
    (task.article.markdown ? markdownToWechatHtml(task.article.markdown, { cta: privateDomainCta, aiDisclosureEnabled: true, imageSlots: task.article.imageSlots }) : '') ||
    pkg.html ||
    '';
  const adapted = adaptHtmlForWechat({ html, privateDomainCta });
  return { task, pkg, adapted, title, markdown, html, privateDomainCta };
}

function pickTitle(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const heading = trimmed.match(/^#\s+(.+)$/m)?.[1]?.trim();
    return heading || trimmed;
  }
  return '未命名草稿';
}

function isLoginUrl(url: string) {
  return /login|startlogin|mp\.weixin\.qq\.com\/$/i.test(url) && !/token=/i.test(url);
}

function isBackendUrl(url: string) {
  return /\/cgi-bin\//i.test(url) && /token=/i.test(url);
}

function sanitizeWechatUrl(url: string) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'mp.weixin.qq.com' && parsed.searchParams.has('token')) {
      parsed.searchParams.set('token', '[redacted]');
    }
    return parsed.toString();
  } catch {
    return url.replace(/([?&]token=)[^&]+/i, '$1[redacted]');
  }
}

async function hasLoginPrompt(page: any) {
  const selectors = ['a[href*="loginpage"]', 'text=请重新登录', 'text=登录'];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    const visible = await locator.isVisible({ timeout: 1000 }).catch(() => false);
    if (visible) return true;
  }
  return false;
}

async function detectCaptchaOrRisk(page: any): Promise<WechatErrorCode | null> {
  const captcha = await firstVisibleLocator(page, 'captchaOrRisk');
  if (!captcha.locator) return null;
  const url = page.url();
  if (/captcha|verify|security/i.test(url)) return 'WECHAT_CAPTCHA_DETECTED';
  return 'WECHAT_ACCOUNT_RISK';
}

async function pageDiagnostics(page: any, failedStep?: string | null, extra: Partial<PageDiagnostics> = {}): Promise<PageDiagnostics> {
  const currentUrl = typeof page?.url === 'function' ? sanitizeWechatUrl(page.url()) : '';
  const pageTitle = typeof page?.title === 'function'
    ? await page.title().catch(() => '')
    : '';
  const visibleTextSummary = await page.locator('body').innerText({ timeout: 1500 })
    .then((text: string) => text.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 30))
    .catch(() => []);
  const wc = await readWechatWordCount(page);
  return { currentUrl, pageTitle, failedStep: failedStep ?? null, visibleTextSummary, wechatWordCountText: wc.text, wechatWordCountNumber: wc.number, ...extra };
}

async function requireValidSession(): Promise<WechatSessionValidateResult> {
  return validateWechatSession();
}

async function openBrowserContext(playwright: any, useSession: boolean, forceHeadless?: boolean) {
  const config = getWechatConfig();
  const browser = await playwright.chromium.launch({ headless: forceHeadless ?? config.headless });
  const context = useSession
    ? await browser.newContext({ storageState: config.sessionPath })
    : await browser.newContext();
  const page = await context.newPage();
  return { browser, context, page };
}

export async function startWechatLogin(): Promise<WechatLoginResult> {
  const enabled = requireWechatEnabled();
  if (enabled.ok === false) {
    return { success: false, status: 'failed', message: enabled.message, errorCode: enabled.errorCode, evidence: loginEvidence() };
  }
  const runtime = await requireWechatRuntime();
  if (runtime.ok === false) {
    return { success: false, status: 'failed', message: runtime.message, errorCode: runtime.errorCode, evidence: loginEvidence() };
  }

  const config = getWechatConfig();
  const sessionPath = ensureSessionDir();
  let browser: any;
  const evidence = loginEvidence();
  try {
    const opened = await openBrowserContext(runtime.playwright, false, false);
    browser = opened.browser;
    const context = opened.context;
    const page = opened.page;
    evidence.browserLaunched = true;
    await page.goto('https://mp.weixin.qq.com/', { waitUntil: 'domcontentloaded', timeout: config.pageTimeoutMs });
    evidence.loginPageOpened = true;
    evidence.qrVisible = Boolean((await firstVisibleLocator(page, 'qrCode')).locator);

    const raceResult = await Promise.race([
      page.waitForURL((url: URL) => isBackendUrl(url.toString()), { timeout: config.loginTimeoutMs }).then(() => 'login'),
      page.waitForTimeout(config.loginTimeoutMs).then(() => 'timeout'),
    ]);

    if (raceResult !== 'login') {
      setWechatRuntimeError('WECHAT_LOGIN_TIMEOUT');
      return { success: false, status: 'login_timeout', message: '等待扫码登录超时，未保存微信 session。', errorCode: 'WECHAT_LOGIN_TIMEOUT', evidence };
    }
    evidence.loginDetected = true;
    const token = new URL(page.url()).searchParams.get('token');
    const risk = await detectCaptchaOrRisk(page);
    if (risk) {
      setWechatRuntimeError(risk);
      return { success: false, status: risk === 'WECHAT_CAPTCHA_DETECTED' ? 'captcha_required' : 'account_risk', message: '检测到验证码或账号风险提示，请人工处理。', errorCode: risk, evidence };
    }

    await page.waitForLoadState('domcontentloaded', { timeout: config.pageTimeoutMs }).catch(() => undefined);
    await page.waitForTimeout(3000);
    const verifyUrl = token
      ? `https://mp.weixin.qq.com/cgi-bin/home?t=home/index&token=${encodeURIComponent(token)}&lang=zh_CN`
      : 'https://mp.weixin.qq.com/cgi-bin/home?t=home/index';
    await page.goto(verifyUrl, { waitUntil: 'domcontentloaded', timeout: config.pageTimeoutMs }).catch(() => undefined);
    await page.waitForTimeout(2500);
    if (await hasLoginPrompt(page)) {
      setWechatRuntimeError('WECHAT_SESSION_EXPIRED');
      return { success: false, status: 'failed', message: '扫码后未能确认后台登录态，未保存微信 session。', errorCode: 'WECHAT_SESSION_EXPIRED', evidence };
    }
    await context.storageState({ path: sessionPath });
    saveWechatSessionMeta({ token, savedAt: new Date().toISOString() });
    evidence.sessionSaved = true;
    setWechatRuntimeError(null);
    return { success: true, status: 'session_valid', message: '扫码登录完成，已保存本地 session。', errorCode: null, evidence };
  } catch (error) {
    setWechatRuntimeError('WECHAT_LOGIN_TIMEOUT');
    return { success: false, status: 'failed', message: error instanceof Error ? error.message : '微信扫码登录 PoC 失败。', errorCode: 'WECHAT_LOGIN_TIMEOUT', evidence };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

export async function validateWechatSession(): Promise<WechatSessionValidateResult> {
  const enabled = requireWechatEnabled();
  const evidence = validateEvidence({ sessionFileFound: hasSessionFile() });
  if (enabled.ok === false) {
    return { success: false, status: 'failed', message: enabled.message, errorCode: enabled.errorCode, evidence };
  }
  const runtime = await requireWechatRuntime();
  if (runtime.ok === false) {
    return { success: false, status: 'failed', message: runtime.message, errorCode: runtime.errorCode, evidence };
  }
  if (!hasSessionFile()) {
    setWechatRuntimeError('WECHAT_LOGIN_REQUIRED');
    return { success: false, status: 'need_login', message: '未检测到微信 session，请先扫码登录。', errorCode: 'WECHAT_LOGIN_REQUIRED', evidence };
  }

  let browser: any;
  try {
    const opened = await openBrowserContext(runtime.playwright, true, true);
    browser = opened.browser;
    const page = opened.page;
    evidence.browserLaunched = true;
    const token = readWechatSessionMeta()?.token;
    const homeUrl = token
      ? `https://mp.weixin.qq.com/cgi-bin/home?t=home/index&token=${encodeURIComponent(token)}&lang=zh_CN`
      : 'https://mp.weixin.qq.com/cgi-bin/home?t=home/index';
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: getWechatConfig().pageTimeoutMs });
    await page.waitForTimeout(2500);
    evidence.homePageOpened = true;
    evidence.loginRedirected = isLoginUrl(page.url()) || await hasLoginPrompt(page);
    const risk = await detectCaptchaOrRisk(page);
    if (risk) {
      setWechatRuntimeError(risk);
      return { success: false, status: 'failed', message: '检测到验证码或账号风险提示，请人工处理。', errorCode: risk, evidence };
    }
    evidence.accountPageDetected = !evidence.loginRedirected && (isBackendUrl(page.url()) || Boolean((await firstVisibleLocator(page, 'accountHome')).locator));
    if (evidence.loginRedirected || !evidence.accountPageDetected) {
      setWechatRuntimeError('WECHAT_SESSION_EXPIRED');
      return { success: false, status: 'session_expired', message: '微信 session 已失效，需要重新扫码登录。', errorCode: 'WECHAT_SESSION_EXPIRED', evidence };
    }
    setWechatRuntimeError(null);
    return { success: true, status: 'session_valid', message: '微信 session 校验通过。', errorCode: null, evidence };
  } catch (error) {
    setWechatRuntimeError('WECHAT_PAGE_LOAD_TIMEOUT');
    return { success: false, status: 'failed', message: error instanceof Error ? error.message : '微信 session 校验失败。', errorCode: 'WECHAT_PAGE_LOAD_TIMEOUT', evidence };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

async function openDraftPage(runtime: { playwright: any }) {
  const opened = await openBrowserContext(runtime.playwright, true);
  const page = opened.page;
  const savedToken = readWechatSessionMeta()?.token;
  const homeUrl = savedToken
    ? `https://mp.weixin.qq.com/cgi-bin/home?t=home/index&token=${encodeURIComponent(savedToken)}&lang=zh_CN`
    : 'https://mp.weixin.qq.com/cgi-bin/home?t=home/index';
  await page.goto(homeUrl, {
    waitUntil: 'domcontentloaded',
    timeout: getWechatConfig().pageTimeoutMs,
  });
  if (isLoginUrl(page.url())) return opened;
  const token = new URL(page.url()).searchParams.get('token') || savedToken;
  const draftUrl = token
    ? `https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit&action=edit&type=10&isMul=1&token=${encodeURIComponent(token)}&lang=zh_CN`
    : 'https://mp.weixin.qq.com/cgi-bin/appmsg?t=media/appmsg_edit';
  await page.goto(draftUrl, {
    waitUntil: 'domcontentloaded',
    timeout: getWechatConfig().pageTimeoutMs,
  });
  return opened;
}

async function inspectEditor(page: any) {
  const title = await firstVisibleLocator(page, 'titleInput');
  const editor = await firstVisibleLocator(page, 'editor');
  const save = await firstVisibleLocator(page, 'saveButton');
  return {
    title,
    editor,
    save,
    selectorReport: {
      titleInput: title.locator ? 'found' as const : 'not_found' as const,
      editor: editor.locator ? 'found' as const : 'not_found' as const,
      saveButton: save.locator ? 'found' as const : 'not_found' as const,
      candidates: {
        titleInput: title.report,
        editor: editor.report,
        saveButton: save.report,
      },
    },
  };
}

export async function probeWechatEditor(publishTaskId: string): Promise<WechatProbeResult> {
  const enabled = requireWechatEnabled();
  if (enabled.ok === false) return probeFailure(enabled.errorCode, enabled.message);
  const runtime = await requireWechatRuntime();
  if (runtime.ok === false) return probeFailure(runtime.errorCode, runtime.message);
  if (!hasSessionFile()) return probeFailure('WECHAT_LOGIN_REQUIRED', '未检测到微信 session，请先扫码登录。');

  const loaded = await loadPackage(publishTaskId);
  if (!loaded) return probeFailure('WECHAT_UNKNOWN_ERROR', 'PublishTask 不存在。');
  const session = await requireValidSession();
  if (!session.success) {
    return probeFailure(
      session.errorCode || 'WECHAT_SESSION_EXPIRED',
      session.message,
      probeEvidence({ sessionChecked: false, htmlPrepared: Boolean(loaded.adapted.html) }),
      loaded.adapted.warnings,
      { currentUrl: '', pageTitle: '', failedStep: 'session_validate' },
    );
  }
  const evidence = probeEvidence({ sessionChecked: true, htmlPrepared: Boolean(loaded.adapted.html) });
  let browser: any;
  try {
    const opened = await openDraftPage(runtime);
    browser = opened.browser;
    const page = opened.page;
    evidence.draftPageOpened = true;
    if (isLoginUrl(page.url())) {
      return probeFailure('WECHAT_SESSION_EXPIRED', '微信 session 已失效，需要重新扫码登录。', evidence, loaded.adapted.warnings, await pageDiagnostics(page, 'open_draft_page'));
    }
    const inspected = await inspectEditor(page);
    evidence.titleInputFound = inspected.selectorReport.titleInput === 'found';
    evidence.editorFound = inspected.selectorReport.editor === 'found';
    evidence.saveButtonFound = inspected.selectorReport.saveButton === 'found';
    const success = evidence.titleInputFound && evidence.editorFound && evidence.saveButtonFound;
    setWechatEditorReachable(success);
    setWechatRuntimeError(success ? null : 'WECHAT_EDITOR_NOT_FOUND');
    await recordWechatPocRun(publishTaskId, 'probe', success, success ? null : 'WECHAT_EDITOR_NOT_FOUND', evidence, success ? '编辑器探测通过。' : '编辑器探测未通过。', loaded.title, null);
    return {
      success,
      message: success ? '编辑器探测通过：标题、正文编辑器、保存按钮均可达。' : '已打开草稿页，但未完整定位标题、编辑器或保存按钮。',
      errorCode: success ? null : 'WECHAT_EDITOR_NOT_FOUND',
      evidence,
      selectorReport: inspected.selectorReport,
      currentUrl: sanitizeWechatUrl(page.url()),
      pageTitle: await page.title().catch(() => ''),
      failedStep: success ? null : 'inspect_editor',
      diagnostics: await pageDiagnostics(page, success ? null : 'inspect_editor', {
        htmlLength: loaded.adapted.html.length,
        textLength: loaded.adapted.textFallback.length,
      }),
      warnings: loaded.adapted.warnings,
      recentRuns: await getWechatPocRuns(publishTaskId),
    };
  } catch (error) {
    setWechatRuntimeError('WECHAT_PAGE_LOAD_TIMEOUT');
    return {
      success: false,
      message: error instanceof Error ? error.message : '微信草稿页探测失败。',
      errorCode: 'WECHAT_PAGE_LOAD_TIMEOUT',
      evidence,
      selectorReport: { titleInput: 'not_found', editor: 'not_found', saveButton: 'not_found' },
      failedStep: 'open_or_inspect_draft_page',
      diagnostics: browser ? undefined : { currentUrl: '', pageTitle: '', failedStep: 'open_or_inspect_draft_page' },
      warnings: loaded.adapted.warnings,
    };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

async function fillTitle(titleLocator: any, title: string) {
  const expected = title.trim();
  await titleLocator.click({ timeout: 5000 }).catch(() => undefined);
  await titleLocator.fill('', { timeout: 5000 }).catch(async () => {
    await titleLocator.evaluate((node: HTMLElement) => {
      if ('value' in node) (node as HTMLInputElement).value = '';
      else node.textContent = '';
      node.dispatchEvent(new InputEvent('input', { bubbles: true, data: null }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  await titleLocator.fill(expected, { timeout: 5000 }).catch(async () => {
    await titleLocator.evaluate((node: HTMLElement, value: string) => {
      if ('value' in node) (node as HTMLInputElement).value = value;
      else node.textContent = value;
      node.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
      node.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: value }));
    }, expected);
  });
  const actual = await titleLocator.evaluate((node: HTMLElement) => {
    if ('value' in node) return (node as HTMLInputElement).value;
    return node.textContent || '';
  }).catch(() => '');
  return actual.trim() === expected;
}

async function editorTextLength(editorLocator: any) {
  return editorLocator.evaluate((node: HTMLElement) => (node.innerText || node.textContent || '').trim().length).catch(() => 0);
}

async function editorHtmlLength(editorLocator: any) {
  return editorLocator.evaluate((node: HTMLElement) => (node.innerHTML || '').trim().length).catch(() => 0);
}

async function readWechatWordCount(page: any): Promise<{ text: string | null; number: number | null }> {
  try {
    const result = await page.evaluate(() => {
      function extractWordCount(text: string) {
        const normalized = text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
        const patterns = [
          /正文字数[：:\s]*(\d+)/,
          /正文[^\d]{0,8}(\d+)\s*字/,
          /字数[：:\s]*(\d+)/,
          /已输入[：:\s]*(\d+)\s*字/,
          /(\d+)\s*\/\s*\d+\s*字/,
        ];
        for (const pattern of patterns) {
          const match = normalized.match(pattern);
          if (match) return { text: match[0], number: parseInt(match[1], 10) };
        }
        return { text: null, number: null };
      }

      const body = document.body;
      if (!body) return { text: null, number: null };
      const allText = body.innerText || '';
      const bodyMatch = extractWordCount(allText);
      if (bodyMatch.number !== null) return bodyMatch;

      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        const nodeText = node.textContent || '';
        const nodeMatch = extractWordCount(nodeText);
        if (nodeMatch.number !== null) return nodeMatch;
      }
      return { text: null, number: null };
    });
    return result;
  } catch {
    return { text: null, number: null };
  }
}

type InjectResult = {
  success: boolean;
  strategy: InjectionStrategy;
  editorTextLengthAfterInject: number;
  editorHtmlLengthAfterInject: number;
  wechatWordCountText: string | null;
  wechatWordCountNumber: number | null;
  contentRecognizedByWechat: boolean;
};

async function injectHtml(page: any, editorLocator: any, html: string, textFallback: string, warnings: string[]): Promise<InjectResult> {
  const platform = process.platform === 'darwin' ? 'Meta' : 'Control';

  // Strategy 1: Real clipboard HTML paste (most reliable for WeChat internal state)
  try {
    warnings.push('正在通过剪贴板粘贴 HTML（优先策略）。');
    await editorLocator.click({ timeout: 5000 });
    await page.waitForTimeout(300);
    await page.keyboard.press(`${platform}+A`).catch(() => undefined);
    await page.waitForTimeout(100);
    await page.evaluate(async (value: string) => {
      const clipboardItem = typeof ClipboardItem !== 'undefined'
        ? new ClipboardItem({
            'text/html': new Blob([value], { type: 'text/html' }),
            'text/plain': new Blob([value.replace(/<[^>]+>/g, ' ')], { type: 'text/plain' }),
          })
        : null;
      if (clipboardItem && navigator.clipboard?.write) await navigator.clipboard.write([clipboardItem]);
      else await navigator.clipboard.writeText(value);
    }, html);
    await page.keyboard.press(`${platform}+V`);
    await page.waitForTimeout(1500);
    // Trigger additional events to ensure WeChat internal state updates
    await editorLocator.evaluate((node: HTMLElement) => {
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
      node.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
    }).catch(() => undefined);
    await page.waitForTimeout(800);
    const textLen = await editorTextLength(editorLocator);
    const htmlLen = await editorHtmlLength(editorLocator);
    const wc = await readWechatWordCount(page);
    if (textLen > 50 && (wc.number === null || wc.number > 0)) {
      return { success: true, strategy: 'clipboard_html', editorTextLengthAfterInject: textLen, editorHtmlLengthAfterInject: htmlLen, wechatWordCountText: wc.text, wechatWordCountNumber: wc.number, contentRecognizedByWechat: wc.number !== null ? wc.number > 0 : true };
    }
    warnings.push(`剪贴板粘贴后：textLen=${textLen}, wordCount=${wc.number}。`);
  } catch (e) {
    warnings.push(`剪贴板粘贴异常：${e instanceof Error ? e.message : 'unknown'}`);
  }

  // Strategy 2: Simulated keyboard input (plain text fallback)
  try {
    warnings.push('正在使用纯文本键盘输入（兜底策略）。');
    await editorLocator.click({ timeout: 5000 });
    await page.waitForTimeout(200);
    await page.keyboard.press(`${platform}+A`).catch(() => undefined);
    await page.keyboard.insertText(textFallback);
    await page.waitForTimeout(1200);
    await editorLocator.evaluate((node: HTMLElement) => {
      node.dispatchEvent(new Event('input', { bubbles: true }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
    }).catch(() => undefined);
    await page.waitForTimeout(500);
    const textLen = await editorTextLength(editorLocator);
    const htmlLen = await editorHtmlLength(editorLocator);
    const wc = await readWechatWordCount(page);
    if (textLen > 0 && (wc.number === null || wc.number > 0)) {
      return { success: true, strategy: 'text_fallback', editorTextLengthAfterInject: textLen, editorHtmlLengthAfterInject: htmlLen, wechatWordCountText: wc.text, wechatWordCountNumber: wc.number, contentRecognizedByWechat: wc.number !== null ? wc.number > 0 : true };
    }
    warnings.push(`纯文本输入后：textLen=${textLen}, wordCount=${wc.number}。`);
  } catch (e) {
    warnings.push(`纯文本输入异常：${e instanceof Error ? e.message : 'unknown'}`);
  }

  // Strategy 3: DOM innerHTML injection (last resort - visual only, WeChat may not recognize)
  try {
    warnings.push('正在使用 DOM innerHTML 注入（最后手段，微信可能不识别）。');
    await editorLocator.evaluate((node: HTMLElement, value: string) => {
      node.focus();
      node.innerHTML = value;
      node.dispatchEvent(new InputEvent('input', { bubbles: true, data: value }));
      node.dispatchEvent(new Event('change', { bubbles: true }));
      node.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: value }));
    }, html);
    await page.waitForTimeout(1000);
    const textLen = await editorTextLength(editorLocator);
    const htmlLen = await editorHtmlLength(editorLocator);
    const wc = await readWechatWordCount(page);
    if (textLen > 50 && (wc.number === null || wc.number > 0)) {
      return { success: true, strategy: 'dom_html', editorTextLengthAfterInject: textLen, editorHtmlLengthAfterInject: htmlLen, wechatWordCountText: wc.text, wechatWordCountNumber: wc.number, contentRecognizedByWechat: wc.number !== null ? wc.number > 0 : true };
    }
    // DOM injection shows content but WeChat doesn't recognize it
    if (textLen > 50 && wc.number === 0) {
      return { success: false, strategy: 'dom_html', editorTextLengthAfterInject: textLen, editorHtmlLengthAfterInject: htmlLen, wechatWordCountText: wc.text, wechatWordCountNumber: 0, contentRecognizedByWechat: false };
    }
    warnings.push(`DOM 注入后：textLen=${textLen}, wordCount=${wc.number}。`);
  } catch (e) {
    warnings.push(`DOM 注入异常：${e instanceof Error ? e.message : 'unknown'}`);
  }

  return { success: false, strategy: null, editorTextLengthAfterInject: 0, editorHtmlLengthAfterInject: 0, wechatWordCountText: null, wechatWordCountNumber: null, contentRecognizedByWechat: false };
}

async function saveSuccessDetected(page: any) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10000) {
    const risk = await detectCaptchaOrRisk(page);
    if (risk) return { saved: false, errorCode: risk, feedbackText: null };
    const match = await firstVisibleLocator(page, 'saveSuccess');
    if (match.locator) {
      const visible = await match.locator.isVisible({ timeout: 1000 }).catch(() => true);
      if (visible) {
        const feedbackText = await match.locator.innerText({ timeout: 1000 }).catch(() => match.candidate?.name || 'save success');
        return { saved: true, errorCode: null, feedbackText };
      }
    }
    await page.waitForTimeout(1000);
  }
  return { saved: false, errorCode: null, feedbackText: null };
}

async function prepareDraftForInjection(publishTaskId: string, mode: WechatInjectResult['mode']) {
  const enabled = requireWechatEnabled();
  if (enabled.ok === false) return { error: injectFailure(mode, enabled.errorCode, enabled.message) };
  const runtime = await requireWechatRuntime();
  if (runtime.ok === false) return { error: injectFailure(mode, runtime.errorCode, runtime.message) };
  if (!hasSessionFile()) return { error: injectFailure(mode, 'WECHAT_LOGIN_REQUIRED', '未检测到微信 session，请先扫码登录。') };
  const loaded = await loadPackage(publishTaskId);
  if (!loaded) return { error: injectFailure(mode, 'WECHAT_UNKNOWN_ERROR', 'PublishTask 不存在。') };
  const session = await requireValidSession();
  if (!session.success) {
    return {
      error: injectFailure(
        mode,
        session.errorCode || 'WECHAT_SESSION_EXPIRED',
        session.message,
        injectEvidence({ sessionChecked: false, htmlPrepared: Boolean(loaded.adapted.html) }),
        loaded.adapted.warnings,
        { currentUrl: '', pageTitle: '', failedStep: 'session_validate' },
      ),
    };
  }
  return { runtime, loaded };
}

export async function injectWechatDraftPoc(publishTaskId: string): Promise<WechatInjectResult> {
  const prepared = await prepareDraftForInjection(publishTaskId, 'inject_poc');
  if (prepared.error) return prepared.error;
  const { runtime, loaded } = prepared;

  const evidence = injectEvidence({ sessionChecked: true, htmlPrepared: Boolean(loaded.adapted.html) });
  const warnings = [...loaded.adapted.warnings];
  let browser: any;
  let keepOpen = false;
  try {
    const opened = await openDraftPage(runtime);
    browser = opened.browser;
    const page = opened.page;
    evidence.draftPageOpened = true;
    if (isLoginUrl(page.url())) return injectFailure('inject_poc', 'WECHAT_SESSION_EXPIRED', '微信 session 已失效，需要重新扫码登录。', evidence, warnings, await pageDiagnostics(page, 'open_draft_page'));
    const inspected = await inspectEditor(page);
    evidence.titleInputFound = Boolean(inspected.title.locator);
    evidence.editorFound = Boolean(inspected.editor.locator);
    evidence.saveButtonFound = Boolean(inspected.save.locator);
    if (!inspected.title.locator || !inspected.editor.locator) {
      return injectFailure('inject_poc', 'WECHAT_EDITOR_NOT_FOUND', '未找到标题输入框或正文编辑器。', evidence, warnings, await pageDiagnostics(page, 'inspect_editor', {
        htmlLength: loaded.adapted.html.length,
        textLength: loaded.adapted.textFallback.length,
      }));
    }
    evidence.titleFilled = await fillTitle(inspected.title.locator, loaded.title);
    if (!evidence.titleFilled) {
      return injectFailure('inject_poc', 'WECHAT_TITLE_FILL_FAILED', '标题填入后校验失败，未保存草稿。', evidence, warnings, await pageDiagnostics(page, 'fill_title', {
        htmlLength: loaded.adapted.html.length,
        textLength: loaded.adapted.textFallback.length,
      }));
    }
    const injected = await injectHtml(page, inspected.editor.locator, loaded.adapted.html, loaded.adapted.textFallback, warnings);
    evidence.contentInjected = injected.success;
    evidence.contentVisibleInEditor = injected.editorTextLengthAfterInject > 50;
    evidence.contentRecognizedByWechat = injected.contentRecognizedByWechat;
    evidence.editorTextLengthAfterInject = injected.editorTextLengthAfterInject;
    evidence.editorHtmlLengthAfterInject = injected.editorHtmlLengthAfterInject;
    evidence.wechatWordCountNumber = injected.wechatWordCountNumber;
    evidence.wechatWordCountText = injected.wechatWordCountText;
    evidence.injectionStrategy = injected.strategy;
    const diagnostics = await pageDiagnostics(page, injected.success ? null : 'inject_content', {
      htmlLength: loaded.adapted.html.length,
      textLength: loaded.adapted.textFallback.length,
      editorTextLengthAfterInject: injected.editorTextLengthAfterInject,
    });
    if (!evidence.contentInjected) {
      if (injected.editorTextLengthAfterInject > 50 && injected.wechatWordCountNumber === 0) {
        return { success: false, mode: 'inject_poc', message: '正文已写入页面 DOM，但微信编辑器未识别正文内容（正文字数 0），已阻止保存。', errorCode: 'WECHAT_EDITOR_STATE_NOT_SYNCED', evidence, warnings, diagnostics };
      }
      return { success: false, mode: 'inject_poc', message: 'HTML 注入失败，未保存草稿。', errorCode: 'WECHAT_INJECT_FAILED', evidence, warnings, diagnostics };
    }
    setWechatRuntimeError(null);
    await recordWechatPocRun(publishTaskId, 'inject_poc', true, null, evidence, 'HTML 注入测试通过，尚未保存草稿。', loaded.title, injected.strategy);
    keepOpen = true;
    heldBrowsers.push(browser);
    return { success: true, mode: 'inject_poc', message: 'HTML 注入测试通过，页面保持打开，尚未保存草稿。', errorCode: null, evidence, warnings, diagnostics, recentRuns: await getWechatPocRuns(publishTaskId) };
  } catch (error) {
    setWechatRuntimeError('WECHAT_INJECT_FAILED');
    return { success: false, mode: 'inject_poc', message: error instanceof Error ? error.message : 'HTML 注入测试失败。', errorCode: 'WECHAT_INJECT_FAILED', evidence, warnings };
  } finally {
    if (browser && !keepOpen) await browser.close().catch(() => undefined);
  }
}

export async function saveWechatDraftPoc(publishTaskId: string, confirm: boolean): Promise<WechatInjectResult> {
  if (confirm !== true) {
    return injectFailure('draft_save_poc', 'WECHAT_CONFIRM_REQUIRED', '必须 confirm=true 才允许执行真实保存草稿 PoC。');
  }
  const prepared = await prepareDraftForInjection(publishTaskId, 'draft_save_poc');
  if (prepared.error) return prepared.error;
  const { runtime, loaded } = prepared;

  const evidence = injectEvidence({ sessionChecked: true, htmlPrepared: Boolean(loaded.adapted.html) });
  const warnings = [...loaded.adapted.warnings];
  let browser: any;
  try {
    const opened = await openDraftPage(runtime);
    browser = opened.browser;
    const page = opened.page;
    evidence.draftPageOpened = true;
    if (isLoginUrl(page.url())) return injectFailure('draft_save_poc', 'WECHAT_SESSION_EXPIRED', '微信 session 已失效，需要重新扫码登录。', evidence, warnings, await pageDiagnostics(page, 'open_draft_page'));
    const inspected = await inspectEditor(page);
    evidence.titleInputFound = Boolean(inspected.title.locator);
    evidence.editorFound = Boolean(inspected.editor.locator);
    evidence.saveButtonFound = Boolean(inspected.save.locator);
    if (!inspected.title.locator || !inspected.editor.locator || !inspected.save.locator) {
      return injectFailure('draft_save_poc', 'WECHAT_EDITOR_NOT_FOUND', '未完整定位标题、编辑器或保存按钮。', evidence, warnings, await pageDiagnostics(page, 'inspect_editor', {
        htmlLength: loaded.adapted.html.length,
        textLength: loaded.adapted.textFallback.length,
      }));
    }
    evidence.titleFilled = await fillTitle(inspected.title.locator, loaded.title);
    if (!evidence.titleFilled) {
      return injectFailure('draft_save_poc', 'WECHAT_TITLE_FILL_FAILED', '标题填入后校验失败，未点击保存。', evidence, warnings, await pageDiagnostics(page, 'fill_title', {
        htmlLength: loaded.adapted.html.length,
        textLength: loaded.adapted.textFallback.length,
      }));
    }
    const injected = await injectHtml(page, inspected.editor.locator, loaded.adapted.html, loaded.adapted.textFallback, warnings);
    evidence.contentInjected = injected.success;
    evidence.contentVisibleInEditor = injected.editorTextLengthAfterInject > 50;
    evidence.contentRecognizedByWechat = injected.contentRecognizedByWechat;
    evidence.editorTextLengthAfterInject = injected.editorTextLengthAfterInject;
    evidence.editorHtmlLengthAfterInject = injected.editorHtmlLengthAfterInject;
    evidence.wechatWordCountNumber = injected.wechatWordCountNumber;
    evidence.wechatWordCountText = injected.wechatWordCountText;
    evidence.injectionStrategy = injected.strategy;
    let diagnostics = await pageDiagnostics(page, injected.success ? null : 'inject_content', {
      htmlLength: loaded.adapted.html.length,
      textLength: loaded.adapted.textFallback.length,
      editorTextLengthAfterInject: injected.editorTextLengthAfterInject,
    });
    if (!evidence.contentInjected) {
      if (injected.editorTextLengthAfterInject > 50 && injected.wechatWordCountNumber === 0) {
        return { success: false, mode: 'draft_save_poc', message: '正文已写入页面 DOM，但微信编辑器未识别正文内容（正文字数 0），已阻止保存。', errorCode: 'WECHAT_EDITOR_STATE_NOT_SYNCED', evidence, warnings, diagnostics };
      }
      return { success: false, mode: 'draft_save_poc', message: 'HTML 注入失败，未点击保存。', errorCode: 'WECHAT_INJECT_FAILED', evidence, warnings, diagnostics };
    }
    // Pre-save: block if WeChat word count is explicitly 0
    if (injected.wechatWordCountNumber === 0) {
      return { success: false, mode: 'draft_save_poc', message: '正文已写入页面 DOM，但微信编辑器正文字数为 0，已阻止保存空草稿。', errorCode: 'WECHAT_EDITOR_STATE_NOT_SYNCED', evidence, warnings, diagnostics };
    }
    await inspected.save.locator.click({ timeout: 10000 });
    evidence.saveClicked = true;
    const legacySaveResult = await saveSuccessDetected(page);
    evidence.draftSaved = legacySaveResult.saved;
    if (!evidence.draftSaved) {
      diagnostics = await pageDiagnostics(page, 'detect_save_result', diagnostics);
      setWechatRuntimeError('WECHAT_SAVE_RESULT_UNKNOWN');
      await recordWechatPocRun(publishTaskId, 'draft_save_poc', false, 'WECHAT_SAVE_RESULT_UNKNOWN', evidence, '已点击保存，但未检测到微信保存成功反馈。', loaded.title, injected.strategy);
      return { success: false, mode: 'draft_save_poc', message: '已点击保存，但未检测到微信保存成功反馈，不能判定为草稿已保存。', errorCode: 'WECHAT_SAVE_RESULT_UNKNOWN', evidence, warnings, draftId: null, diagnostics, recentRuns: await getWechatPocRuns(publishTaskId) };
    }
    setWechatRuntimeError(null);
    diagnostics = await pageDiagnostics(page, null, diagnostics);
    await recordWechatPocRun(publishTaskId, 'draft_save_poc', true, null, evidence, '微信草稿保存 PoC 成功。微信未暴露可读取草稿 ID。', loaded.title, injected.strategy);
    return { success: true, mode: 'draft_save_poc', message: '微信草稿保存 PoC 成功。未群发，未定时发布；微信未暴露可读取草稿 ID。', errorCode: null, evidence, warnings, draftId: null, diagnostics, recentRuns: await getWechatPocRuns(publishTaskId) };
  } catch (error) {
    setWechatRuntimeError('WECHAT_SAVE_FAILED');
    await recordWechatPocRun(publishTaskId, 'draft_save_poc', false, 'WECHAT_SAVE_FAILED', evidence, error instanceof Error ? error.message : '保存草稿 PoC 失败。', loaded.title, evidence.injectionStrategy as InjectionStrategy);
    return { success: false, mode: 'draft_save_poc', message: error instanceof Error ? error.message : '保存草稿 PoC 失败。', errorCode: 'WECHAT_SAVE_FAILED', evidence, warnings, recentRuns: await getWechatPocRuns(publishTaskId) };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

export async function injectWechatDraftPocStable(publishTaskId: string): Promise<WechatInjectResult> {
  if (hasActiveWechatRun()) return runInProgressFailure('inject_poc');
  const prepared = await prepareDraftForInjection(publishTaskId, 'inject_poc');
  if (prepared.error) return prepared.error;
  const { runtime, loaded } = prepared;
  const run = createWechatRun(publishTaskId, 'inject_poc');
  const evidence = injectEvidence({ sessionChecked: true, htmlPrepared: Boolean(loaded.adapted.html) });
  const warnings = [...loaded.adapted.warnings];

  try {
    const opened = await openDraftPage(runtime);
    attachWechatRunBrowser(run, opened);
    const page = opened.page;
    evidence.draftPageOpened = true;
    if (isLoginUrl(page.url())) {
      await failWechatRun(run, 'WECHAT_SESSION_EXPIRED');
      return injectFailure('inject_poc', 'WECHAT_SESSION_EXPIRED', '微信 session 已失效，需要重新扫码登录。', evidence, warnings, await pageDiagnostics(page, 'open_draft_page'), run.state.runId);
    }

    const inspected = await inspectEditor(page);
    evidence.titleInputFound = Boolean(inspected.title.locator);
    evidence.editorFound = Boolean(inspected.editor.locator);
    evidence.saveButtonFound = Boolean(inspected.save.locator);
    if (!inspected.title.locator || !inspected.editor.locator) {
      await failWechatRun(run, 'WECHAT_EDITOR_NOT_FOUND');
      return injectFailure('inject_poc', 'WECHAT_EDITOR_NOT_FOUND', '未找到标题输入框或正文编辑器。', evidence, warnings, await pageDiagnostics(page, 'inspect_editor', {
        htmlLength: loaded.adapted.html.length,
        textLength: loaded.adapted.textFallback.length,
      }), run.state.runId);
    }

    evidence.titleFilled = await fillTitle(inspected.title.locator, loaded.title);
    updateWechatRun(run, { titleFilled: Boolean(evidence.titleFilled) });
    if (!evidence.titleFilled) {
      await failWechatRun(run, 'WECHAT_TITLE_FILL_FAILED');
      return injectFailure('inject_poc', 'WECHAT_TITLE_FILL_FAILED', '标题填入失败。', evidence, warnings, await pageDiagnostics(page, 'fill_title', {
        htmlLength: loaded.adapted.html.length,
        textLength: loaded.adapted.textFallback.length,
      }), run.state.runId);
    }

    const injected = await injectHtml(page, inspected.editor.locator, loaded.adapted.html, loaded.adapted.textFallback, warnings);
    evidence.contentInjected = injected.success;
    evidence.contentVisibleInEditor = injected.editorTextLengthAfterInject > 50;
    evidence.contentRecognizedByWechat = injected.contentRecognizedByWechat;
    evidence.editorTextLengthAfterInject = injected.editorTextLengthAfterInject;
    evidence.editorHtmlLengthAfterInject = injected.editorHtmlLengthAfterInject;
    evidence.wechatWordCountNumber = injected.wechatWordCountNumber;
    evidence.wechatWordCountText = injected.wechatWordCountText;
    evidence.injectionStrategy = injected.strategy;
    updateWechatRun(run, { contentInjected: injected.success, injectionStrategy: injected.strategy });
    let diagnostics = await pageDiagnostics(page, injected.success ? null : 'inject_content', {
      htmlLength: loaded.adapted.html.length,
      textLength: loaded.adapted.textFallback.length,
      editorTextLengthAfterInject: injected.editorTextLengthAfterInject,
    });

    if (!injected.success) {
      if (injected.editorTextLengthAfterInject > 50 && injected.wechatWordCountNumber === 0) {
        await failWechatRun(run, 'WECHAT_EDITOR_STATE_NOT_SYNCED');
        return { success: false, mode: 'inject_poc', runId: run.state.runId, message: '正文已写入页面 DOM，但微信编辑器未识别正文内容（正文字数 0），已阻止保存。', errorCode: 'WECHAT_EDITOR_STATE_NOT_SYNCED', evidence, warnings, diagnostics };
      }
      await failWechatRun(run, 'WECHAT_INJECT_FAILED');
      return { success: false, mode: 'inject_poc', runId: run.state.runId, message: '正文注入失败。', errorCode: 'WECHAT_INJECT_FAILED', evidence, warnings, diagnostics };
    }

    const keepOpen = getWechatConfig().keepBrowserOpenAfterInject;
    const state = keepOpen ? keepWechatRunOpen(run, 'waiting_user_review') : updateWechatRun(run, { status: 'closed' });
    diagnostics = { ...diagnostics, keepBrowserOpen: keepOpen, keepAliveUntil: state?.keepAliveUntil ?? null };
    setWechatRuntimeError(null);
    await recordWechatPocRun(publishTaskId, 'inject_poc', true, null, evidence, 'HTML 注入测试通过，尚未保存草稿。', loaded.title, injected.strategy, run.state.runId, keepOpen, false);
    if (!keepOpen) await closeWechatRun(run.state.runId);
    return {
      success: true,
      mode: 'inject_poc',
      runId: run.state.runId,
      message: 'HTML 注入测试通过，页面保持打开，尚未保存草稿。',
      errorCode: null,
      evidence,
      warnings,
      diagnostics,
      recentRuns: await getWechatPocRuns(publishTaskId),
    };
  } catch (error) {
    setWechatRuntimeError('WECHAT_INJECT_FAILED');
    await failWechatRun(run, 'WECHAT_INJECT_FAILED');
    return { success: false, mode: 'inject_poc', runId: run.state.runId, message: error instanceof Error ? error.message : 'HTML 注入测试失败。', errorCode: 'WECHAT_INJECT_FAILED', evidence, warnings };
  }
}

export async function saveWechatDraftPocStable(publishTaskId: string, confirm: boolean, runId?: string): Promise<WechatInjectResult> {
  if (confirm !== true) {
    return injectFailure('draft_save_poc', 'WECHAT_CONFIRM_REQUIRED', '必须 confirm=true 才允许执行真实保存草稿 PoC。');
  }
  if (hasActiveWechatRun(runId)) return runInProgressFailure('draft_save_poc');
  const prepared = await prepareDraftForInjection(publishTaskId, 'draft_save_poc');
  if (prepared.error) return prepared.error;
  const { runtime, loaded } = prepared;
  const evidence = injectEvidence({ sessionChecked: true, htmlPrepared: Boolean(loaded.adapted.html) });
  const warnings = [...loaded.adapted.warnings];
  let run = runId ? getActiveWechatRun(runId) : null;
  let createdRun = false;

  try {
    if (run && run.state.publishTaskId !== publishTaskId) {
      return injectFailure('draft_save_poc', 'WECHAT_PAGE_LOST', '页面状态丢失，请重新探测编辑器。', evidence, warnings, undefined, runId);
    }
    if (run && (!run.page || run.page.isClosed?.())) {
      return injectFailure('draft_save_poc', 'WECHAT_BROWSER_CLOSED', '浏览器窗口已被关闭，请重新执行注入测试。', evidence, warnings, undefined, runId);
    }
    if (!run) {
      run = createWechatRun(publishTaskId, 'draft_save_poc');
      createdRun = true;
      const opened = await openDraftPage(runtime);
      attachWechatRunBrowser(run, opened);
    } else {
      updateWechatRun(run, { mode: 'draft_save_poc', status: 'running' });
    }

    const page = run.page;
    if (!page || page.isClosed?.()) {
      return injectFailure('draft_save_poc', 'WECHAT_BROWSER_CLOSED', '浏览器窗口已被关闭，请重新执行注入测试。', evidence, warnings, undefined, run.state.runId);
    }
    evidence.draftPageOpened = true;
    if (isLoginUrl(page.url())) {
      await failWechatRun(run, 'WECHAT_SESSION_EXPIRED');
      return injectFailure('draft_save_poc', 'WECHAT_SESSION_EXPIRED', '微信 session 已失效，请重新扫码。', evidence, warnings, await pageDiagnostics(page, 'open_draft_page'), run.state.runId);
    }
    await page.bringToFront?.().catch(() => undefined);
    await page.waitForLoadState?.('domcontentloaded', { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout?.(1000).catch(() => undefined);

    const inspected = await inspectEditor(page);
    evidence.titleInputFound = Boolean(inspected.title.locator) || (!createdRun && run.state.titleFilled);
    evidence.editorFound = Boolean(inspected.editor.locator) || (!createdRun && run.state.contentInjected);
    evidence.saveButtonFound = Boolean(inspected.save.locator);
    if (!evidence.titleInputFound || !evidence.editorFound || !inspected.save.locator) {
      keepWechatRunOpen(run, 'failed');
      return injectFailure('draft_save_poc', 'WECHAT_EDITOR_NOT_FOUND', '未完整定位标题、编辑器或保存按钮。', evidence, warnings, await pageDiagnostics(page, 'inspect_editor', {
        htmlLength: loaded.adapted.html.length,
        textLength: loaded.adapted.textFallback.length,
        keepBrowserOpen: true,
        keepAliveUntil: run.state.keepAliveUntil,
      }), run.state.runId);
    }

    evidence.titleFilled = run.state.titleFilled && !createdRun ? true : await fillTitle(inspected.title.locator, loaded.title);
    updateWechatRun(run, { titleFilled: Boolean(evidence.titleFilled) });
    if (!evidence.titleFilled) {
      await failWechatRun(run, 'WECHAT_TITLE_FILL_FAILED');
      return injectFailure('draft_save_poc', 'WECHAT_TITLE_FILL_FAILED', '标题填入失败。', evidence, warnings, await pageDiagnostics(page, 'fill_title', {
        htmlLength: loaded.adapted.html.length,
        textLength: loaded.adapted.textFallback.length,
      }), run.state.runId);
    }

    // Always verify editor has actual content before save, regardless of cached injection state.
    // The WeChat editor may lose content between inject and save due to internal state management.
    let injected: InjectResult;
    if (run.state.contentInjected && run.state.injectionStrategy && !createdRun && inspected.editor.locator) {
      const currentLength = await editorTextLength(inspected.editor.locator);
      if (currentLength > 50) {
        // Re-read word count to verify WeChat still recognizes the content
        const wc = await readWechatWordCount(page);
        const htmlLen = await editorHtmlLength(inspected.editor.locator);
        injected = { success: true, strategy: run.state.injectionStrategy as InjectionStrategy, editorTextLengthAfterInject: currentLength, editorHtmlLengthAfterInject: htmlLen, wechatWordCountText: wc.text, wechatWordCountNumber: wc.number, contentRecognizedByWechat: wc.number !== null ? wc.number > 0 : true };
      } else {
        warnings.push('编辑器内容已丢失，正在重新注入。');
        injected = await injectHtml(page, inspected.editor.locator, loaded.adapted.html, loaded.adapted.textFallback, warnings);
      }
    } else {
      injected = await injectHtml(page, inspected.editor.locator, loaded.adapted.html, loaded.adapted.textFallback, warnings);
    }
    evidence.contentInjected = injected.success;
    evidence.contentVisibleInEditor = injected.editorTextLengthAfterInject > 50;
    evidence.contentRecognizedByWechat = injected.contentRecognizedByWechat;
    evidence.editorTextLengthAfterInject = injected.editorTextLengthAfterInject;
    evidence.editorHtmlLengthAfterInject = injected.editorHtmlLengthAfterInject;
    evidence.wechatWordCountNumber = injected.wechatWordCountNumber;
    evidence.wechatWordCountText = injected.wechatWordCountText;
    evidence.injectionStrategy = injected.strategy;
    updateWechatRun(run, { contentInjected: injected.success, injectionStrategy: injected.strategy });
    let diagnostics = await pageDiagnostics(page, injected.success ? null : 'inject_content', {
      htmlLength: loaded.adapted.html.length,
      textLength: loaded.adapted.textFallback.length,
      editorTextLengthAfterInject: injected.editorTextLengthAfterInject,
    });
    if (!injected.success) {
      if (injected.editorTextLengthAfterInject > 50 && injected.wechatWordCountNumber === 0) {
        keepWechatRunOpen(run, 'failed');
        return { success: false, mode: 'draft_save_poc', runId: run.state.runId, message: '正文已写入页面 DOM，但微信编辑器未识别正文内容（正文字数 0），已阻止保存。', errorCode: 'WECHAT_EDITOR_STATE_NOT_SYNCED', evidence, warnings, diagnostics };
      }
      await failWechatRun(run, 'WECHAT_INJECT_FAILED');
      return { success: false, mode: 'draft_save_poc', runId: run.state.runId, message: '正文注入失败。', errorCode: 'WECHAT_INJECT_FAILED', evidence, warnings, diagnostics };
    }

    // Pre-save content verification: ensure editor still has enough content right before clicking save
    if (inspected.editor.locator) {
      const preSaveLength = await editorTextLength(inspected.editor.locator);
      if (preSaveLength <= 50) {
        await failWechatRun(run, 'WECHAT_INJECT_FAILED');
        return {
          success: false,
          mode: 'draft_save_poc',
          runId: run.state.runId,
          message: `保存前编辑器内容不足（${preSaveLength} 字），未点击保存。`,
          errorCode: 'WECHAT_EDITOR_CONTENT_EMPTY_BEFORE_SAVE',
          evidence,
          warnings: [...warnings, `保存前编辑器文本长度：${preSaveLength}`],
          diagnostics: { ...diagnostics, editorTextLengthAfterInject: preSaveLength },
        };
      }
      // Pre-save word count check: block if WeChat word count is explicitly 0
      const preSaveWc = await readWechatWordCount(page);
      if (preSaveWc.number === 0) {
        keepWechatRunOpen(run, 'failed');
        return {
          success: false,
          mode: 'draft_save_poc',
          runId: run.state.runId,
          message: '保存前微信正文字数为 0，正文未被微信编辑器识别，已阻止保存空草稿。',
          errorCode: 'WECHAT_EDITOR_STATE_NOT_SYNCED',
          evidence,
          warnings: [...warnings, `微信正文字数：${preSaveWc.text}`],
          diagnostics: { ...diagnostics, wechatWordCountText: preSaveWc.text, wechatWordCountNumber: 0 },
        };
      }
    }

    await inspected.save.locator.click({ timeout: 10000 });
    evidence.saveClicked = true;
    updateWechatRun(run, { saveClicked: true });
    const saveResult = await saveSuccessDetected(page);
    evidence.draftSaved = saveResult.saved;
    updateWechatRun(run, { draftSaved: saveResult.saved, lastErrorCode: saveResult.errorCode });
    const keepOpen = getWechatConfig().keepBrowserOpenAfterSave;
    const state = keepOpen ? keepWechatRunOpen(run, saveResult.saved ? 'saved' : 'failed') : updateWechatRun(run, { status: saveResult.saved ? 'saved' : 'failed' });
    diagnostics = {
      ...await pageDiagnostics(page, saveResult.saved ? null : 'detect_save_result', diagnostics),
      keepBrowserOpen: keepOpen,
      keepAliveUntil: state?.keepAliveUntil ?? null,
      saveFeedbackText: saveResult.feedbackText,
      draftId: null,
    };

    if (saveResult.errorCode) {
      setWechatRuntimeError(saveResult.errorCode);
      await recordWechatPocRun(publishTaskId, 'draft_save_poc', false, saveResult.errorCode, evidence, saveResult.errorCode === 'WECHAT_CAPTCHA_DETECTED' ? '检测到验证码，需要人工处理。' : '检测到账号风险提示，已停止自动化。', loaded.title, injected.strategy, run.state.runId, keepOpen, true);
      return { success: false, mode: 'draft_save_poc', runId: run.state.runId, message: saveResult.errorCode === 'WECHAT_CAPTCHA_DETECTED' ? '检测到验证码，需要人工处理。' : '检测到账号风险提示，已停止自动化。', errorCode: saveResult.errorCode, evidence, warnings, draftId: null, diagnostics, recentRuns: await getWechatPocRuns(publishTaskId) };
    }
    if (!saveResult.saved) {
      setWechatRuntimeError('WECHAT_SAVE_RESULT_UNKNOWN');
      updateWechatRun(run, { lastErrorCode: 'WECHAT_SAVE_RESULT_UNKNOWN' });
      await recordWechatPocRun(publishTaskId, 'draft_save_poc', false, 'WECHAT_SAVE_RESULT_UNKNOWN', evidence, '已点击保存，但未检测到明确保存成功反馈，请人工检查草稿箱。', loaded.title, injected.strategy, run.state.runId, keepOpen, true);
      return { success: false, mode: 'draft_save_poc', runId: run.state.runId, message: '已点击保存，但未检测到明确保存成功反馈，请人工检查草稿箱。', errorCode: 'WECHAT_SAVE_RESULT_UNKNOWN', evidence, warnings, draftId: null, diagnostics, recentRuns: await getWechatPocRuns(publishTaskId) };
    }

    setWechatRuntimeError(null);
    await recordWechatPocRun(publishTaskId, 'draft_save_poc', true, null, evidence, '微信草稿保存 PoC 成功。微信未暴露可读取草稿 ID。', loaded.title, injected.strategy, run.state.runId, keepOpen, true);
    return { success: true, mode: 'draft_save_poc', runId: run.state.runId, message: '微信草稿保存 PoC 成功。未群发，未定时发布；微信未暴露可读取草稿 ID。', errorCode: null, evidence, warnings, draftId: null, diagnostics, recentRuns: await getWechatPocRuns(publishTaskId) };
  } catch (error) {
    setWechatRuntimeError('WECHAT_SAVE_FAILED');
    if (run) keepWechatRunOpen(run, 'failed');
    await recordWechatPocRun(publishTaskId, 'draft_save_poc', false, 'WECHAT_SAVE_FAILED', evidence, error instanceof Error ? error.message : '保存草稿 PoC 失败。', loaded.title, evidence.injectionStrategy as InjectionStrategy, run?.state.runId, getWechatConfig().keepBrowserOpenAfterSave, true);
    return { success: false, mode: 'draft_save_poc', runId: run?.state.runId, message: error instanceof Error ? error.message : '保存草稿 PoC 失败。', errorCode: 'WECHAT_SAVE_FAILED', evidence, warnings, recentRuns: await getWechatPocRuns(publishTaskId) };
  }
}

export function getCurrentWechatAutomationRun(): WechatAutomationRunState | null {
  return getCurrentWechatRun();
}

export async function closeWechatAutomationRun(runId: string) {
  return closeWechatRun(runId);
}

async function recordWechatPocRun(
  publishTaskId: string,
  mode: WechatPocRun['mode'],
  success: boolean,
  errorCode: string | null,
  evidence: PocEvidence,
  message: string,
  title?: string,
  injectionStrategy?: InjectionStrategy,
  runId?: string,
  keepBrowserOpen?: boolean,
  userConfirmed?: boolean,
) {
  const task = await prisma.publishTask.findUnique({ where: { id: publishTaskId } });
  if (!task) return;
  let packageJson = parseJsonField<Record<string, unknown>>(task.packageJson, {});
  const hasPackageContent = Boolean(packageJson.title || packageJson.markdown || packageJson.html);
  if (!hasPackageContent) {
    const loadedTask = await loadTask(publishTaskId);
    if (loadedTask) {
      const pkg = await buildPublishPackagePayload(loadedTask.article, loadedTask);
      packageJson = { ...pkg, ...packageJson };
    }
  }
  const run: WechatPocRun = {
    runId: runId || randomUUID(),
    publishTaskId,
    mode,
    success,
    errorCode,
    evidence,
    message,
    title,
    injectionStrategy,
    keepBrowserOpen,
    userConfirmed,
    ranAt: new Date().toISOString(),
  };
  const previousRuns = Array.isArray(packageJson.wechatPocRuns) ? packageJson.wechatPocRuns as WechatPocRun[] : [];
  const wechatPocRuns = [run, ...previousRuns].slice(0, 10);
  packageJson.wechatPocResult = run;
  packageJson.wechatPocRuns = wechatPocRuns;
  await prisma.publishTask.update({ where: { id: publishTaskId }, data: { packageJson: JSON.stringify(packageJson) } });
  await prisma.operationLog.create({
    data: {
      module: '微信PoC',
      action: `${mode} ${success ? '成功' : '失败'}：${message}`,
      type: success ? 'success' : 'warning',
    },
  });
}

export async function getWechatPocRuns(publishTaskId: string) {
  const task = await prisma.publishTask.findUnique({ where: { id: publishTaskId } });
  if (!task?.packageJson) return [];
  const packageJson = parseJsonField<Record<string, unknown>>(task.packageJson, {});
  return (Array.isArray(packageJson.wechatPocRuns) ? packageJson.wechatPocRuns as WechatPocRun[] : []).slice(0, 3);
}

export async function runWechatDraftPoc(publishTaskId: string): Promise<WechatInjectResult> {
  const probed = await probeWechatEditor(publishTaskId);
  return {
    success: probed.success,
    mode: 'poc_check',
    message: probed.success ? '自动化检查通过：微信编辑器可访问，HTML 已准备，尚未保存真实草稿。' : probed.message,
    errorCode: probed.errorCode,
    evidence: {
      sessionChecked: probed.evidence.sessionChecked,
      editorReached: probed.evidence.editorFound,
      htmlPrepared: probed.evidence.htmlPrepared,
      contentInjected: false,
      draftSaved: false,
    },
    warnings: probed.warnings || [],
    recentRuns: probed.recentRuns,
  };
}
