import { Command } from "commander";
import { getOrder } from "../lib/api.js";
import { displayFullOrderInfo } from "../lib/display.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { getLastOrderId } from "../lib/config.js";
import { CliError, EXIT_USAGE } from "../lib/errors.js";

export const statusCommand = new Command("status")
  .alias("s")
  .description("Consulta o status de um pedido (atalho para `ajusta order get`)")
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
      const orderId = orderIdArg || getLastOrderId();

      if (!orderId) {
        throw new CliError(
          "Nenhum ID de pedido fornecido. Use: ajusta status <orderId>",
          "missing_order_id",
          EXIT_USAGE,
        );
      }

      const order = await withSpinner("Consultando pedido...", () => getOrder(orderId));

      if (isJsonMode()) {
        outputResult(order);
      } else {
        displayFullOrderInfo(order);
      }
    } catch (err) {
      outputError(err);
    }
  });
