import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type WechatAutomationStatus =
  | 'disabled'
  | 'not_configured'
  | 'playwright_missing'
  | 'chromium_missing'
  | 'need_login'
  | 'session_valid'
  | 'session_expired'
  | 'captcha_required'
  | 'editor_unknown'
  | 'editor_reachable'
  | 'poc_ready'
  | 'last_run_failed';

export type WechatErrorCode =
  | 'WECHAT_DISABLED'
  | 'WECHAT_PLAYWRIGHT_NOT_INSTALLED'
  | 'WECHAT_CHROMIUM_NOT_INSTALLED'
  | 'WECHAT_LOGIN_REQUIRED'
  | 'WECHAT_LOGIN_TIMEOUT'
  | 'WECHAT_SESSION_EXPIRED'
  | 'WECHAT_PAGE_LOAD_TIMEOUT'
  | 'WECHAT_EDITOR_NOT_FOUND'
  | 'WECHAT_RUN_IN_PROGRESS'
  | 'WECHAT_BROWSER_CLOSED'
  | 'WECHAT_PAGE_LOST'
  | 'WECHAT_TITLE_FILL_FAILED'
  | 'WECHAT_INJECT_FAILED'
  | 'WECHAT_SAVE_FAILED'
  | 'WECHAT_SAVE_RESULT_UNKNOWN'
  | 'WECHAT_CAPTCHA_DETECTED'
  | 'WECHAT_ACCOUNT_RISK'
  | 'WECHAT_CONFIRM_REQUIRED'
  | 'WECHAT_EDITOR_CONTENT_EMPTY_BEFORE_SAVE'
  | 'WECHAT_EDITOR_STATE_NOT_SYNCED'
  | 'WECHAT_UNKNOWN_ERROR';

export type WechatStatusResponse = {
  enabled: boolean;
  status: WechatAutomationStatus;
  message: string;
  lastCheckedAt: string | null;
  lastRunAt: string | null;
  lastErrorCode: string | null;
  capabilities: {
    playwrightAvailable: boolean;
    chromiumAvailable: boolean;
    sessionFileFound: boolean;
  };
};

type RuntimeState = {
  lastCheckedAt: string | null;
  lastRunAt: string | null;
  lastErrorCode: string | null;
  lastEditorReachable: boolean | null;
};

type EnabledCheck =
  | { ok: true }
  | { ok: false; errorCode: WechatErrorCode; message: string };

type RuntimeCheck =
  | { ok: true; playwright: any }
  | { ok: false; errorCode: WechatErrorCode; message: string };

const runtimeState: RuntimeState = {
  lastCheckedAt: null,
  lastRunAt: null,
  lastErrorCode: null,
  lastEditorReachable: null,
};

export function isWechatAutomationEnabled() {
  return (process.env.WECHAT_AUTOMATION_ENABLED ?? '').trim().toLowerCase() === 'true';
}

export function getWechatConfig() {
  return {
    enabled: isWechatAutomationEnabled(),
    sessionPath: resolve(process.cwd(), process.env.WECHAT_SESSION_PATH || '.local/wechat-session.json'),
    headless: process.env.WECHAT_HEADLESS === 'true',
    delayMinMs: Number(process.env.WECHAT_OPERATION_DELAY_MIN_MS || '1000'),
    delayMaxMs: Number(process.env.WECHAT_OPERATION_DELAY_MAX_MS || '3000'),
    loginTimeoutMs: Number(process.env.WECHAT_LOGIN_TIMEOUT_MS || '120000'),
    pageTimeoutMs: Number(process.env.WECHAT_PAGE_TIMEOUT_MS || '45000'),
    keepBrowserOpenAfterInject: (process.env.WECHAT_KEEP_BROWSER_OPEN_AFTER_INJECT ?? 'true').trim().toLowerCase() !== 'false',
    keepBrowserOpenAfterSave: (process.env.WECHAT_KEEP_BROWSER_OPEN_AFTER_SAVE ?? 'true').trim().toLowerCase() !== 'false',
    browserKeepAliveMs: Number(process.env.WECHAT_BROWSER_KEEP_ALIVE_MS || '600000'),
  };
}

export async function loadPlaywright() {
  try {
    const moduleName = 'playwright';
    return await import(moduleName);
  } catch {
    return null;
  }
}

export async function getPlaywrightRuntime() {
  const playwright = await loadPlaywright();
  if (!playwright) {
    return { playwright: null, playwrightAvailable: false, chromiumAvailable: false, chromiumPath: null as string | null };
  }
  try {
    const chromiumPath = playwright.chromium.executablePath();
    return {
      playwright,
      playwrightAvailable: true,
      chromiumAvailable: Boolean(chromiumPath && existsSync(chromiumPath)),
      chromiumPath,
    };
  } catch {
    return { playwright, playwrightAvailable: true, chromiumAvailable: false, chromiumPath: null as string | null };
  }
}

export function ensureSessionDir() {
  const { sessionPath } = getWechatConfig();
  mkdirSync(dirname(sessionPath), { recursive: true });
  return sessionPath;
}

function sessionMetaPath() {
  return resolve(dirname(getWechatConfig().sessionPath), 'wechat-session-meta.json');
}

export function saveWechatSessionMeta(meta: { token?: string | null; savedAt: string }) {
  ensureSessionDir();
  writeFileSync(sessionMetaPath(), JSON.stringify(meta), 'utf8');
}

export function readWechatSessionMeta(): { token?: string | null; savedAt?: string } | null {
  try {
    return JSON.parse(readFileSync(sessionMetaPath(), 'utf8'));
  } catch {
    return null;
  }
}

export function hasSessionFile() {
  return existsSync(getWechatConfig().sessionPath);
}

export function setWechatRuntimeError(errorCode: string | null) {
  runtimeState.lastErrorCode = errorCode;
  runtimeState.lastRunAt = new Date().toISOString();
}

export function setWechatEditorReachable(value: boolean | null) {
  runtimeState.lastEditorReachable = value;
}

export function requireWechatEnabled(): EnabledCheck {
  if (!isWechatAutomationEnabled()) {
    setWechatRuntimeError('WECHAT_DISABLED');
    return {
      ok: false,
      errorCode: 'WECHAT_DISABLED',
      message: '微信公众号自动化 PoC 未启用。请设置 WECHAT_AUTOMATION_ENABLED=true 后手动触发。',
    };
  }
  return { ok: true };
}

export async function requireWechatRuntime(): Promise<RuntimeCheck> {
  if (!isWechatAutomationEnabled()) {
    setWechatRuntimeError('WECHAT_DISABLED');
    return {
      ok: false,
      errorCode: 'WECHAT_DISABLED',
      message: '微信公众号自动化 PoC 未启用。请设置 WECHAT_AUTOMATION_ENABLED=true 后手动触发。',
    };
  }

  const runtime = await getPlaywrightRuntime();
  if (!runtime.playwrightAvailable || !runtime.playwright) {
    setWechatRuntimeError('WECHAT_PLAYWRIGHT_NOT_INSTALLED');
    return {
      ok: false,
      errorCode: 'WECHAT_PLAYWRIGHT_NOT_INSTALLED',
      message: 'Playwright 未安装或不可加载。请执行 npm install。',
    };
  }
  if (!runtime.chromiumAvailable) {
    setWechatRuntimeError('WECHAT_CHROMIUM_NOT_INSTALLED');
    return {
      ok: false,
      errorCode: 'WECHAT_CHROMIUM_NOT_INSTALLED',
      message: 'Chromium 未安装或不可启动。请执行 npx playwright install chromium。',
    };
  }
  return { ok: true, playwright: runtime.playwright };
}

export async function getWechatAutomationStatus(): Promise<WechatStatusResponse> {
  runtimeState.lastCheckedAt = new Date().toISOString();
  const config = getWechatConfig();
  const runtime = await getPlaywrightRuntime();
  const sessionFileFound = hasSessionFile();
  const capabilities = {
    playwrightAvailable: runtime.playwrightAvailable,
    chromiumAvailable: runtime.chromiumAvailable,
    sessionFileFound,
  };

  if (!config.enabled) {
    return {
      enabled: false,
      status: 'disabled',
      message: '微信自动化 PoC 当前关闭。请在 .env 设置 WECHAT_AUTOMATION_ENABLED=true，并重启后端。',
      ...runtimeState,
      capabilities,
    };
  }
  if (!runtime.playwrightAvailable) {
    runtimeState.lastErrorCode = 'WECHAT_PLAYWRIGHT_NOT_INSTALLED';
    return {
      enabled: true,
      status: 'playwright_missing',
      message: 'Playwright 未安装或不可加载。请执行 npm install。',
      ...runtimeState,
      capabilities,
    };
  }
  if (!runtime.chromiumAvailable) {
    runtimeState.lastErrorCode = 'WECHAT_CHROMIUM_NOT_INSTALLED';
    return {
      enabled: true,
      status: 'chromium_missing',
      message: 'Chromium 未安装。请执行 npx playwright install chromium。',
      ...runtimeState,
      capabilities,
    };
  }
  if (!sessionFileFound) {
    return {
      enabled: true,
      status: 'need_login',
      message: '尚未检测到微信公众号会话文件，需要手动扫码登录。',
      ...runtimeState,
      capabilities,
    };
  }

  const status: WechatAutomationStatus = runtimeState.lastErrorCode
    ? 'last_run_failed'
    : runtimeState.lastEditorReachable === true
      ? 'editor_reachable'
      : 'poc_ready';
  return {
    enabled: true,
    status,
    message: runtimeState.lastErrorCode
      ? '上次自动化 PoC 运行失败，请查看错误码。'
      : 'Playwright、Chromium 和本地 session 文件已就绪，可校验 session 或探测编辑器。',
    ...runtimeState,
    capabilities,
  };
}
