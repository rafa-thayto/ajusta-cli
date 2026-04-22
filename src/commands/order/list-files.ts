import { Command } from "commander";
import chalk from "chalk";
import { getOrder } from "../../lib/api.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { getLastOrderId } from "../../lib/config.js";
import { CliError, EXIT_USAGE } from "../../lib/errors.js";

export const orderListFilesCommand = new Command("list-files")
  .description("Lista arquivos disponíveis para download de um pedido")
  .argument("[orderId]", "ID do pedido (usa o último se omitido)")
  .action(async (orderIdArg?: string) => {
    try {
      const orderId = orderIdArg || getLastOrderId();
      if (!orderId) {
        throw new CliError("Nenhum ID de pedido fornecido.", "missing_order_id", EXIT_USAGE);
      }

      const order = await withSpinner("Consultando pedido...", () => getOrder(orderId));

      const files = [
        { type: "original", available: !!order.hasOriginalFile },
        { type: "improved", available: !!order.hasImprovedPdf },
        { type: "improved-docx", available: !!order.hasImprovedDocx },
        { type: "improved-latex", available: !!order.hasImprovedLatex },
        { type: "generated-photo", available: !!order.hasGeneratedPhoto },
      ];
      const photoHistoryCount = order.photoHistory?.length ?? 0;

      if (isJsonMode()) {
        outputResult({
          orderId,
          product: order.product,
          files,
          photoHistoryCount,
        });
      } else {
        process.stderr.write(`\n  ${chalk.bold("Pedido:")} ${chalk.dim(orderId)}\n\n`);
        for (const f of files) {
          const mark = f.available ? chalk.green("✔") : chalk.dim("✘");
          process.stderr.write(`  ${mark} ${f.type}\n`);
        }
        if (photoHistoryCount > 0) {
          process.stderr.write(
            `  ${chalk.green("✔")} photo-history (${photoHistoryCount} ${photoHistoryCount === 1 ? "foto" : "fotos"})\n`,
          );
        }
        process.stderr.write("\n");
      }
    } catch (err) {
      outputError(err);
    }
  });
