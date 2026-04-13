export const EXIT_SUCCESS = 0;
export const EXIT_GENERAL = 1;
export const EXIT_USAGE = 2;
export const EXIT_SIGINT = 130;

export class CliError extends Error {
  constructor(
    message: string,
    public readonly code: string,
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
  constructor(
    message: string,
    code: "file_not_found" | "file_read_error" | "unsupported_format",
  ) {
    super(message, code);
    this.name = "FileError";
  }
}

export class ApiError extends CliError {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message, "api_error");
    this.name = "ApiError";
  }
}

export class NetworkError extends CliError {
  constructor(message: string) {
    super(message, "network_error");
    this.name = "NetworkError";
  }
}

export class TimeoutError extends CliError {
  constructor(message: string) {
    super(message, "timeout_error");
    this.name = "TimeoutError";
  }
}

export class UserAbortError extends CliError {
  constructor() {
    super("", "user_abort", EXIT_SUCCESS);
    this.name = "UserAbortError";
  }
}
