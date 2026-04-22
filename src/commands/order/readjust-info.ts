import { Command } from "commander";
import { getReadjustInfo } from "../../lib/api.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { displayReadjustInfo } from "../../lib/display.js";

export const orderReadjustInfoCommand = new Command("readjust-info")
  .description("Mostra elegibilidade e preço de reajuste para um pedido")
  .argument("<orderId>", "ID do pedido")
  .action(async (orderId: string) => {
    try {
      const info = await withSpinner("Consultando...", () => getReadjustInfo(orderId));
      if (isJsonMode()) outputResult(info);
      else displayReadjustInfo(info);
    } catch (err) {
      outputError(err);
    }
  });
