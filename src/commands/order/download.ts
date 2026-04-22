import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { downloadOrderFile, type FileType } from "../../lib/download.js";
import { CliError, EXIT_USAGE, FileError } from "../../lib/errors.js";

const VALID_TYPES: FileType[] = [
  "original",
  "improved",
  "improved-docx",
  "improved-latex",
  "generated-photo",
  "photo-history",
];

const DEFAULT_EXTENSIONS: Record<FileType, string> = {
  original: ".pdf",
  improved: ".pdf",
  "improved-docx": ".docx",
  "improved-latex": ".tex",
  "generated-photo": ".png",
  "photo-history": ".png",
};

export const orderDownloadCommand = new Command("download")
  .description("Baixa um arquivo gerado por um pedido")
  .argument("<orderId>", "ID do pedido")
  .option("--type <tipo>", `Tipo de arquivo: ${VALID_TYPES.join(" | ")}`, "improved")
  .option("--index <n>", "Índice (somente para photo-history)")
  .option("-o, --output <caminho>", "Caminho de saída")
  .option("--force", "Sobrescrever se existir")
  .action(async (orderId: string, opts) => {
    try {
      const type = opts.type as FileType;
      if (!VALID_TYPES.includes(type)) {
        throw new CliError(
          `Tipo inválido: ${type}. Opções: ${VALID_TYPES.join(", ")}`,
          "invalid_argument",
          EXIT_USAGE,
        );
      }

      let index: number | undefined;
      if (type === "photo-history") {
        const raw = opts.index as string | undefined;
        if (raw === undefined) {
          throw new CliError(
            "--index é obrigatório para --type photo-history",
            "invalid_argument",
            EXIT_USAGE,
          );
        }
        index = parseInt(raw, 10);
        if (isNaN(index) || index < 0) {
          throw new CliError("--index inválido.", "invalid_argument", EXIT_USAGE);
        }
      }

      const defaultName = `ajusta-${type}-${orderId}${DEFAULT_EXTENSIONS[type]}`;
      const output = (opts.output as string) || defaultName;

      if (fs.existsSync(output) && !opts.force) {
        throw new FileError(
          `Arquivo já existe: ${path.resolve(output)}. Use --force para sobrescrever.`,
          "file_read_error",
        );
      }

      const result = await withSpinner(
        `Baixando ${type}...`,
        () => downloadOrderFile(orderId, type, output, index),
        { successText: chalk.green(`Salvo em: ${path.resolve(output)}`) },
      );

      if (isJsonMode()) outputResult({ orderId, type, ...result });
    } catch (err) {
      outputError(err);
    }
  });
