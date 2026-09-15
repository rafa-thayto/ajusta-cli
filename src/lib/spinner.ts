import ora, { type Ora } from "ora";
import { isTTY } from "./tty.js";
import { log } from "./logger.js";
import { isJsonMode } from "./output.js";
import { ApiError, NetworkError, RateLimitError } from "./errors.js";
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

/** Longest we will honour a Retry-After header before giving up on the attempt. */
const MAX_RETRY_AFTER_MS = 30_000;

export function isRetryable(err: unknown): boolean {
  if (err instanceof RateLimitError) return true;
  if (err instanceof NetworkError) return true;
  return err instanceof ApiError && err.statusCode >= 500;
}

/** Backoff for a given attempt, honouring Retry-After on rate limits. */
export function retryDelayMs(err: unknown, attempt: number): number {
  const backoff = Math.pow(2, attempt) * 1_000;
  if (err instanceof RateLimitError && err.retryAfterMs !== undefined) {
    return Math.min(Math.max(err.retryAfterMs, backoff), MAX_RETRY_AFTER_MS);
  }
  return backoff;
}

/**
 * Wrap an async operation with a spinner + retry logic.
 *
 * - In JSON/CI mode: runs fn() directly (no spinner), still retries.
 * - Retries on 429, 5xx and connection failures with exponential backoff
 *   (1s, 2s, 4s); a 429 waits at least its Retry-After.
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

      if (!isRetryable(err) || attempt === maxRetries) {
        if (spinner) {
          spinner.fail();
          activeSpinner = null;
        }
        throw err;
      }

      const delay = retryDelayMs(err, attempt);
      const reason = err instanceof Error ? err.message : String(err);
      log.debug(`Tentativa ${attempt + 1} falhou (${reason}), retentando em ${delay}ms...`);

      if (spinner) {
        spinner.text = `${text} (tentativa ${attempt + 2}/${maxRetries + 1})`;
      }

      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
