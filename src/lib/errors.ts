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
  | "file_exists"
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
  | "order_failed"
  | "order_expired"
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
  | "doctor_failed"
  | "invalid_argument"
  | "unknown_error";

export interface CliErrorOptions {
  /** Process exit code. Defaults to EXIT_GENERAL. */
  exitCode?: number;
  /**
   * The next command to run, when there is one. Printed beneath the message
   * for humans and carried as `error.hint` in the JSON envelope so an agent
   * can branch on it instead of parsing prose.
   */
  hint?: string;
}

export class CliError extends Error {
  public readonly code: ErrorCode | string;
  public readonly exitCode: number;
  public readonly hint?: string;

  constructor(
    message: string,
    code: ErrorCode | string,
    exitCodeOrOptions: number | CliErrorOptions = EXIT_GENERAL,
  ) {
    super(message);
    this.name = "CliError";
    this.code = code;
    const options =
      typeof exitCodeOrOptions === "number"
        ? { exitCode: exitCodeOrOptions }
        : exitCodeOrOptions;
    this.exitCode = options.exitCode ?? EXIT_GENERAL;
    this.hint = options.hint;
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        exitCode: this.exitCode,
        ...(this.hint ? { hint: this.hint } : {}),
      },
    };
  }
}

export class FileError extends CliError {
  constructor(message: string, code: FileErrorCode, hint?: string) {
    super(message, code, {
      exitCode: code === "file_not_found" ? EXIT_USAGE : EXIT_GENERAL,
      hint,
    });
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
  constructor(message: string, explicit = false, hint?: string) {
    super(message, "timeout_error", {
      exitCode: explicit ? EXIT_TIMEOUT_EXPLICIT : EXIT_TIMEOUT,
      hint,
    });
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

  toJSON() {
    const base = super.toJSON();
    if (this.retryAfterMs === undefined) return base;
    return { error: { ...base.error, retryAfterMs: this.retryAfterMs } };
  }
}

export class UserAbortError extends CliError {
  constructor() {
    super("", "user_abort", EXIT_SUCCESS);
    this.name = "UserAbortError";
  }
}
