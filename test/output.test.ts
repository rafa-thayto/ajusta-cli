import { test } from "node:test";
import assert from "node:assert/strict";
import { setJsonMode, outputResult } from "../src/lib/output.ts";
import { SCHEMA_VERSION, VERSION } from "../src/lib/constants.ts";

function captureStdout<T>(fn: () => T): { result: T; output: string } {
  const original = process.stdout.write.bind(process.stdout);
  let buffer = "";
  (process.stdout.write as unknown) = (chunk: string | Uint8Array) => {
    buffer += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
    return true;
  };
  try {
    const result = fn();
    return { result, output: buffer };
  } finally {
    (process.stdout.write as unknown) = original;
  }
}

test("outputResult wraps objects with _meta envelope in JSON mode", () => {
  setJsonMode(true);
  const { output } = captureStdout(() => outputResult({ orderId: "abc123" }));
  const parsed = JSON.parse(output);
  assert.deepEqual(parsed._meta, {
    cliVersion: VERSION,
    schemaVersion: SCHEMA_VERSION,
  });
  assert.equal(parsed.orderId, "abc123");
});

test("outputResult puts non-object data under `data` key", () => {
  setJsonMode(true);
  const { output } = captureStdout(() => outputResult(42));
  const parsed = JSON.parse(output);
  assert.equal(parsed.data, 42);
  assert.equal(parsed._meta.schemaVersion, SCHEMA_VERSION);
});

test("outputResult prefers humanFormat callback in human mode", () => {
  setJsonMode(false);
  let called = false;
  const { output } = captureStdout(() =>
    outputResult({ x: 1 }, () => {
      called = true;
    }),
  );
  assert.equal(called, true);
  assert.equal(output, "");
});
