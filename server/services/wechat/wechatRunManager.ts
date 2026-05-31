import { randomUUID } from 'node:crypto';
import { getWechatConfig, type WechatErrorCode } from './wechatSession';

export type WechatAutomationRunMode = 'probe' | 'inject_poc' | 'draft_save_poc';
export type WechatAutomationRunStatus = 'running' | 'waiting_user_review' | 'saved' | 'failed' | 'closed';
export type WechatAutomationRunState = {
  runId: string;
  publishTaskId: string;
  mode: WechatAutomationRunMode;
  status: WechatAutomationRunStatus;
  pageOpened: boolean;
  titleFilled: boolean;
  contentInjected: boolean;
  saveClicked: boolean;
  draftSaved: boolean;
  injectionStrategy: string | null;
  startedAt: string;
  updatedAt: string;
  keepAliveUntil: string | null;
  lastErrorCode: string | null;
};

type ActiveRun = {
  state: WechatAutomationRunState;
  browser?: any;
  context?: any;
  page?: any;
  timer?: NodeJS.Timeout;
};

let activeRun: ActiveRun | null = null;

function publicState(run: ActiveRun | null = activeRun) {
  return run ? { ...run.state } : null;
}

function touch(run: ActiveRun, patch: Partial<WechatAutomationRunState>) {
  run.state = {
    ...run.state,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  return publicState(run);
}

async function closeRun(run: ActiveRun, status: WechatAutomationRunStatus = 'closed') {
  if (run.timer) clearTimeout(run.timer);
  run.timer = undefined;
  touch(run, { status, keepAliveUntil: null });
  await run.browser?.close?.().catch(() => undefined);
  run.browser = undefined;
  run.context = undefined;
  run.page = undefined;
  if (activeRun?.state.runId === run.state.runId) activeRun = null;
}

export function getCurrentWechatRun() {
  if (!activeRun) return null;
  if (activeRun.page?.isClosed?.()) {
    touch(activeRun, { status: 'closed', lastErrorCode: 'WECHAT_BROWSER_CLOSED', keepAliveUntil: null });
    activeRun = null;
    return null;
  }
  return publicState();
}

export function getActiveWechatRun(runId?: string) {
  if (!activeRun) return null;
  if (runId && activeRun.state.runId !== runId) return null;
  if (activeRun.page?.isClosed?.()) {
    touch(activeRun, { status: 'closed', lastErrorCode: 'WECHAT_BROWSER_CLOSED', keepAliveUntil: null });
    activeRun = null;
    return null;
  }
  return activeRun;
}

export function hasActiveWechatRun(exceptRunId?: string) {
  const current = getCurrentWechatRun();
  return Boolean(current && current.runId !== exceptRunId);
}

export function createWechatRun(publishTaskId: string, mode: WechatAutomationRunMode) {
  const now = new Date().toISOString();
  activeRun = {
    state: {
      runId: randomUUID(),
      publishTaskId,
      mode,
      status: 'running',
      pageOpened: false,
      titleFilled: false,
      contentInjected: false,
      saveClicked: false,
      draftSaved: false,
      injectionStrategy: null,
      startedAt: now,
      updatedAt: now,
      keepAliveUntil: null,
      lastErrorCode: null,
    },
  };
  return activeRun;
}

export function attachWechatRunBrowser(run: ActiveRun, opened: { browser: any; context?: any; page: any }) {
  run.browser = opened.browser;
  run.context = opened.context;
  run.page = opened.page;
  touch(run, { pageOpened: true });
}

export function updateWechatRun(run: ActiveRun, patch: Partial<WechatAutomationRunState>) {
  return touch(run, patch);
}

export function keepWechatRunOpen(run: ActiveRun, status: WechatAutomationRunStatus) {
  const keepAliveUntil = new Date(Date.now() + getWechatConfig().browserKeepAliveMs).toISOString();
  touch(run, { status, keepAliveUntil });
  if (run.timer) clearTimeout(run.timer);
  run.timer = setTimeout(() => {
    void closeRun(run, 'closed');
  }, getWechatConfig().browserKeepAliveMs);
  run.timer.unref?.();
  return publicState(run);
}

export async function failWechatRun(run: ActiveRun | null, errorCode: WechatErrorCode) {
  if (!run) return;
  touch(run, { status: 'failed', lastErrorCode: errorCode });
  await closeRun(run, 'failed');
}

export async function closeWechatRun(runId: string) {
  const run = getActiveWechatRun(runId);
  if (!run) {
    return { closed: false, state: null };
  }
  await closeRun(run, 'closed');
  return { closed: true, state: { ...run.state } };
}

export async function closeCurrentWechatRun() {
  if (!activeRun) return;
  await closeRun(activeRun, 'closed');
}
