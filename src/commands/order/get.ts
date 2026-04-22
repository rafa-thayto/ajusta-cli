import { Command } from "commander";
import { getOrder } from "../../lib/api.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { displayFullOrderInfo } from "../../lib/display.js";
import { getLastOrderId } from "../../lib/config.js";
import { CliError, EXIT_USAGE } from "../../lib/errors.js";

export const orderGetCommand = new Command("get")
  .description("Detalhes completos de um pedido")
  .argument("[orderId]", "ID do pedido (usa o último pedido se omitido)")
  .action(async (orderIdArg?: string) => {
    try {
      const orderId = orderIdArg || getLastOrderId();
      if (!orderId) {
        throw new CliError(
          "Nenhum ID de pedido fornecido.",
          "missing_order_id",
          EXIT_USAGE,
        );
      }

      const order = await withSpinner("Consultando pedido...", () => getOrder(orderId));

      if (isJsonMode()) outputResult(order);
      else displayFullOrderInfo(order);
    } catch (err) {
      outputError(err);
    }
  });
