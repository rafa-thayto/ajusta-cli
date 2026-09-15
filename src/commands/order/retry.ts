import { Command } from "commander";
import chalk from "chalk";
import { getOrder, retryOrder } from "../../lib/api.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { CliError } from "../../lib/errors.js";
import { assertCompleted, timeoutMinutesToMs, waitForOrder } from "../../lib/wait.js";
import { isTTY } from "../../lib/tty.js";
import { log } from "../../lib/logger.js";

export const orderRetryCommand = new Command("retry")
  .description("Reenvia para processamento um pedido que falhou")
  .argument("<orderId>", "ID do pedido")
  .option("--follow", "Aguarda e exibe o novo processamento até concluir")
  .option("--timeout <minutos>", "Timeout em minutos (com --follow)", "30")
  .option("--yes", "Pular confirmação interativa")
  .action(async (orderId: string, opts) => {
    try {
      const order = await getOrder(orderId);
      if (order.status !== "failed") {
        throw new CliError(
          `Só é possível tentar novamente pedidos com status "failed" (atual: ${order.status}).`,
          "order_not_failed",
        );
      }

      if (isTTY() && !isJsonMode() && !opts.yes) {
        log.warn(
          `Pedido ${chalk.cyan(orderId)} será re-enfileirado. Pressione Ctrl+C para cancelar.`,
        );
      }

      const result = await withSpinner("Re-enfileirando...", () => retryOrder(orderId));

      if (!opts.follow) {
        if (isJsonMode()) outputResult({ orderId, ...result });
        else log.success("Pedido re-enfileirado.");
        return;
      }

      const timeoutMs = timeoutMinutesToMs(opts.timeout, 30);
      const finalResult = await waitForOrder(orderId, { timeoutMs, initialStatus: "processing" });
      assertCompleted(finalResult, orderId);

      if (isJsonMode()) outputResult({ orderId, status: "completed", next: `ajusta order download ${orderId}` });
    } catch (err) {
      outputError(err);
    }
  });
