import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Isolate config writes to a temp dir for this test file.
const tmpConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "ajusta-cfg-"));
process.env.XDG_CONFIG_HOME = tmpConfigDir;

const {
  saveLastOrder,
  getLastOrder,
  getLastOrderId,
  savePendingCreate,
  readPendingCreate,
  clearPendingCreate,
} = await import("../src/lib/config.ts");

after(() => {
  fs.rmSync(tmpConfigDir, { recursive: true, force: true });
});

test("saveLastOrder + getLastOrder round-trip preserves product", () => {
  saveLastOrder("order-abc", "professional_photo");
  const last = getLastOrder();
  assert.ok(last);
  assert.equal(last!.orderId, "order-abc");
  assert.equal(last!.product, "professional_photo");
});

test("saveLastOrder defaults product to improve_curriculum when omitted", () => {
  saveLastOrder("order-def");
  const last = getLastOrder();
  assert.equal(last!.product, "improve_curriculum");
});

test("getLastOrderId is a thin accessor over getLastOrder", () => {
  saveLastOrder("the-id", "create_curriculum");
  assert.equal(getLastOrderId(), "the-id");
});

test("getLastOrder defaults product when legacy file has only orderId", () => {
  const file = path.join(tmpConfigDir, "ajusta", "last-order.json");
  fs.writeFileSync(file, JSON.stringify({ orderId: "legacy", savedAt: "now" }));
  const last = getLastOrder();
  assert.equal(last!.orderId, "legacy");
  assert.equal(last!.product, "improve_curriculum");
});

test("savePendingCreate + readPendingCreate + clearPendingCreate round-trip", () => {
  const payload = { experiences: [{ role: "r", company: "c" }] };
  const file = savePendingCreate("pending-xyz", payload);
  assert.ok(file);
  assert.equal(fs.existsSync(file!), true);

  const read = readPendingCreate("pending-xyz");
  assert.deepEqual(read, payload);

  clearPendingCreate("pending-xyz");
  assert.equal(fs.existsSync(file!), false);
  assert.equal(readPendingCreate("pending-xyz"), null);
});

test("readPendingCreate returns null for unknown orderId", () => {
  assert.equal(readPendingCreate("does-not-exist"), null);
});
