export const EXIT_SUCCESS = 0;
export const EXIT_GENERAL = 1;
export const EXIT_USAGE = 2;
export const EXIT_API = 3;
export const EXIT_NETWORK = 4;
export const EXIT_TIMEOUT = 5;
export const EXIT_TIMEOUT_EXPLICIT = 124;
export const EXIT_SIGINT = 130;

export type FileErrorCode =
  | "file_not_found"
  | "file_read_error"
  | "file_write_error"
  | "unsupported_format"
  | "file_too_large"
  | "photo_too_large"
  | "unsupported_photo_format"
  | "invalid_spec";

export type ErrorCode =
  | FileErrorCode
  | "api_error"
  | "network_error"
  | "timeout_error"
  | "rate_limit_error"
  | "user_abort"
  | "not_interactive"
  | "missing_order_id"
  | "order_not_found"
  | "order_not_completed"
  | "order_not_failed"
  | "edit_limit_reached"
  | "resend_limit_reached"
  | "regen_limit_reached"
  | "readjust_limit_reached"
  | "gift_already_redeemed"
  | "gift_not_paid"
  | "not_create_curriculum"
  | "not_professional_photo"
  | "needs_form_fill"
  | "quota_exceeded"
  | "invalid_argument"
  | "unknown_error";

export class CliError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode | string,
    public readonly exitCode: number = EXIT_GENERAL,
  ) {
    super(message);
    this.name = "CliError";
  }

  toJSON() {
    return { error: { message: this.message, code: this.code } };
  }
}

export class FileError extends CliError {
  constructor(message: string, code: FileErrorCode) {
    super(message, code, code === "file_not_found" ? EXIT_USAGE : EXIT_GENERAL);
    this.name = "FileError";
  }
}

export class ApiError extends CliError {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message, "api_error", EXIT_API);
    this.name = "ApiError";
  }
}

export class NetworkError extends CliError {
  constructor(message: string) {
    super(message, "network_error", EXIT_NETWORK);
    this.name = "NetworkError";
  }
}

export class TimeoutError extends CliError {
  constructor(message: string, explicit = false) {
    super(message, "timeout_error", explicit ? EXIT_TIMEOUT_EXPLICIT : EXIT_TIMEOUT);
    this.name = "TimeoutError";
  }
}

export class RateLimitError extends CliError {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message, "rate_limit_error", EXIT_API);
    this.name = "RateLimitError";
  }
}

export class UserAbortError extends CliError {
  constructor() {
    super("", "user_abort", EXIT_SUCCESS);
    this.name = "UserAbortError";
  }
}
