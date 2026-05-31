export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; errorCode: string; message: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export class ApiClientError extends Error {
  errorCode: string;

  constructor(errorCode: string, message: string) {
    super(message);
    this.errorCode = errorCode;
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.success) {
    const failure = payload as ApiFailure;
    throw new ApiClientError(failure.errorCode, failure.message);
  }
  return payload.data;
}
