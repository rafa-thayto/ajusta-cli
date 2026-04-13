import chalk from "chalk";
import type { CliOrderResponse } from "./api.js";

export function displayPaymentInfo(order: CliOrderResponse): void {
  const priceFormatted = (order.priceCents / 100).toFixed(2).replace(".", ",");

  console.log();
  console.log(chalk.bold("  ╔══════════════════════════════════════════╗"));
  console.log(chalk.bold("  ║") + chalk.bold.cyan("         AjustaCV — Pagamento PIX         ") + chalk.bold("║"));
  console.log(chalk.bold("  ╚══════════════════════════════════════════╝"));
  console.log();
  console.log(`  ${chalk.bold("Valor:")}  R$ ${chalk.green.bold(priceFormatted)}`);
  console.log(`  ${chalk.bold("Pedido:")} ${chalk.dim(order.orderId)}`);
  console.log();
  console.log(chalk.bold("  PIX Copia e Cola:"));
  console.log();
  console.log(`  ${chalk.cyan(order.pixCode)}`);
  console.log();
  console.log(chalk.dim("  Cole o código acima no app do seu banco para pagar."));
  console.log();
}

const STEP_LABELS: Record<string, string> = {
  pending_payment: "⏳ Aguardando pagamento...",
  paid: "✅ Pago! Entrando na fila...",
  processing: "⚙️  Processando currículo...",
  completed: "🎉 Concluído!",
  failed: "❌ Falhou",
  expired: "⏰ Expirado",
};

export function statusLabel(status: string, step?: string): string {
  const label = STEP_LABELS[status] || status;
  if (status === "processing" && step) {
    return `⚙️  ${step}`;
  }
  return label;
}
