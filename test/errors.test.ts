import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CliError,
  FileError,
  ApiError,
  NetworkError,
  TimeoutError,
  RateLimitError,
  UserAbortError,
  EXIT_API,
  EXIT_NETWORK,
  EXIT_TIMEOUT,
  EXIT_TIMEOUT_EXPLICIT,
  EXIT_USAGE,
  EXIT_SUCCESS,
  EXIT_GENERAL,
} from "../src/lib/errors.ts";

test("CliError exposes code + exitCode + JSON envelope", () => {
  const err = new CliError("boom", "api_error", EXIT_API);
  assert.equal(err.message, "boom");
  assert.equal(err.code, "api_error");
  assert.equal(err.exitCode, EXIT_API);
  assert.deepEqual(err.toJSON(), { error: { message: "boom", code: "api_error" } });
});

test("CliError defaults exitCode to 1 (general)", () => {
  const err = new CliError("x", "unknown_error");
  assert.equal(err.exitCode, EXIT_GENERAL);
});

test("FileError uses EXIT_USAGE for file_not_found, EXIT_GENERAL otherwise", () => {
  assert.equal(new FileError("nf", "file_not_found").exitCode, EXIT_USAGE);
  assert.equal(new FileError("big", "file_too_large").exitCode, EXIT_GENERAL);
  assert.equal(new FileError("fmt", "unsupported_format").exitCode, EXIT_GENERAL);
});

test("ApiError carries statusCode and maps to EXIT_API", () => {
  const err = new ApiError("server error", 502);
  assert.equal(err.statusCode, 502);
  assert.equal(err.code, "api_error");
  assert.equal(err.exitCode, EXIT_API);
});

test("NetworkError maps to EXIT_NETWORK", () => {
  const err = new NetworkError("no route to host");
  assert.equal(err.code, "network_error");
  assert.equal(err.exitCode, EXIT_NETWORK);
});

test("TimeoutError distinguishes implicit vs explicit exit codes", () => {
  assert.equal(new TimeoutError("t").exitCode, EXIT_TIMEOUT);
  assert.equal(new TimeoutError("t", true).exitCode, EXIT_TIMEOUT_EXPLICIT);
});

test("RateLimitError optionally carries retryAfterMs", () => {
  const err = new RateLimitError("slow down", 30_000);
  assert.equal(err.retryAfterMs, 30_000);
  assert.equal(err.code, "rate_limit_error");
  assert.equal(err.exitCode, EXIT_API);
  assert.equal(new RateLimitError("no after").retryAfterMs, undefined);
});

test("UserAbortError uses EXIT_SUCCESS (silent exit)", () => {
  const err = new UserAbortError();
  assert.equal(err.exitCode, EXIT_SUCCESS);
  assert.equal(err.code, "user_abort");
});
