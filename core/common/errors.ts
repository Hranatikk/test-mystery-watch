export type ApiErrorCode =
  | 'network'
  | 'insufficient_funds'
  | 'not_found'
  | 'aborted'
  | 'conflict'
  /** The request is well-formed but not allowed (e.g. selling a watch in transit). */
  | 'invalid';

export class ApiError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
    this.code = code;
  }
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code == null || error.code === code);
}
