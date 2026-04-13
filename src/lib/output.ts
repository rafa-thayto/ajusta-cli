import { isStdoutPiped } from "./tty.js";
import { log } from "./logger.js";
import { CliError, EXIT_GENERAL } from "./errors.js";

let jsonModeOverride: boolean | null = null;

export function setJsonMode(enabled: boolean) {
  jsonModeOverride = enabled;
}

/** True if --json was passed or stdout is piped (non-TTY). */
export function isJsonMode(): boolean {
  if (jsonModeOverride !== null) return jsonModeOverride;
  return isStdoutPiped();
}

/**
 * Output a success result.
 * - JSON mode: writes JSON to stdout
 * - Human mode: calls humanFormat() if provided, otherwise JSON to stdout
 */
export function outputResult(data: unknown, humanFormat?: () => void) {
  if (isJsonMode()) {
    log.data(data);
  } else if (humanFormat) {
    humanFormat();
  } else {
    log.data(data);
  }
}

/**
 * Output an error and exit.
 * - JSON mode: JSON error envelope to stderr
 * - Human mode: colored error message to stderr
 */
export function outputError(err: unknown): never {
  const cliErr =
    err instanceof CliError
      ? err
      : new CliError(
          err instanceof Error ? err.message : String(err),
          "unknown_error",
          EXIT_GENERAL,
        );

  if (cliErr.exitCode === 0) {
    // UserAbortError — silent exit
    process.exit(0);
  }

  if (isJsonMode()) {
    process.stderr.write(JSON.stringify(cliErr.toJSON()) + "\n");
  } else {
    if (cliErr.message) log.error(cliErr.message);
  }

  process.exit(cliErr.exitCode);
}
