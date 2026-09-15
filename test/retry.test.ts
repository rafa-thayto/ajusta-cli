import { test } from "node:test";
import assert from "node:assert/strict";
import { isRetryable, retryDelayMs } from "../src/lib/spinner.ts";
import { ApiError, CliError, NetworkError, RateLimitError } from "../src/lib/errors.ts";

test("isRetryable: 429, 5xx and connection failures retry; 4xx and usage errors do not", () => {
  assert.equal(isRetryable(new RateLimitError("slow")), true);
  assert.equal(isRetryable(new ApiError("boom", 503)), true);
  assert.equal(isRetryable(new NetworkError("ECONNRESET")), true);
  assert.equal(isRetryable(new ApiError("nope", 404)), false);
  assert.equal(isRetryable(new CliError("x", "invalid_argument")), false);
});

test("retryDelayMs backs off exponentially and honours Retry-After (capped)", () => {
  assert.equal(retryDelayMs(new ApiError("x", 500), 0), 1_000);
  assert.equal(retryDelayMs(new ApiError("x", 500), 2), 4_000);
  assert.equal(retryDelayMs(new RateLimitError("x", 10_000), 0), 10_000);
  assert.equal(retryDelayMs(new RateLimitError("x", 500), 1), 2_000);
  assert.equal(retryDelayMs(new RateLimitError("x", 120_000), 0), 30_000);
});
