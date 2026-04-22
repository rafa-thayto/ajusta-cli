import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import ora from "ora";
import { getReadjustInfo, submitOrder } from "../../lib/api.js";
import { pollUntilComplete } from "../../lib/poll.js";
import { downloadOrderFile } from "../../lib/download.js";
import { withSpinner } from "../../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../../lib/output.js";
import { displayPaymentInfo, statusLabel } from "../../lib/display.js";
import { saveLastOrder } from "../../lib/config.js";
import { CliError, EXIT_USAGE, FileError } from "../../lib/errors.js";
import { isTTY } from "../../lib/tty.js";
import { resolveInput } from "../../lib/input.js";
import { DEFAULT_OUTPUT } from "../../lib/constants.js";
import { log } from "../../lib/logger.js";

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
  .action(async (orderId: string, opts) => {
    try {
      if (opts.job && opts.jobFile) {
        throw new CliError("Use --job OU --job-file.", "invalid_argument", EXIT_USAGE);
      }

      const output = opts.output as string;
      const noDownload = opts.download === false;
      const force = opts.force as boolean | undefined;
      const timeoutMin = parseInt(opts.timeout as string, 10);
      const timeoutMs = (isNaN(timeoutMin) ? 30 : timeoutMin) * 60 * 1_000;

      if (!noDownload && fs.existsSync(output) && !force) {
        throw new FileError(
          `Arquivo já existe: ${path.resolve(output)}. Use --force para sobrescrever.`,
          "file_read_error",
        );
      }

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

      if (isJsonMode()) {
        outputResult({
          orderId: newOrder.orderId,
          parentOrderId: info.parentOrderId,
          paymentUrl: newOrder.paymentUrl,
          brCode: newOrder.brCode,
          expiresAt: newOrder.expiresAt,
          finalPriceCents: newOrder.finalPriceCents,
          discountCents: newOrder.discountCents,
          zeroPriceOrder: newOrder.zeroPriceOrder ?? false,
        });
      } else {
        await displayPaymentInfo(newOrder, "improve_curriculum");
      }

      const useSpinner = isTTY() && !isJsonMode();
      const spinner = useSpinner
        ? ora({ text: statusLabel("pending_payment"), stream: process.stderr }).start()
        : null;

      const result = await pollUntilComplete(newOrder.orderId, {
        timeoutMs,
        onChange: ({ status, processingStep }) => {
          if (spinner) spinner.text = statusLabel(status, processingStep);
        },
      });

      if (result.status !== "completed") {
        spinner?.fail();
        throw new CliError(
          `Reajuste terminou com status ${result.status}.`,
          "api_error",
        );
      }
      spinner?.succeed(chalk.green("Reajuste concluído!"));

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
