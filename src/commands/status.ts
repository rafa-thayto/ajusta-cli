import { Command } from "commander";
import chalk from "chalk";
import { pollOrderStatus } from "../lib/api.js";
import { displayOrderStatus } from "../lib/display.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { getLastOrder } from "../lib/config.js";
import { log } from "../lib/logger.js";
import { CliError, EXIT_USAGE } from "../lib/errors.js";

export const statusCommand = new Command("status")
  .alias("s")
  .description("Consulta o status de um pedido")
  .argument("[orderId]", "ID do pedido (usa o último pedido se omitido)")
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta status 507f1f77bcf86cd799439011
  $ ajusta status                              # usa o último pedido
  $ ajusta status --json
`,
  )
  .action(async (orderIdArg?: string) => {
    try {
      const orderId = orderIdArg || getLastOrder();

      if (!orderId) {
        throw new CliError(
          "Nenhum ID de pedido fornecido. Use: ajusta status <orderId>",
          "missing_order_id",
          EXIT_USAGE,
        );
      }

      const status = await withSpinner(
        "Consultando pedido...",
        () => pollOrderStatus(orderId),
      );

      if (isJsonMode()) {
        outputResult({ orderId, ...status });
      } else {
        displayOrderStatus({ orderId, ...status });
      }
    } catch (err) {
      outputError(err);
    }
  });
