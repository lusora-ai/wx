import type { Request, Response, NextFunction } from 'express';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_ITEM_NOT_FOUND'
  | 'SOURCE_FETCH_FAILED'
  | 'TOPIC_NOT_FOUND'
  | 'ARTICLE_NOT_FOUND'
  | 'ARTICLE_EMPTY'
  | 'NEEDS_QUALITY_CHECK'
  | 'QUALITY_FAILED'
  | 'QUALITY_OUTDATED'
  | 'EXISTING_PACKAGE'
  | 'LLM_CONFIG_MISSING'
  | 'LLM_REQUEST_FAILED'
  | 'AI_OUTPUT_INVALID'
  | 'DATABASE_ERROR'
  | 'EXPORT_FAILED'
  | 'PUBLISH_TASK_FAILED'
  | 'FETCH_TASK_NOT_FOUND'
  | 'WECHAT_DISABLED'
  | 'WECHAT_PLAYWRIGHT_NOT_INSTALLED'
  | 'WECHAT_CHROMIUM_NOT_INSTALLED'
  | 'WECHAT_LOGIN_REQUIRED'
  | 'WECHAT_LOGIN_TIMEOUT'
  | 'WECHAT_SESSION_EXPIRED'
  | 'WECHAT_PAGE_LOAD_TIMEOUT'
  | 'WECHAT_EDITOR_NOT_FOUND'
  | 'WECHAT_INJECT_FAILED'
  | 'WECHAT_SAVE_FAILED'
  | 'WECHAT_CAPTCHA_DETECTED'
  | 'WECHAT_ACCOUNT_RISK'
  | 'WECHAT_CONFIRM_REQUIRED'
  | 'WECHAT_UNKNOWN_ERROR'
  | 'NOT_IMPLEMENTED';

export class ApiError extends Error {
  status: number;
  errorCode: ErrorCode;

  constructor(errorCode: ErrorCode, message: string, status = 400) {
    super(message);
    this.errorCode = errorCode;
    this.status = status;
  }
}

export function ok<T>(res: Response, data: T) {
  return res.json({ success: true, data });
}

export function fail(res: Response, error: unknown) {
  if (error instanceof ApiError) {
    return res.status(error.status).json({
      success: false,
      errorCode: error.errorCode,
      message: error.message,
    });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    errorCode: 'DATABASE_ERROR',
    message: '服务端处理失败，请查看日志。',
  });
}

export function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res, next).catch((error) => fail(res, error));
  };
}

export function parseJsonField<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function jsonField(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export const audiences = ['officeWorker', 'student', 'freelancer'] as const;
export type Audience = (typeof audiences)[number];

export function assertAudienceList(value: unknown): Audience[] {
  if (!Array.isArray(value)) {
    throw new ApiError('VALIDATION_ERROR', 'audiences 必须是数组。');
  }
  const normalized = value.filter((item): item is Audience => audiences.includes(item));
  if (normalized.length === 0) {
    throw new ApiError('VALIDATION_ERROR', '至少选择一个有效受众。');
  }
  return Array.from(new Set(normalized));
}
