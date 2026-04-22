import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { editor } from "@inquirer/prompts";
import { editResume, getOrder } from "../../lib/api.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { CliError, EXIT_USAGE, FileError } from "../../lib/errors.js";
import { isTTY } from "../../lib/tty.js";
import { log } from "../../lib/logger.js";

const MIN_LEN = 50;
const MAX_LEN = 10000;

export const orderEditCommand = new Command("edit")
  .description("Edita o texto melhorado (máx. 5 edições)")
  .argument("<orderId>", "ID do pedido")
  .option("--text <texto>", "Texto melhorado inline (50-10000 chars)")
  .option("--text-file <caminho>", "Ler texto melhorado de arquivo")
  .option("-i, --interactive", "Abrir $EDITOR com o texto atual")
  .option("--yes", "Pular confirmação")
  .action(async (orderId: string, opts) => {
    try {
      const order = await getOrder(orderId);
      if (order.status !== "completed") {
        throw new CliError(
          `Só é possível editar pedidos concluídos (status atual: ${order.status}).`,
          "order_not_completed",
        );
      }
      if (
        typeof order.editCount === "number" &&
        typeof order.editMaxCount === "number" &&
        order.editCount >= order.editMaxCount
      ) {
        throw new CliError(
          `Limite de edições atingido (${order.editCount}/${order.editMaxCount}).`,
          "edit_limit_reached",
        );
      }

      const modes = [opts.text, opts.textFile, opts.interactive].filter(Boolean).length;
      if (modes !== 1) {
        throw new CliError(
          "Informe exatamente um de: --text, --text-file ou --interactive.",
          "invalid_argument",
          EXIT_USAGE,
        );
      }

      let improvedText: string;
      if (opts.text) {
        improvedText = opts.text as string;
      } else if (opts.textFile) {
        const abs = path.resolve(opts.textFile as string);
        if (!fs.existsSync(abs)) {
          throw new FileError(`Arquivo não encontrado: ${abs}`, "file_not_found");
        }
        improvedText = fs.readFileSync(abs, "utf-8");
      } else {
        if (!isTTY()) {
          throw new CliError(
            "Modo interativo requer um terminal.",
            "not_interactive",
            EXIT_USAGE,
          );
        }
        improvedText = await editor({
          message: "Edite o texto do currículo (salve e feche)",
          default: order.improvedText ?? "",
        });
      }

      improvedText = improvedText.trim();
      if (improvedText.length < MIN_LEN || improvedText.length > MAX_LEN) {
        throw new CliError(
          `Texto deve ter entre ${MIN_LEN} e ${MAX_LEN} caracteres (atual: ${improvedText.length}).`,
          "invalid_argument",
          EXIT_USAGE,
        );
      }

      if (!opts.yes && !isJsonMode()) {
        log.info(
          `Edições: ${order.editCount ?? 0}/${order.editMaxCount ?? 5}. Salvando...`,
        );
      }

      const result = await withSpinner("Enviando edição...", () =>
        editResume(orderId, improvedText),
      );

      if (isJsonMode()) outputResult({ orderId, ...result });
      else log.success(`Texto atualizado. Edições: ${result.editCount}`);
    } catch (err) {
      outputError(err);
    }
  });
