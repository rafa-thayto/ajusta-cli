import { getOrder, getOrderPaymentStatus, type OrderDetailResponse, type OrderStatus } from "./api.js";
import { POLL_INTERVAL_MS } from "./constants.js";
import { TimeoutError } from "./errors.js";

export interface PollOptions {
  /** Milliseconds after which to throw TimeoutError. */
  timeoutMs: number;
  /** Called whenever the status string or processingStep changes. */
  onChange?: (snapshot: {
    phase: "payment" | "processing";
    status: OrderStatus;
    processingStep?: string | null;
  }) => void;
  /** Polling interval in ms (default 3000). */
  intervalMs?: number;
  /** Signal to abort early. */
  signal?: AbortSignal;
}

export type PollResult =
  | { status: "completed"; order: OrderDetailResponse }
  | { status: "failed"; order: OrderDetailResponse }
  | { status: "expired"; order: OrderDetailResponse };

/**
 * Poll until the order reaches a terminal state.
 * Phase 1 — poll `/orders/:id/payment-status` until not `pending_payment`.
 * Phase 2 — poll `/orders/:id` until `completed | failed | expired`.
 */
export async function pollUntilComplete(
  orderId: string,
  opts: PollOptions,
): Promise<PollResult> {
  const start = Date.now();
  const interval = opts.intervalMs ?? POLL_INTERVAL_MS;

  let lastPhaseStatus = "";

  // ── Phase 1: payment ────────────────────────────────────────
  while (true) {
    if (opts.signal?.aborted) throw new Error("aborted");
    if (Date.now() - start > opts.timeoutMs) {
      throw new TimeoutError(
        `Tempo limite excedido aguardando pagamento. Use "ajusta order get ${orderId}" para verificar.`,
      );
    }

    const payment = await getOrderPaymentStatus(orderId);
    if (payment.status !== lastPhaseStatus) {
      lastPhaseStatus = payment.status;
      opts.onChange?.({ phase: "payment", status: payment.status });
    }

    if (payment.status !== "pending_payment") break;

    await sleep(interval, opts.signal);
  }

  // ── Phase 2: processing ─────────────────────────────────────
  let lastStatus = "";
  let lastStep: string | null = null;

  while (true) {
    if (opts.signal?.aborted) throw new Error("aborted");
    if (Date.now() - start > opts.timeoutMs) {
      throw new TimeoutError(
        `Tempo limite excedido aguardando processamento. Use "ajusta order get ${orderId}" para verificar.`,
      );
    }

    const order = await getOrder(orderId);
    if (order.status !== lastStatus || order.processingStep !== lastStep) {
      lastStatus = order.status;
      lastStep = order.processingStep ?? null;
      opts.onChange?.({
        phase: "processing",
        status: order.status,
        processingStep: order.processingStep ?? undefined,
      });
    }

    if (order.status === "completed") return { status: "completed", order };
    if (order.status === "failed") return { status: "failed", order };
    if (order.status === "expired") return { status: "expired", order };

    await sleep(interval, opts.signal);
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => resolve(), ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(timeout);
        reject(new Error("aborted"));
      };
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
