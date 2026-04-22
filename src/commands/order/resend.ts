import { Command } from "commander";
import { getOrder, resendOrderEmail } from "../../lib/api.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { CliError } from "../../lib/errors.js";
import { log } from "../../lib/logger.js";

export const orderResendCommand = new Command("resend")
  .description("Reenvia por email o resultado de um pedido concluído (máx. 2)")
  .argument("<orderId>", "ID do pedido")
  .option("--yes", "Pular confirmação")
  .action(async (orderId: string, opts) => {
    try {
      const order = await getOrder(orderId);
      if (order.status !== "completed") {
        throw new CliError(
          `Só é possível reenviar pedidos concluídos (status atual: ${order.status}).`,
          "order_not_completed",
        );
      }
      if (
        typeof order.emailResendCount === "number" &&
        typeof order.emailResendMaxCount === "number" &&
        order.emailResendCount >= order.emailResendMaxCount
      ) {
        throw new CliError(
          `Limite de reenvios atingido (${order.emailResendCount}/${order.emailResendMaxCount}).`,
          "resend_limit_reached",
        );
      }
      if (!opts.yes && !isJsonMode()) {
        log.info(
          `Reenvios: ${order.emailResendCount ?? 0}/${order.emailResendMaxCount ?? 2}. Enviando...`,
        );
      }

      const result = await withSpinner("Reenviando...", () => resendOrderEmail(orderId));

      if (isJsonMode()) outputResult({ orderId, ...result });
      else log.success(`Email reenviado. Total: ${result.emailResendCount}`);
    } catch (err) {
      outputError(err);
    }
  });
