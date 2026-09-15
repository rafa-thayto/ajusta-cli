import chalk from "chalk";
import { isStdoutPiped } from "./tty.js";
import { log } from "./logger.js";
import { CliError, EXIT_GENERAL } from "./errors.js";
import { VERSION, SCHEMA_VERSION } from "./constants.js";

let jsonModeOverride: boolean | null = null;

export function setJsonMode(enabled: boolean) {
  jsonModeOverride = enabled;
}

/** True if --json was passed or stdout is piped (non-TTY). */
export function isJsonMode(): boolean {
  if (jsonModeOverride !== null) return jsonModeOverride;
  return isStdoutPiped();
}

function wrap(data: unknown): Record<string, unknown> {
  const base: Record<string, unknown> = {
    _meta: { cliVersion: VERSION, schemaVersion: SCHEMA_VERSION },
  };
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return { ...base, ...(data as Record<string, unknown>) };
  }
  return { ...base, data };
}

/**
 * Output a success result.
 * - JSON mode: writes JSON (wrapped with `_meta`) to stdout
 * - Human mode: calls humanFormat() if provided, otherwise JSON to stdout
 */
export function outputResult(data: unknown, humanFormat?: () => void) {
  if (isJsonMode()) {
    log.data(wrap(data));
  } else if (humanFormat) {
    humanFormat();
  } else {
    log.data(wrap(data));
  }
}

/** Emit one newline-delimited JSON event (for `--stream`). */
export function outputEvent(data: unknown) {
  process.stdout.write(JSON.stringify(wrap(data)) + "\n");
}

/**
 * Output an error and exit.
 * - JSON mode: JSON error envelope to stderr
 * - Human mode: colored error message (plus the hint, if any) to stderr
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
    process.exit(0);
  }

  if (isJsonMode()) {
    process.stderr.write(JSON.stringify(cliErr.toJSON()) + "\n");
    process.exit(cliErr.exitCode);
  }

  if (cliErr.message) log.error(cliErr.message);
  if (cliErr.hint) {
    process.stderr.write(`    ${chalk.dim("Próximo passo:")} ${chalk.cyan(cliErr.hint)}\n`);
  }
  process.exit(cliErr.exitCode);
}
