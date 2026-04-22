import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  resolveInput,
  resolvePhotoInput,
  resolveTextInput,
} from "../src/lib/input.ts";
import { FileError } from "../src/lib/errors.ts";

function tmpFile(ext: string, content: Buffer | string = "test"): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ajusta-in-"));
  const file = path.join(dir, `sample${ext}`);
  fs.writeFileSync(file, content);
  return file;
}

test("resolveInput throws file_not_found for empty input", () => {
  assert.throws(() => resolveInput(""), (err) => err instanceof FileError && err.code === "file_not_found");
});

test("resolveInput throws unsupported_format for .txt", () => {
  const file = tmpFile(".txt", "hi");
  assert.throws(
    () => resolveInput(file),
    (err) => err instanceof FileError && err.code === "unsupported_format",
  );
});

test("resolveInput succeeds for a small PDF", () => {
  const file = tmpFile(".pdf", Buffer.from("%PDF-1.4 dummy"));
  const resolved = resolveInput(file);
  assert.equal(resolved.type, "file");
  assert.equal(resolved.fileName, path.basename(file));
  assert.equal(resolved.mimeType, "application/pdf");
  assert.ok(resolved.buffer.length > 0);
});

test("resolveInput treats long no-path strings as base64", () => {
  const b64 = Buffer.from("hello world").toString("base64").repeat(20); // >100 chars, no slashes
  const resolved = resolveInput(b64);
  assert.equal(resolved.type, "base64");
  assert.equal(resolved.mimeType, "application/pdf");
});

test("resolvePhotoInput rejects unsupported extensions", () => {
  const file = tmpFile(".bmp", Buffer.from("x"));
  assert.throws(
    () => resolvePhotoInput(file),
    (err) => err instanceof FileError && err.code === "unsupported_photo_format",
  );
});

test("resolvePhotoInput accepts JPG and returns buffer", () => {
  const file = tmpFile(".jpg", Buffer.from([0xff, 0xd8, 0xff]));
  const resolved = resolvePhotoInput(file);
  assert.equal(resolved.fileName, path.basename(file));
  assert.match(resolved.mimeType, /^image\//);
});

test("resolveTextInput reads an existing text file", () => {
  const file = tmpFile(".txt", "hello world");
  assert.equal(resolveTextInput(file), "hello world");
});

test("resolveTextInput treats non-path strings as inline text", () => {
  assert.equal(resolveTextInput("just some inline text"), "just some inline text");
});

test("resolveTextInput returns empty for empty/whitespace input", () => {
  assert.equal(resolveTextInput(""), "");
  assert.equal(resolveTextInput("   "), "");
});
