import ora, { type Ora } from "ora";
import { isTTY } from "./tty.js";
import { log } from "./logger.js";
import { isJsonMode } from "./output.js";
import { ApiError } from "./errors.js";
import { MAX_RETRIES } from "./constants.js";

let activeSpinner: Ora | null = null;

/** Stop any running spinner (used by SIGINT handler). */
export function stopActiveSpinner() {
  if (activeSpinner) {
    activeSpinner.stop();
    activeSpinner = null;
  }
}

interface SpinnerOpts {
  retries?: number;
  successText?: string;
}

/**
 * Wrap an async operation with a spinner + retry logic.
 *
 * - In JSON/CI mode: runs fn() directly (no spinner), still retries.
 * - Retries on 429 and 5xx with exponential backoff (1s, 2s, 4s).
 */
export async function withSpinner<T>(
  text: string,
  fn: () => Promise<T>,
  opts: SpinnerOpts = {},
): Promise<T> {
  const maxRetries = opts.retries ?? MAX_RETRIES;
  const useSpinner = isTTY() && !isJsonMode();

  const spinner = useSpinner
    ? ora({ text, stream: process.stderr }).start()
    : null;

  if (spinner) activeSpinner = spinner;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (spinner) {
        spinner.succeed(opts.successText);
        activeSpinner = null;
      }
      return result;
    } catch (err) {
      lastError = err;

      const isRetryable =
        err instanceof ApiError &&
        (err.statusCode === 429 || err.statusCode >= 500);

      if (!isRetryable || attempt === maxRetries) {
        if (spinner) {
          spinner.fail();
          activeSpinner = null;
        }
        throw err;
      }

      const delay = Math.pow(2, attempt) * 1_000;
      log.debug(
        `Tentativa ${attempt + 1} falhou (HTTP ${(err as ApiError).statusCode}), retentando em ${delay}ms...`,
      );

      if (spinner) {
        spinner.text = `${text} (tentativa ${attempt + 2}/${maxRetries + 1})`;
      }

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
