import chalk from "chalk";
import type { CliOrderResponse, CliOrderStatus } from "./api.js";

export function displayPaymentInfo(order: CliOrderResponse): void {
  const priceFormatted = (order.priceCents / 100)
    .toFixed(2)
    .replace(".", ",");

  process.stderr.write(`
${chalk.bold("  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557")}
${chalk.bold("  \u2551") + chalk.bold.cyan("         AjustaCV \u2014 Pagamento PIX         ") + chalk.bold("\u2551")}
${chalk.bold("  \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}

  ${chalk.bold("Valor:")}  R$ ${chalk.green.bold(priceFormatted)}
  ${chalk.bold("Pedido:")} ${chalk.dim(order.orderId)}

${chalk.bold("  PIX Copia e Cola:")}

  ${chalk.cyan(order.pixCode)}

${chalk.dim("  Cole o c\u00F3digo acima no app do seu banco para pagar.")}
`);
}

const STEP_LABELS: Record<string, string> = {
  pending_payment:
    `${String.fromCodePoint(0x23F3)} Aguardando pagamento...`,
  paid:
    `${String.fromCodePoint(0x2705)} Pago! Entrando na fila...`,
  processing:
    `${String.fromCodePoint(0x2699, 0xFE0F)}  Processando curr\u00EDculo...`,
  completed:
    `${String.fromCodePoint(0x1F389)} Conclu\u00EDdo!`,
  failed:
    `${String.fromCodePoint(0x274C)} Falhou`,
  expired:
    `${String.fromCodePoint(0x23F0)} Expirado`,
};

export function statusLabel(status: string, step?: string): string {
  if (status === "processing" && step) {
    return `${String.fromCodePoint(0x2699, 0xFE0F)}  ${step}`;
  }
  return STEP_LABELS[status] || status;
}

export function displayOrderStatus(order: CliOrderStatus & { orderId: string }): void {
  const label = statusLabel(order.status, order.processingStep);

  process.stderr.write(`
  ${chalk.bold("Pedido:")} ${chalk.dim(order.orderId)}
  ${chalk.bold("Status:")} ${label}
`);

  if (order.status === "completed") {
    process.stderr.write(
      `\n  ${chalk.dim("Baixe com:")} ${chalk.cyan(`ajusta cv <arquivo> -o resultado.pdf`)}\n`,
    );
  }

  process.stderr.write("\n");
}
