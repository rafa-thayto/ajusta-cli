import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { getOrder, regeneratePhoto } from "../../lib/api.js";
import { downloadOrderFile } from "../../lib/download.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { CliError, EXIT_USAGE, FileError } from "../../lib/errors.js";
import { DEFAULT_PHOTO_OUTPUT, PHOTO_STYLES } from "../../lib/constants.js";
import { log } from "../../lib/logger.js";

export const orderRegeneratePhotoCommand = new Command("regenerate-photo")
  .description("Regera a foto profissional (máx. 3)")
  .argument("<orderId>", "ID do pedido")
  .option("--style <estilo>", `Estilo: ${PHOTO_STYLES.join(" | ")}`)
  .option("--profession <texto>", "Profissão")
  .option("-o, --output <caminho>", "Salvar a nova foto (opcional)")
  .option("--force", "Sobrescrever arquivo de saída")
  .option("--yes", "Pular confirmação")
  .action(async (orderId: string, opts) => {
    try {
      if (
        opts.style &&
        !PHOTO_STYLES.includes(opts.style as (typeof PHOTO_STYLES)[number])
      ) {
        throw new CliError(
          `Estilo inválido. Opções: ${PHOTO_STYLES.join(", ")}`,
          "invalid_argument",
          EXIT_USAGE,
        );
      }

      const order = await getOrder(orderId);
      if (order.product !== "professional_photo") {
        throw new CliError(
          `Pedido não é do tipo professional_photo (é ${order.product}).`,
          "not_professional_photo",
        );
      }
      if (
        typeof order.photoRegenerateCount === "number" &&
        typeof order.photoRegenerateMaxCount === "number" &&
        order.photoRegenerateCount >= order.photoRegenerateMaxCount
      ) {
        throw new CliError(
          `Limite de regenerações atingido (${order.photoRegenerateCount}/${order.photoRegenerateMaxCount}).`,
          "regen_limit_reached",
        );
      }

      const output = (opts.output as string | undefined) ?? undefined;
      if (output && fs.existsSync(output) && !opts.force) {
        throw new FileError(
          `Arquivo já existe: ${path.resolve(output)}. Use --force.`,
          "file_read_error",
        );
      }

      if (!opts.yes && !isJsonMode()) {
        log.info(
          `Regenerações: ${order.photoRegenerateCount ?? 0}/${order.photoRegenerateMaxCount ?? 3}.`,
        );
      }

      const result = await withSpinner("Regerando foto...", () =>
        regeneratePhoto(orderId, {
          photoStyle: opts.style as string | undefined,
          photoProfession: opts.profession as string | undefined,
        }),
      );

      let dl: { savedTo: string; bytes: number } | undefined;
      if (output) {
        dl = await withSpinner(
          "Baixando nova foto...",
          () =>
            downloadOrderFile(orderId, "generated-photo", output ?? DEFAULT_PHOTO_OUTPUT),
          { successText: chalk.green(`Salvo em: ${path.resolve(output)}`) },
        );
      }

      if (isJsonMode()) {
        outputResult({ orderId, ...result, ...(dl ? { savedTo: dl.savedTo, bytes: dl.bytes } : {}) });
      } else {
        log.success(`Regeneração ${result.photoRegenerateCount} concluída.`);
      }
    } catch (err) {
      outputError(err);
    }
  });
