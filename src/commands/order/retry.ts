import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { getOrder, retryOrder } from "../../lib/api.js";
import { pollUntilComplete } from "../../lib/poll.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { statusLabel } from "../../lib/display.js";
import { CliError } from "../../lib/errors.js";
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

      const timeoutMin = parseInt(opts.timeout as string, 10);
      const timeoutMs = (isNaN(timeoutMin) ? 30 : timeoutMin) * 60 * 1_000;
      const spinner =
        isTTY() && !isJsonMode()
          ? ora({ text: statusLabel("processing"), stream: process.stderr }).start()
          : null;

      const finalResult = await pollUntilComplete(orderId, {
        timeoutMs,
        onChange: ({ status, processingStep }) => {
          if (spinner) spinner.text = statusLabel(status, processingStep);
        },
      });

      if (finalResult.status === "completed") {
        spinner?.succeed(chalk.green("Processamento concluído."));
      } else {
        spinner?.fail();
      }

      if (isJsonMode()) outputResult({ orderId, status: finalResult.status });
    } catch (err) {
      outputError(err);
    }
  });
