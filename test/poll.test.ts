import { test } from "node:test";
import assert from "node:assert/strict";
import { pollUntilComplete } from "../src/lib/poll.ts";
import { TimeoutError } from "../src/lib/errors.ts";
import type { OrderDetailResponse, OrderStatus } from "../src/lib/api.ts";

function order(status: OrderStatus, extra: Partial<OrderDetailResponse> = {}): OrderDetailResponse {
  return { id: "o1", status, product: "improve_curriculum", ...extra };
}

/** A scripted API: each call pops the next answer. */
function scripted(payments: OrderStatus[], orders: OrderDetailResponse[]) {
  const calls: string[] = [];
  return {
    calls,
    fetchers: {
      getPaymentStatus: async () => {
        calls.push("payment");
        return { status: payments.shift() ?? payments[payments.length - 1] ?? "paid" };
      },
      getOrder: async () => {
        calls.push("order");
        return orders.shift() ?? orders[orders.length - 1] ?? order("completed");
      },
    },
  };
}

test("pollUntilComplete runs afterPayment exactly once, between the two phases", async () => {
  const api = scripted(["pending_payment", "paid"], [order("processing"), order("completed")]);
  let afterPaymentRuns = 0;
  const result = await pollUntilComplete("o1", {
    timeoutMs: 10_000,
    intervalMs: 1,
    fetchers: api.fetchers,
    afterPayment: async () => {
      afterPaymentRuns += 1;
      assert.deepEqual(api.calls, ["payment", "payment"], "form is sent before processing is polled");
    },
  });
  assert.equal(afterPaymentRuns, 1);
  assert.equal(result.status, "completed");
});

test("pollUntilComplete skips afterPayment when the PIX expired", async () => {
  const api = scripted(["expired"], [order("expired")]);
  let ran = false;
  const result = await pollUntilComplete("o1", {
    timeoutMs: 10_000,
    intervalMs: 1,
    fetchers: api.fetchers,
    afterPayment: async () => {
      ran = true;
    },
  });
  assert.equal(ran, false);
  assert.equal(result.status, "expired");
});

test("pollUntilComplete reports status changes through onChange", async () => {
  const api = scripted(
    ["pending_payment", "paid"],
    [order("processing", { processingStep: "Lendo" }), order("processing", { processingStep: "Escrevendo" }), order("completed")],
  );
  const seen: string[] = [];
  await pollUntilComplete("o1", {
    timeoutMs: 10_000,
    intervalMs: 1,
    fetchers: api.fetchers,
    onChange: (s) => seen.push(`${s.phase}:${s.status}:${s.processingStep ?? ""}`),
  });
  assert.deepEqual(seen, [
    "payment:pending_payment:",
    "payment:paid:",
    "processing:processing:Lendo",
    "processing:processing:Escrevendo",
    "processing:completed:",
  ]);
});

test("pollUntilComplete times out with a hint pointing at order get", async () => {
  const fetchers = {
    getPaymentStatus: async () => ({ status: "pending_payment" as const }),
    getOrder: async () => order("completed"),
  };
  await assert.rejects(
    () => pollUntilComplete("o1", { timeoutMs: 5, intervalMs: 2, fetchers }),
    (err) => err instanceof TimeoutError && err.hint === "ajusta order get o1",
  );
});
