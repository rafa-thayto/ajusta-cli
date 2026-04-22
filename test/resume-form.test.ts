import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  extractFillBody,
  parseResumeSpecFile,
  type CreateResumeSpec,
} from "../src/lib/resume-form.ts";
import { FileError } from "../src/lib/errors.ts";

function writeJson(obj: unknown): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ajusta-spec-"));
  const file = path.join(dir, "spec.json");
  fs.writeFileSync(file, JSON.stringify(obj));
  return file;
}

test("parseResumeSpecFile loads valid JSON", () => {
  const file = writeJson({ name: "A", email: "a@b.co" });
  const spec = parseResumeSpecFile(file);
  assert.equal(spec.name, "A");
  assert.equal(spec.email, "a@b.co");
});

test("parseResumeSpecFile throws file_not_found for missing path", () => {
  assert.throws(
    () => parseResumeSpecFile("/nonexistent/path/spec.json"),
    (err) => err instanceof FileError && err.code === "file_not_found",
  );
});

test("parseResumeSpecFile throws invalid_spec on bad JSON", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ajusta-spec-"));
  const file = path.join(dir, "bad.json");
  fs.writeFileSync(file, "{not json");
  assert.throws(
    () => parseResumeSpecFile(file),
    (err) => err instanceof FileError && err.code === "invalid_spec",
  );
});

test("parseResumeSpecFile rejects non-objects", () => {
  const file = writeJson(["a", "b"]);
  assert.throws(
    () => parseResumeSpecFile(file),
    (err) => err instanceof FileError && err.code === "invalid_spec",
  );
});

test("extractFillBody strips checkout fields and keeps resume fields", () => {
  const spec: CreateResumeSpec = {
    name: "Name",
    email: "e@x.co",
    cpf: "12345678909",
    phone: "11987654321",
    jobDescription: "Backend vacancy",
    linkedinUrl: "https://linkedin.com/in/x",
    experiences: [
      { role: "Dev", company: "X", startDate: "01/2020", description: "D" },
    ],
    skills: ["TypeScript"],
    languages: [{ language: "pt", level: "Nativo" }],
  };
  const body = extractFillBody(spec);
  assert.equal((body as Record<string, unknown>).jobDescription, "Backend vacancy");
  assert.equal((body as Record<string, unknown>).linkedinUrl, "https://linkedin.com/in/x");
  assert.ok(Array.isArray((body as Record<string, unknown>).experiences));
  assert.ok(Array.isArray((body as Record<string, unknown>).skills));
  assert.ok(Array.isArray((body as Record<string, unknown>).languages));
  // Checkout fields must NOT be present
  assert.equal((body as Record<string, unknown>).name, undefined);
  assert.equal((body as Record<string, unknown>).email, undefined);
  assert.equal((body as Record<string, unknown>).cpf, undefined);
  assert.equal((body as Record<string, unknown>).phone, undefined);
});

test("extractFillBody omits empty arrays", () => {
  const body = extractFillBody({
    name: "N",
    email: "e@x.co",
    cpf: "1",
    phone: "1",
    skills: [],
    experiences: [],
  } as CreateResumeSpec);
  assert.equal((body as Record<string, unknown>).skills, undefined);
  assert.equal((body as Record<string, unknown>).experiences, undefined);
});
