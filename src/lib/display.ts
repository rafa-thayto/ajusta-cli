import chalk from "chalk";
import qrcode from "qrcode-terminal";
import type { OrderCreatedResponse, OrderDetailResponse } from "./api.js";
import { PRODUCTS, type Product } from "./constants.js";

function generateQrCode(text: string): Promise<string> {
  return new Promise((resolve) => {
    qrcode.generate(text, { small: true }, (code: string) => {
      resolve(code);
    });
  });
}

export function formatPrice(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export function productLabel(product: Product | string): string {
  return (PRODUCTS as Record<string, { name: string }>)[product]?.name ?? product;
}

export async function displayPaymentInfo(
  order: OrderCreatedResponse,
  product: Product = "improve_curriculum",
): Promise<void> {
  if (order.zeroPriceOrder || order.finalPriceCents === 0) {
    process.stderr.write(
      `\n  ${chalk.green("✔")} ${chalk.bold("Pedido gratuito via cupom!")} Processamento iniciado.\n`,
    );
    process.stderr.write(`  ${chalk.bold("Pedido:")} ${chalk.dim(order.orderId)}\n\n`);
    return;
  }

  const priceFormatted = formatPrice(order.finalPriceCents);
  const discount =
    order.discountCents && order.discountCents > 0
      ? `  ${chalk.bold("Desconto:")} ${chalk.yellow(`- ${formatPrice(order.discountCents)}`)}\n`
      : "";

  process.stderr.write(`
${chalk.bold("  ╔══════════════════════════════════════════╗")}
${chalk.bold("  ║") + chalk.bold.cyan("         AjustaCV — Pagamento PIX         ") + chalk.bold("║")}
${chalk.bold("  ╚══════════════════════════════════════════╝")}

  ${chalk.bold("Produto:")} ${chalk.cyan(productLabel(product))}
  ${chalk.bold("Valor:")}  ${chalk.green.bold(priceFormatted)}
${discount}  ${chalk.bold("Pedido:")} ${chalk.dim(order.orderId)}
`);

  if (order.brCode) {
    const qr = await generateQrCode(order.brCode);
    process.stderr.write(`${chalk.bold("  QR Code PIX:")}\n\n`);
    const indented = qr.split("\n").map((line) => `    ${line}`).join("\n");
    process.stderr.write(indented + "\n\n");

    process.stderr.write(`${chalk.bold("  PIX Copia e Cola:")}\n\n`);
    process.stderr.write(`  ${chalk.cyan(order.brCode)}\n\n`);
  }

  if (order.paymentUrl) {
    process.stderr.write(
      `  ${chalk.bold("Pagar no navegador:")} ${chalk.underline.cyan(order.paymentUrl)}\n\n`,
    );
  }

  if (order.expiresAt) {
    const expires = new Date(order.expiresAt);
    const mins = Math.max(0, Math.round((expires.getTime() - Date.now()) / 60000));
    process.stderr.write(
      `  ${chalk.dim(`Expira em ~${mins} minuto(s) (${expires.toLocaleTimeString("pt-BR")}).`)}\n\n`,
    );
  }

  process.stderr.write(
    `${chalk.dim("  Escaneie o QR code ou cole o código PIX no app do seu banco.")}\n\n`,
  );
}

const STEP_LABELS: Record<string, string> = {
  pending_payment: `${String.fromCodePoint(0x23f3)} Aguardando pagamento...`,
  paid: `${String.fromCodePoint(0x2705)} Pago! Entrando na fila...`,
  processing: `${String.fromCodePoint(0x2699, 0xfe0f)}  Processando...`,
  completed: `${String.fromCodePoint(0x1f389)} Concluído!`,
  failed: `${String.fromCodePoint(0x274c)} Falhou`,
  expired: `${String.fromCodePoint(0x23f0)} Expirado`,
};

export function statusLabel(status: string, step?: string | null): string {
  if (status === "processing" && step) {
    return `${String.fromCodePoint(0x2699, 0xfe0f)}  ${step}`;
  }
  return STEP_LABELS[status] || status;
}

export function displayOrderStatus(order: {
  orderId: string;
  status: string;
  processingStep?: string | null;
  product?: Product | string;
}): void {
  const label = statusLabel(order.status, order.processingStep ?? undefined);
  const product = order.product ? productLabel(order.product) : null;

  process.stderr.write(`
  ${chalk.bold("Pedido:")}   ${chalk.dim(order.orderId)}
${product ? `  ${chalk.bold("Produto:")}  ${chalk.cyan(product)}\n` : ""}  ${chalk.bold("Status:")}   ${label}
`);

  if (order.status === "completed") {
    process.stderr.write(
      `\n  ${chalk.dim("Baixe com:")} ${chalk.cyan(`ajusta order download ${order.orderId}`)}\n`,
    );
  }

  process.stderr.write("\n");
}

// ── Full order display (M5) ─────────────────────────────────────────

function check(ok: boolean | undefined): string {
  return ok ? chalk.green("✔") : chalk.dim("✘");
}

export function displayFullOrderInfo(order: OrderDetailResponse): void {
  const product = productLabel(order.product);
  const label = statusLabel(order.status, order.processingStep ?? undefined);

  process.stderr.write(`
  ${chalk.bold("Pedido:")}   ${chalk.dim(order.id)}
  ${chalk.bold("Produto:")}  ${chalk.cyan(product)}
  ${chalk.bold("Status:")}   ${label}
`);

  if (typeof order.atsScoreOriginal === "number" && typeof order.atsScoreImproved === "number") {
    const delta = order.atsScoreImproved - order.atsScoreOriginal;
    const arrow = delta >= 0 ? chalk.green("↑") : chalk.red("↓");
    process.stderr.write(
      `  ${chalk.bold("ATS:")}      ${order.atsScoreOriginal} ${chalk.dim("→")} ${chalk.bold(String(order.atsScoreImproved))} ${arrow} ${delta >= 0 ? "+" : ""}${delta}\n`,
    );
  }

  process.stderr.write(
    `\n  ${chalk.bold("Arquivos disponíveis:")}\n` +
      `    ${check(order.hasOriginalFile)} original\n` +
      `    ${check(order.hasImprovedPdf)} improved (PDF)\n` +
      `    ${check(order.hasImprovedDocx)} improved (DOCX)\n` +
      `    ${check(order.hasImprovedLatex)} improved (LaTeX)\n` +
      `    ${check(order.hasGeneratedPhoto)} generated-photo\n`,
  );

  const counters: string[] = [];
  if (typeof order.editCount === "number" && typeof order.editMaxCount === "number") {
    counters.push(`edições ${order.editCount}/${order.editMaxCount}`);
  }
  if (typeof order.readjustCount === "number" && typeof order.readjustMaxCount === "number") {
    counters.push(`reajustes ${order.readjustCount}/${order.readjustMaxCount}`);
  }
  if (
    typeof order.photoRegenerateCount === "number" &&
    typeof order.photoRegenerateMaxCount === "number"
  ) {
    counters.push(`regens de foto ${order.photoRegenerateCount}/${order.photoRegenerateMaxCount}`);
  }
  if (typeof order.emailResendCount === "number" && typeof order.emailResendMaxCount === "number") {
    counters.push(`reenvios ${order.emailResendCount}/${order.emailResendMaxCount}`);
  }
  if (counters.length > 0) {
    process.stderr.write(`\n  ${chalk.bold("Uso:")} ${chalk.dim(counters.join(" · "))}\n`);
  }

  process.stderr.write("\n");
}

// ── ATS score card (M3) ─────────────────────────────────────────────

export function displayAtsScoreCard(result: {
  score: number;
  scoreInterpretation?: string;
  categories: Record<string, { score: number | null; weight: number } | null>;
  details: {
    matchedKeywords?: string[];
    missingKeywords?: string[];
    issues?: string[];
    strengths?: string[];
  };
}): void {
  const scoreColor = result.score >= 75 ? chalk.green : result.score >= 50 ? chalk.yellow : chalk.red;

  process.stderr.write(`
  ${chalk.bold("╔══════════════════════════════════════════╗")}
  ${chalk.bold("║") + chalk.bold.cyan("         AjustaCV — Análise ATS           ") + chalk.bold("║")}
  ${chalk.bold("╚══════════════════════════════════════════╝")}

           ${scoreColor.bold(String(result.score).padStart(3))}
         ${scoreColor("━━━━━━━━━")}
         ${chalk.dim("Pontuação")}

  ${chalk.bold("── Categorias ────────────────────────────────────────")}

`);

  const labels: Record<string, string> = {
    keywords: "Palavras-chave",
    content: "Conteúdo       ",
    structure: "Estrutura      ",
    completeness: "Completude     ",
    formatting: "Formatação     ",
  };

  for (const key of ["keywords", "content", "structure", "completeness", "formatting"]) {
    const cat = result.categories[key];
    if (!cat) continue;
    const score = cat.score ?? 0;
    const weight = Math.round(cat.weight * 100);
    const filled = Math.max(0, Math.min(20, Math.round((score / 100) * 20)));
    const bar = "█".repeat(filled) + "░".repeat(20 - filled);
    const barColor = score >= 75 ? chalk.green : score >= 50 ? chalk.yellow : chalk.red;
    process.stderr.write(
      `  ${labels[key] ?? key.padEnd(15)} ${chalk.dim(`${weight}%`.padStart(4))}  [${barColor(bar)}]  ${String(score).padStart(3)}/100\n`,
    );
  }

  if (result.details.matchedKeywords && result.details.matchedKeywords.length > 0) {
    process.stderr.write(
      `\n  ${chalk.bold("── Palavras-chave encontradas ───────────────────────")}\n\n  `,
    );
    process.stderr.write(
      result.details.matchedKeywords.map((k) => `${chalk.green("✔")} ${k}`).join("   "),
    );
    process.stderr.write("\n");
  }

  if (result.details.missingKeywords && result.details.missingKeywords.length > 0) {
    process.stderr.write(
      `\n  ${chalk.bold("── Palavras-chave ausentes ───────────────────────────")}\n\n  `,
    );
    process.stderr.write(
      result.details.missingKeywords.map((k) => `${chalk.red("✘")} ${k}`).join("   "),
    );
    process.stderr.write("\n");
  }

  if (result.details.issues && result.details.issues.length > 0) {
    process.stderr.write(
      `\n  ${chalk.bold("── Pontos de melhoria ────────────────────────────────")}\n\n`,
    );
    for (const i of result.details.issues) {
      process.stderr.write(`  ${chalk.red("✘")} ${i}\n`);
    }
  }

  if (result.details.strengths && result.details.strengths.length > 0) {
    process.stderr.write(
      `\n  ${chalk.bold("── Pontos fortes ─────────────────────────────────────")}\n\n`,
    );
    for (const s of result.details.strengths) {
      process.stderr.write(`  ${chalk.green("✔")} ${s}\n`);
    }
  }

  if (result.scoreInterpretation) {
    process.stderr.write(`\n  ${chalk.dim(result.scoreInterpretation)}\n`);
  }

  process.stderr.write("\n");
}

// ── Coupon display (M4) ─────────────────────────────────────────────

export function displayCouponInfo(
  result: {
    valid: boolean;
    code?: string;
    type?: "percentage" | "fixed";
    value?: number;
    discountCents?: number;
    finalPriceCents?: number;
    error?: string;
  },
  product: Product | string,
): void {
  if (!result.valid) {
    process.stderr.write(
      `\n  ${chalk.red("✘")} Cupom inválido${result.error ? `: ${result.error}` : "."}\n\n`,
    );
    return;
  }

  const productName = productLabel(product);
  const productPrice = (PRODUCTS as Record<string, { priceCents: number }>)[product]?.priceCents;
  const discount = result.discountCents ?? 0;
  const final = result.finalPriceCents ?? Math.max(0, (productPrice ?? 0) - discount);
  const typeLabel = result.type === "percentage" ? `${result.value}%` : formatPrice(result.value ?? 0);

  process.stderr.write(`
  ${chalk.bold("Cupom:")}    ${chalk.cyan(result.code)}
  ${chalk.bold("Produto:")}  ${productName}
  ${chalk.bold("Tipo:")}     ${chalk.dim(result.type ?? "?")} (${typeLabel})
  ${chalk.bold("Desconto:")} ${chalk.yellow(`- ${formatPrice(discount)}`)}
  ${chalk.bold("Total:")}    ${chalk.green.bold(formatPrice(final))}
`);

  if (final === 0) {
    process.stderr.write(`\n  ${chalk.green("✔")} Pedido será gratuito com este cupom.\n`);
  }
  process.stderr.write("\n");
}

// ── Readjust info (M5) ─────────────────────────────────────────────

export function displayReadjustInfo(info: {
  parentOrderId: string;
  readjustCount: number;
  readjustMaxCount: number;
  readjustPriceCents: number;
  hasResumeFile: boolean;
  hasResumeText: boolean;
}): void {
  const remaining = info.readjustMaxCount - info.readjustCount;
  process.stderr.write(`
  ${chalk.bold("Pedido pai:")}   ${chalk.dim(info.parentOrderId)}
  ${chalk.bold("Reajustes:")}    ${info.readjustCount}/${info.readjustMaxCount} (${remaining} restantes)
  ${chalk.bold("Preço:")}        ${chalk.green.bold(formatPrice(info.readjustPriceCents))}
  ${chalk.bold("Conteúdo:")}     ${info.hasResumeFile ? "arquivo" : ""}${info.hasResumeFile && info.hasResumeText ? " + " : ""}${info.hasResumeText ? "texto" : ""}

`);
}
