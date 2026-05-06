/**
 * Standardized error codes for API responses.
 * Each code is unique and helps the client identify the exact error type.
 * Used alongside HTTP status codes (e.g., 400, 404, 409, etc.).
 */

export enum ErrorCode {
  // Validation & Request Errors (400)
  INVALID_JSON = 'INVALID_JSON',
  INVALID_DATA = 'INVALID_DATA',
  INVALID_REQUEST_BODY = 'INVALID_REQUEST_BODY',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  NOT_FOUND = 'NOT_FOUND',

  // Authentication & Authorization (401, 403)
  MISSING_PLAYER_ID = 'MISSING_PLAYER_ID',
  INVALID_API_KEY = 'INVALID_API_KEY',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // GTS Errors (400, 409, 404)
  GTS_SPECIES_BLACKLISTED = 'GTS_SPECIES_BLACKLISTED',
  GTS_ALREADY_DEPOSITED = 'GTS_ALREADY_DEPOSITED',
  GTS_DEPOSIT_NOT_FOUND = 'GTS_DEPOSIT_NOT_FOUND',
  GTS_INVALID_WANTED_SPECIES = 'GTS_INVALID_WANTED_SPECIES',
  GTS_TRADE_FAILED = 'GTS_TRADE_FAILED',

  // Mystery Gift Errors (400, 409, 404)
  GIFT_NOT_FOUND = 'GIFT_NOT_FOUND',
  GIFT_ALREADY_CLAIMED = 'GIFT_ALREADY_CLAIMED',
  GIFT_NOT_AVAILABLE = 'GIFT_NOT_AVAILABLE',
  GIFT_MAX_CLAIMS_REACHED = 'GIFT_MAX_CLAIMS_REACHED',
  GIFT_NOT_ELIGIBLE = 'GIFT_NOT_ELIGIBLE',
  GIFT_EXPIRED = 'GIFT_EXPIRED',
  GIFT_INVALID_CODE = 'GIFT_INVALID_CODE',
  GIFT_ALREADY_CODE = 'GIFT_ALREADY_CODE',

  // Friends Errors (400, 404, 409)
  FRIEND_REQUEST_ALREADY_EXISTS = 'FRIEND_REQUEST_ALREADY_EXISTS',
  FRIEND_ALREADY_ADDED = 'FRIEND_ALREADY_ADDED',
  FRIEND_REQUEST_NOT_FOUND = 'FRIEND_REQUEST_NOT_FOUND',
  FRIEND_NOT_FOUND = 'FRIEND_NOT_FOUND',
  CANNOT_FRIEND_YOURSELF = 'CANNOT_FRIEND_YOURSELF',
  PLAYER_NOT_REGISTERED = 'PLAYER_NOT_REGISTERED',

  // Maintenance Errors (503, 400)
  SERVER_IN_MAINTENANCE = 'SERVER_IN_MAINTENANCE',
  INVALID_MAINTENANCE_STATE = 'INVALID_MAINTENANCE_STATE',

  // Generic Errors (500)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

/**
 * Maps error codes to HTTP status codes.
 * Use this to determine the correct status code based on the error.
 */
export const ErrorCodeToStatus: Record<ErrorCode, number> = {
  [ErrorCode.INVALID_JSON]: 400,
  [ErrorCode.INVALID_DATA]: 400,
  [ErrorCode.INVALID_REQUEST_BODY]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.INVALID_PARAMETERS]: 400,

  [ErrorCode.MISSING_PLAYER_ID]: 400,
  [ErrorCode.INVALID_API_KEY]: 401,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,

  [ErrorCode.GTS_SPECIES_BLACKLISTED]: 400,
  [ErrorCode.GTS_ALREADY_DEPOSITED]: 409,
  [ErrorCode.GTS_DEPOSIT_NOT_FOUND]: 404,
  [ErrorCode.GTS_INVALID_WANTED_SPECIES]: 400,
  [ErrorCode.GTS_TRADE_FAILED]: 400,

  [ErrorCode.GIFT_NOT_FOUND]: 404,
  [ErrorCode.GIFT_ALREADY_CLAIMED]: 409,
  [ErrorCode.GIFT_NOT_AVAILABLE]: 400,
  [ErrorCode.GIFT_EXPIRED]: 419,
  [ErrorCode.GIFT_MAX_CLAIMS_REACHED]: 409,
  [ErrorCode.GIFT_NOT_ELIGIBLE]: 400,
  [ErrorCode.GIFT_INVALID_CODE]: 400,
  [ErrorCode.GIFT_ALREADY_CODE]: 409,

  [ErrorCode.FRIEND_REQUEST_ALREADY_EXISTS]: 409,
  [ErrorCode.FRIEND_ALREADY_ADDED]: 409,
  [ErrorCode.FRIEND_REQUEST_NOT_FOUND]: 404,
  [ErrorCode.FRIEND_NOT_FOUND]: 404,
  [ErrorCode.CANNOT_FRIEND_YOURSELF]: 400,
  [ErrorCode.PLAYER_NOT_REGISTERED]: 404,
  [ErrorCode.NOT_FOUND]: 404,

  [ErrorCode.SERVER_IN_MAINTENANCE]: 503,
  [ErrorCode.INVALID_MAINTENANCE_STATE]: 400,

  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
};

/**
 * Error response object structure.
 * Always include both a code and a human-readable error message.
 */
export interface ErrorResponse {
  ok: false;
  code: number;
  code_client: ErrorCode;
  error: string;
  details?: unknown;
}

/**
 * Helper to create a standardized error response.
 *
 * `code` is the HTTP status and `code_client` is the business error code.
 */
export function createErrorResponse(
  code: ErrorCode,
  error: string,
  details?: unknown,
): ErrorResponse {
  return {
    ok: false,
    code: getStatusForErrorCode(code),
    code_client: code,
    error,
    ...(details ? { details } : {}),
  };
}

/**
 * Helper to get the HTTP status code for an error code.
 */
export function getStatusForErrorCode(code: ErrorCode): number {
  return ErrorCodeToStatus[code] ?? 500;
}
