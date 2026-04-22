import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { fillResume, getOrder } from "../../lib/api.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { CliError, EXIT_USAGE, FileError } from "../../lib/errors.js";
import { clearPendingCreate, readPendingCreate } from "../../lib/config.js";
import { log } from "../../lib/logger.js";

export const orderFillCommand = new Command("fill")
  .description(
    "Envia dados de formulário para um pedido create_curriculum pago mas não preenchido",
  )
  .argument("<orderId>", "ID do pedido")
  .option("--from <caminho>", "JSON com dados do currículo")
  .action(async (orderId: string, opts) => {
    try {
      const order = await getOrder(orderId);
      if (order.product !== "create_curriculum") {
        throw new CliError(
          `Pedido não é do tipo create_curriculum (é ${order.product}).`,
          "not_create_curriculum",
        );
      }
      if (order.status === "completed") {
        throw new CliError("Pedido já foi preenchido e concluído.", "api_error");
      }

      let data: Record<string, unknown> | null = null;

      if (opts.from) {
        const abs = path.resolve(opts.from as string);
        if (!fs.existsSync(abs)) {
          throw new FileError(`Arquivo não encontrado: ${abs}`, "file_not_found");
        }
        try {
          data = JSON.parse(fs.readFileSync(abs, "utf-8")) as Record<string, unknown>;
        } catch {
          throw new FileError(`JSON inválido em ${abs}`, "invalid_spec");
        }
      } else {
        const pending = readPendingCreate(orderId);
        if (pending && typeof pending === "object") {
          data = pending as Record<string, unknown>;
          if (!isJsonMode())
            log.info(`Usando dados salvos do crash-recovery file para ${orderId}.`);
        }
      }

      if (!data) {
        throw new CliError(
          "Nenhum dado fornecido. Use --from <arquivo.json> ou `ajusta create -i`.",
          "invalid_argument",
          EXIT_USAGE,
        );
      }

      // The API expects `resume` fields at the top level of the body
      const body = (data as { resume?: unknown }).resume
        ? (data as { resume: Record<string, unknown> }).resume
        : data;

      const result = await withSpinner("Enviando formulário...", () =>
        fillResume(orderId, body),
      );

      clearPendingCreate(orderId);

      if (isJsonMode()) outputResult({ ...result, orderId });
      else log.success("Formulário enviado. Processamento iniciado.");
    } catch (err) {
      outputError(err);
    }
  });
