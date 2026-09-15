import { test } from "node:test";
import assert from "node:assert/strict";
import { assertCompleted, orderCreatedPayload, timeoutMinutesToMs } from "../src/lib/wait.ts";
import { CliError, EXIT_API } from "../src/lib/errors.ts";
import type { OrderDetailResponse } from "../src/lib/api.ts";

const order = (status: OrderDetailResponse["status"]): OrderDetailResponse => ({
  id: "o1",
  status,
  product: "improve_curriculum",
});

test("timeoutMinutesToMs converts minutes and falls back on garbage", () => {
  assert.equal(timeoutMinutesToMs("2", 30), 120_000);
  assert.equal(timeoutMinutesToMs("abc", 30), 1_800_000);
  assert.equal(timeoutMinutesToMs("0", 15), 900_000);
  assert.equal(timeoutMinutesToMs(undefined, 15), 900_000);
});

test("orderCreatedPayload is the stable first document of every paid flow", () => {
  const payload = orderCreatedPayload(
    { orderId: "o1", finalPriceCents: 780, brCode: "000201", paymentUrl: "https://pay" },
    { parentOrderId: "p1" },
  );
  assert.equal(payload.status, "pending_payment");
  assert.equal(payload.zeroPriceOrder, false);
  assert.equal(payload.parentOrderId, "p1");
  assert.equal(payload.brCode, "000201");
});

test("assertCompleted returns the order when completed", () => {
  const o = order("completed");
  assert.equal(assertCompleted({ status: "completed", order: o }, "o1"), o);
});

test("assertCompleted maps failed → order_failed with a retry hint", () => {
  assert.throws(
    () => assertCompleted({ status: "failed", order: order("failed") }, "o1"),
    (err) =>
      err instanceof CliError &&
      err.code === "order_failed" &&
      err.exitCode === EXIT_API &&
      err.hint === "ajusta order retry o1 --follow",
  );
});

test("assertCompleted maps expired → order_expired", () => {
  assert.throws(
    () => assertCompleted({ status: "expired", order: order("expired") }, "o1"),
    (err) => err instanceof CliError && err.code === "order_expired" && err.exitCode === EXIT_API,
  );
});
