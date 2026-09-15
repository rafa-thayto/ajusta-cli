import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { getReadjustInfo, submitOrder } from "../../lib/api.js";
import { downloadOrderFile } from "../../lib/download.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { saveLastOrder } from "../../lib/config.js";
import { CliError, EXIT_USAGE, FileError } from "../../lib/errors.js";
import { resolveInput } from "../../lib/input.js";
import { log } from "../../lib/logger.js";
import { announceOrder, assertCompleted, timeoutMinutesToMs, waitForOrder } from "../../lib/wait.js";
import { ensureWritable } from "../cv.js";

export const orderReadjustCommand = new Command("readjust")
  .description("Cria um pedido de reajuste para um pedido pai (R$ 3,40)")
  .argument("<orderId>", "ID do pedido pai (ou qualquer descendente)")
  .option("--job <texto>", "Nova descrição de vaga")
  .option("--job-file <caminho>", "Nova descrição de vaga em arquivo")
  .option("--file <caminho>", "Novo currículo (opcional; herda do pai se omitido)")
  .option(
    "-o, --output <caminho>",
    "Caminho para salvar o resultado",
    "curriculo-reajustado.pdf",
  )
  .option("--force", "Sobrescrever arquivo de saída")
  .option("--timeout <minutos>", "Timeout em minutos", "30")
  .option("--no-download", "Não baixar o resultado automaticamente")
  .option("--no-wait", "Cria o reajuste e sai; acompanhe com `ajusta order wait`")
  .action(async (orderId: string, opts) => {
    try {
      if (opts.job && opts.jobFile) {
        throw new CliError("Use --job OU --job-file.", "invalid_argument", EXIT_USAGE);
      }

      const output = opts.output as string;
      const noDownload = opts.download === false;
      const noWait = opts.wait === false;
      const timeoutMs = timeoutMinutesToMs(opts.timeout, 30);

      if (!noDownload && !noWait) ensureWritable(output, opts.force as boolean | undefined);

      const info = await withSpinner("Validando reajuste...", () =>
        getReadjustInfo(orderId),
      );

      if (info.readjustCount >= info.readjustMaxCount) {
        throw new CliError(
          `Limite de reajustes atingido (${info.readjustCount}/${info.readjustMaxCount}).`,
          "readjust_limit_reached",
        );
      }

      let jobDescription: string | undefined;
      if (opts.job) jobDescription = opts.job as string;
      if (opts.jobFile) {
        const abs = path.resolve(opts.jobFile as string);
        if (!fs.existsSync(abs)) {
          throw new FileError(`Arquivo não encontrado: ${abs}`, "file_not_found");
        }
        jobDescription = fs.readFileSync(abs, "utf-8");
      }

      const resume = opts.file ? resolveInput(opts.file as string) : undefined;

      const newOrder = await withSpinner("Criando reajuste...", () =>
        submitOrder({
          product: "improve_curriculum",
          parentOrderId: info.parentOrderId,
          name: info.name,
          email: info.email,
          cpf: info.cpf,
          phone: info.phone,
          language: info.language,
          jobDescription,
          resume,
        }),
      );

      saveLastOrder(newOrder.orderId, "improve_curriculum");
      await announceOrder(newOrder, "improve_curriculum", {
        noWait,
        extra: { parentOrderId: info.parentOrderId },
      });
      if (noWait) return;

      const result = await waitForOrder(newOrder.orderId, { timeoutMs });
      assertCompleted(result, newOrder.orderId);

      if (noDownload) {
        if (isJsonMode())
          outputResult({ orderId: newOrder.orderId, status: "completed" });
        return;
      }

      const dl = await withSpinner(
        "Baixando resultado...",
        () => downloadOrderFile(newOrder.orderId, "improved", output),
        { successText: chalk.green(`Salvo em: ${path.resolve(output)}`) },
      );

      if (isJsonMode()) {
        outputResult({
          orderId: newOrder.orderId,
          status: "completed",
          savedTo: dl.savedTo,
          bytes: dl.bytes,
        });
      } else {
        log.info(chalk.cyan("Reajuste pronto!"));
      }
    } catch (err) {
      outputError(err);
    }
  });
