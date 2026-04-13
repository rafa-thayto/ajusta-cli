import chalk from "chalk";
import qrcode from "qrcode-terminal";
import type { CliOrderResponse, CliOrderStatus } from "./api.js";

function generateQrCode(text: string): Promise<string> {
  return new Promise((resolve) => {
    qrcode.generate(text, { small: true }, (code: string) => {
      resolve(code);
    });
  });
}

export async function displayPaymentInfo(order: CliOrderResponse): Promise<void> {
  const priceFormatted = (order.priceCents / 100)
    .toFixed(2)
    .replace(".", ",");

  process.stderr.write(`
${chalk.bold("  \u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557")}
${chalk.bold("  \u2551") + chalk.bold.cyan("         AjustaCV \u2014 Pagamento PIX         ") + chalk.bold("\u2551")}
${chalk.bold("  \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D")}

  ${chalk.bold("Valor:")}  R$ ${chalk.green.bold(priceFormatted)}
  ${chalk.bold("Pedido:")} ${chalk.dim(order.orderId)}
`);

  // QR Code
  if (order.pixQrCodeText) {
    const qr = await generateQrCode(order.pixQrCodeText);
    process.stderr.write(`${chalk.bold("  QR Code PIX:")}\n\n`);
    // Indent each line of the QR code
    const indented = qr
      .split("\n")
      .map((line) => `    ${line}`)
      .join("\n");
    process.stderr.write(indented + "\n\n");
  }

  // PIX copy-paste code
  process.stderr.write(`${chalk.bold("  PIX Copia e Cola:")}\n\n`);
  process.stderr.write(`  ${chalk.cyan(order.pixCode)}\n\n`);

  // Payment URL
  if (order.paymentUrl) {
    process.stderr.write(`  ${chalk.bold("Pagar no navegador:")} ${chalk.underline.cyan(order.paymentUrl)}\n\n`);
  }

  process.stderr.write(`${chalk.dim("  Escaneie o QR code ou cole o c\u00F3digo PIX no app do seu banco.")}\n\n`);
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
