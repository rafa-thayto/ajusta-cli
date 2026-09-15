import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkApi, checkNodeVersion, checkSkill, checkUpdate, skillDrift } from "../src/lib/doctor.ts";

function tmpDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

test("checkNodeVersion passes on 18+ and fails below", () => {
  assert.equal(checkNodeVersion("18.0.0").status, "pass");
  assert.equal(checkNodeVersion("22.16.0").status, "pass");
  const old = checkNodeVersion("16.20.0");
  assert.equal(old.status, "fail");
  assert.ok(old.hint);
});

test("checkApi passes on {status:'ok'} and fails with the reason otherwise", async () => {
  assert.equal((await checkApi(async () => ({ status: "ok" }), "https://x")).status, "pass");
  const down = await checkApi(async () => {
    throw new Error("ECONNREFUSED");
  }, "https://x");
  assert.equal(down.status, "fail");
  assert.match(down.message, /ECONNREFUSED/);
});

test("checkSkill: missing → warn with install hint; in sync → pass; drifted → warn with --force", () => {
  const source = tmpDir("ajusta-skill-src-");
  fs.writeFileSync(path.join(source, "SKILL.md"), "v2");
  fs.mkdirSync(path.join(source, "references"));
  fs.writeFileSync(path.join(source, "references", "a.md"), "a");

  const missing = path.join(tmpDir("ajusta-skill-dst-"), "ajusta-cv");
  assert.equal(checkSkill(missing, source).status, "warn");
  assert.equal(checkSkill(missing, source).hint, "ajusta install-skill");

  const installed = tmpDir("ajusta-skill-ok-");
  fs.writeFileSync(path.join(installed, "SKILL.md"), "v2");
  fs.mkdirSync(path.join(installed, "references"));
  fs.writeFileSync(path.join(installed, "references", "a.md"), "a");
  assert.equal(checkSkill(installed, source).status, "pass");
  assert.deepEqual(skillDrift(source, installed), []);

  fs.writeFileSync(path.join(installed, "SKILL.md"), "v1");
  const drifted = checkSkill(installed, source);
  assert.equal(drifted.status, "warn");
  assert.equal(drifted.hint, "ajusta install-skill --force");
  assert.deepEqual(skillDrift(source, installed), ["SKILL.md"]);
});

test("checkUpdate: newer available → warn with `ajusta update`; unreachable → warn without hint", async () => {
  const newer = await checkUpdate(async () => "9.9.9", "1.0.0");
  assert.equal(newer.status, "warn");
  assert.equal(newer.hint, "ajusta update");
  assert.equal((await checkUpdate(async () => "1.0.0", "1.0.0")).status, "pass");
  const unreachable = await checkUpdate(async () => null, "1.0.0");
  assert.equal(unreachable.status, "warn");
  assert.equal(unreachable.hint, undefined);
});
