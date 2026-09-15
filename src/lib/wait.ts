import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import type { OrderCreatedResponse, OrderStatus } from "./api.js";
import type { Product } from "./constants.js";
import { CliError, EXIT_API, FileError } from "./errors.js";
import { displayPaymentInfo, statusLabel } from "./display.js";
import { isJsonMode, outputResult } from "./output.js";
import { log } from "./logger.js";
import { isTTY } from "./tty.js";
import { pollUntilComplete, type PollOptions, type PollResult } from "./poll.js";

/** `--timeout <minutos>` → ms, falling back when the value is not a number. */
export function timeoutMinutesToMs(raw: unknown, fallbackMinutes: number): number {
  const parsed = parseInt(String(raw), 10);
  const minutes = Number.isNaN(parsed) || parsed <= 0 ? fallbackMinutes : parsed;
  return minutes * 60 * 1_000;
}

/** Refuse to clobber an output file unless --force was given. */
export function ensureWritable(output: string, force: boolean | undefined): void {
  if (!fs.existsSync(output) || force) return;
  throw new FileError(
    `Arquivo já existe: ${path.resolve(output)}.`,
    "file_exists",
    "Use --force para sobrescrever ou -o <outro-caminho>.",
  );
}

export interface PaidFlowOptions {
  output: string;
  noDownload: boolean;
  noWait: boolean;
  timeoutMs: number;
}

/**
 * The options every paid command shares. `--no-download` and `--no-wait`
 * both mean "do not write the file", so the output path is only checked
 * when neither is set.
 */
export function parsePaidFlowOptions(
  opts: Record<string, unknown>,
  defaultTimeoutMinutes: number,
): PaidFlowOptions {
  const parsed = {
    output: opts.output as string,
    noDownload: opts.download === false,
    noWait: opts.wait === false,
    timeoutMs: timeoutMinutesToMs(opts.timeout, defaultTimeoutMinutes),
  };
  if (!parsed.noDownload && !parsed.noWait) ensureWritable(parsed.output, opts.force as boolean | undefined);
  return parsed;
}

/** The JSON shape every order-creating command prints, with or without --no-wait. */
export function orderCreatedPayload(order: OrderCreatedResponse, extra: Record<string, unknown> = {}) {
  return {
    orderId: order.orderId,
    status: "pending_payment" as const,
    paymentUrl: order.paymentUrl,
    brCode: order.brCode,
    expiresAt: order.expiresAt,
    finalPriceCents: order.finalPriceCents,
    discountCents: order.discountCents,
    zeroPriceOrder: order.zeroPriceOrder ?? false,
    ...extra,
  };
}

/**
 * Announce a freshly created order. In JSON mode this is the first (and with
 * --no-wait, the only) document on stdout; humans get the PIX card.
 */
export async function announceOrder(
  order: OrderCreatedResponse,
  product: Product,
  opts: { noWait: boolean; extra?: Record<string, unknown> },
): Promise<void> {
  const waitHint = `ajusta order wait ${order.orderId}`;
  if (isJsonMode()) {
    outputResult(orderCreatedPayload(order, { ...opts.extra, ...(opts.noWait ? { next: waitHint } : {}) }));
    return;
  }
  await displayPaymentInfo(order, product);
  if (opts.noWait) {
    log.info(`Acompanhe com: ${chalk.cyan(waitHint)}`);
  }
}

export interface WaitOptions {
  timeoutMs: number;
  /** Status shown on the spinner before the first poll answers. */
  initialStatus?: OrderStatus;
  afterPayment?: PollOptions["afterPayment"];
  onChange?: PollOptions["onChange"];
  /** Fallback step label while processing has no step of its own (photo). */
  processingFallback?: string;
}

/**
 * Poll an order to a terminal state with the shared spinner, and turn a
 * non-completed outcome into a typed error whose hint says what to run next.
 */
export async function waitForOrder(orderId: string, opts: WaitOptions): Promise<PollResult> {
  const spinner: Ora | null =
    isTTY() && !isJsonMode()
      ? ora({ text: statusLabel(opts.initialStatus ?? "pending_payment"), stream: process.stderr }).start()
      : null;

  const result = await pollUntilComplete(orderId, {
    timeoutMs: opts.timeoutMs,
    afterPayment: opts.afterPayment,
    onChange: (snapshot) => {
      opts.onChange?.(snapshot);
      if (!spinner) return;
      const step =
        snapshot.processingStep ??
        (snapshot.status === "processing" ? opts.processingFallback : undefined);
      spinner.text = statusLabel(snapshot.status, step);
    },
  });

  if (result.status === "completed") {
    spinner?.succeed(chalk.green(statusLabel("completed")));
    return result;
  }

  spinner?.fail(chalk.red(statusLabel(result.status)));
  return result;
}

/** Throw the typed error for a failed or expired order; return the order otherwise. */
export function assertCompleted(result: PollResult, orderId: string): PollResult["order"] {
  if (result.status === "completed") return result.order;
  if (result.status === "failed") {
    throw new CliError(
      "O processamento falhou. Se o problema persistir, verifique se o arquivo não está corrompido ou abra um ticket com `ajusta support`.",
      "order_failed",
      { exitCode: EXIT_API, hint: `ajusta order retry ${orderId} --follow` },
    );
  }
  throw new CliError(
    "O tempo para pagamento expirou. Um pedido expirado não pode ser reaproveitado.",
    "order_expired",
    { exitCode: EXIT_API, hint: "Execute o comando novamente para gerar um novo PIX." },
  );
}
