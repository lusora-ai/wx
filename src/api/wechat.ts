import { apiRequest } from './client';

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

export type WechatPocRun = {
  runId: string;
  publishTaskId: string;
  mode: 'probe' | 'inject_poc' | 'draft_save_poc';
  success: boolean;
  errorCode: string | null;
  evidence: Record<string, boolean | string | number | null>;
  message: string;
  title?: string;
  injectionStrategy?: 'dom_html' | 'clipboard_html' | 'text_fallback' | null;
  keepBrowserOpen?: boolean;
  userConfirmed?: boolean;
  ranAt: string;
};

export type WechatDiagnostics = {
  currentUrl: string;
  pageTitle: string;
  failedStep?: string | null;
  htmlLength?: number;
  textLength?: number;
  editorTextLengthAfterInject?: number;
  keepBrowserOpen?: boolean;
  keepAliveUntil?: string | null;
  saveFeedbackText?: string | null;
  draftId?: string | null;
  visibleTextSummary?: string[];
};

export type WechatPocResult = {
  success: boolean;
  mode: 'poc_check' | 'inject_poc' | 'draft_save_poc';
  runId?: string | null;
  message: string;
  errorCode: string | null;
  evidence: Record<string, boolean | string | number | null>;
  warnings?: string[];
  draftId?: string | null;
  diagnostics?: WechatDiagnostics;
  recentRuns?: WechatPocRun[];
};

export type WechatAutomationRun = {
  runId: string;
  publishTaskId: string;
  mode: 'probe' | 'inject_poc' | 'draft_save_poc';
  status: 'running' | 'waiting_user_review' | 'saved' | 'failed' | 'closed';
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

export type WechatLoginResult = {
  success: boolean;
  status: 'session_valid' | 'login_timeout' | 'captcha_required' | 'account_risk' | 'failed';
  message: string;
  errorCode: string | null;
  evidence: Record<string, boolean>;
};

export type WechatSessionValidateResult = {
  success: boolean;
  status: 'session_valid' | 'session_expired' | 'need_login' | 'failed';
  message: string;
  errorCode: string | null;
  evidence: Record<string, boolean>;
};

export type WechatProbeResult = {
  success: boolean;
  message: string;
  errorCode: string | null;
  evidence: Record<string, boolean | string | number | null>;
  selectorReport: {
    titleInput: 'found' | 'not_found';
    editor: 'found' | 'not_found';
    saveButton: 'found' | 'not_found';
    candidates?: Record<string, unknown>;
  };
  currentUrl?: string;
  pageTitle?: string;
  failedStep?: string | null;
  diagnostics?: WechatDiagnostics;
  warnings?: string[];
  recentRuns?: WechatPocRun[];
};

export const wechatApi = {
  status: () => apiRequest<WechatStatusResponse>('/api/wechat/status'),
  startLogin: () => apiRequest<WechatLoginResult>('/api/wechat/login/start', { method: 'POST' }),
  validateSession: () => apiRequest<WechatSessionValidateResult>('/api/wechat/session/validate', { method: 'POST' }),
  runDraftPoc: (publishTaskId: string) =>
    apiRequest<WechatPocResult>('/api/wechat/drafts/poc', {
      method: 'POST',
      body: JSON.stringify({ publishTaskId }),
    }),
  probeEditor: (publishTaskId: string) =>
    apiRequest<WechatProbeResult>('/api/wechat/editor/probe', {
      method: 'POST',
      body: JSON.stringify({ publishTaskId }),
    }),
  injectDraftPoc: (publishTaskId: string) =>
    apiRequest<WechatPocResult>('/api/wechat/drafts/inject-poc', {
      method: 'POST',
      body: JSON.stringify({ publishTaskId }),
    }),
  saveDraftPoc: (publishTaskId: string, confirm: boolean, runId?: string | null) =>
    apiRequest<WechatPocResult>('/api/wechat/drafts/save-poc', {
      method: 'POST',
      body: JSON.stringify({ publishTaskId, confirm, runId }),
    }),
  currentRun: () => apiRequest<WechatAutomationRun | null>('/api/wechat/runs/current'),
  closeRun: (runId: string) =>
    apiRequest<{ closed: boolean; state: WechatAutomationRun | null }>(`/api/wechat/runs/${runId}/close`, {
      method: 'POST',
    }),
  confirmManual: (publishTaskId: string) =>
    apiRequest<{ confirmed: boolean; publishTaskId: string }>('/api/wechat/drafts/confirm-manual', {
      method: 'POST',
      body: JSON.stringify({ publishTaskId }),
    }),
};
