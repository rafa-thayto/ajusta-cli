import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import ora from "ora";
import { redeemGift, validateGift } from "../lib/api.js";
import { pollUntilComplete } from "../lib/poll.js";
import { downloadOrderFile } from "../lib/download.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { statusLabel } from "../lib/display.js";
import { saveLastOrder } from "../lib/config.js";
import { collectCheckoutForm, type PartialFormData } from "../lib/prompts.js";
import { CliError, FileError } from "../lib/errors.js";
import { isTTY } from "../lib/tty.js";
import { resolveInput, resolveTextInput, type ResolvedInput } from "../lib/input.js";
import { DEFAULT_OUTPUT } from "../lib/constants.js";
import { log } from "../lib/logger.js";

const validateSub = new Command("validate")
  .description("Valida um token de presente")
  .argument("<token>", "Token do presente")
  .action(async (token: string) => {
    try {
      const result = await withSpinner("Validando presente...", () =>
        validateGift(token),
      );
      if (isJsonMode()) {
        outputResult(result);
      } else {
        process.stderr.write(`
  ${chalk.bold("Válido:")}    ${result.valid ? chalk.green("sim") : chalk.red("não")}
  ${chalk.bold("Pedido:")}    ${chalk.dim(result.orderId ?? "-")}
  ${chalk.bold("Comprador:")} ${result.buyerName ?? chalk.dim("-")}
  ${chalk.bold("Idioma:")}    ${result.language ?? chalk.dim("-")}
${result.redeemed ? `  ${chalk.yellow("⚠")} Já resgatado.\n` : ""}\n`);
      }
    } catch (err) {
      outputError(err);
    }
  });

const redeemSub = new Command("redeem")
  .description("Resgata um presente preenchendo os dados do destinatário")
  .argument("<token>", "Token do presente")
  .option("-i, --interactive", "Modo interativo")
  .option("--name <nome>", "Nome do destinatário")
  .option("--email <email>", "Email do destinatário")
  .option("--file <caminho>", "Arquivo de currículo PDF/DOCX")
  .option("--text <texto>", "Currículo como texto inline")
  .option("--text-file <caminho>", "Currículo como texto a partir de arquivo")
  .option("--job <descricao>", "Descrição da vaga")
  .option("--language <idioma>", "Idioma: pt-BR, en, es, fr, de, it")
  .option("--timeout <minutos>", "Timeout em minutos", "30")
  .option(
    "-o, --output <caminho>",
    "Caminho para salvar o resultado",
    DEFAULT_OUTPUT,
  )
  .option("--force", "Sobrescrever arquivo de saída")
  .option("--no-download", "Não baixar o resultado automaticamente")
  .action(async (token: string, opts) => {
    try {
      const noDownload = opts.download === false;
      const output = opts.output as string;
      const force = opts.force as boolean | undefined;
      const timeoutMin = parseInt(opts.timeout as string, 10);
      const timeoutMs = (isNaN(timeoutMin) ? 30 : timeoutMin) * 60 * 1_000;

      if (!noDownload && fs.existsSync(output) && !force) {
        throw new FileError(
          `Arquivo já existe: ${path.resolve(output)}. Use --force para sobrescrever.`,
          "file_read_error",
        );
      }

      const prefilled: PartialFormData = {};
      if (opts.name) prefilled.name = opts.name as string;
      if (opts.email) prefilled.email = opts.email as string;
      if (opts.language) prefilled.language = opts.language as string;
      if (opts.job) prefilled.jobDescription = opts.job as string;

      let formData: PartialFormData = prefilled;
      if (opts.interactive) {
        // Gift flow doesn't require CPF/phone — skip those prompts
        if (!isTTY()) {
          throw new CliError(
            "Modo interativo requer um terminal. Use --name/--email/--file.",
            "not_interactive",
            1,
          );
        }
        const full = await collectCheckoutForm({
          ...prefilled,
          cpf: prefilled.cpf ?? "00000000000",
          phone: prefilled.phone ?? "0000000000",
        });
        formData.name = full.name;
        formData.email = full.email;
        formData.language = full.language;
        formData.jobDescription = full.jobDescription;
      }

      if (!formData.name || !formData.email) {
        throw new CliError(
          "Faltam campos obrigatórios. Use -i ou --name e --email.",
          "invalid_argument",
          1,
        );
      }

      let resume: ResolvedInput | undefined;
      let resumeText: string | undefined;
      if (opts.file) resume = resolveInput(opts.file as string);
      else if (opts.textFile) resumeText = resolveTextInput(opts.textFile as string);
      else if (opts.text) resumeText = opts.text as string;

      const { orderId } = await withSpinner("Resgatando presente...", () =>
        redeemGift(token, {
          name: formData.name!,
          email: formData.email!,
          language: formData.language,
          jobDescription: formData.jobDescription,
          resume,
          resumeText,
        }),
      );

      saveLastOrder(orderId, "improve_curriculum");

      if (isJsonMode()) outputResult({ orderId, status: "redeemed" });
      else log.success(`Presente resgatado! Pedido: ${chalk.cyan(orderId)}`);

      const useSpinner = isTTY() && !isJsonMode();
      const spinner = useSpinner
        ? ora({ text: statusLabel("paid"), stream: process.stderr }).start()
        : null;

      const result = await pollUntilComplete(orderId, {
        timeoutMs,
        onChange: ({ status, processingStep }) => {
          if (spinner) spinner.text = statusLabel(status, processingStep);
        },
      });

      if (result.status !== "completed") {
        spinner?.fail();
        throw new CliError(
          `Presente terminou com status ${result.status}.`,
          "api_error",
        );
      }
      spinner?.succeed(chalk.green("Currículo pronto!"));

      if (noDownload) {
        if (isJsonMode()) outputResult({ orderId, status: "completed" });
        return;
      }

      const dl = await withSpinner(
        "Baixando resultado...",
        () => downloadOrderFile(orderId, "improved", output),
        { successText: chalk.green(`Salvo em: ${path.resolve(output)}`) },
      );

      if (isJsonMode()) {
        outputResult({ orderId, status: "completed", savedTo: dl.savedTo, bytes: dl.bytes });
      }
    } catch (err) {
      outputError(err);
    }
  });

export const giftCommand = new Command("gift")
  .description("Validar e resgatar presentes")
  .addCommand(validateSub)
  .addCommand(redeemSub)
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta gift validate abc-token-xyz
  $ ajusta gift redeem abc-token-xyz -i
  $ ajusta gift redeem abc-token-xyz --name "Ana" --email "a@x.com" --file cv.pdf
`,
  );
