import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import chalk from "chalk";
import {
  submitCv,
  pollOrderStatus,
  downloadResult,
} from "../lib/api.js";
import { displayPaymentInfo, statusLabel } from "../lib/display.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { log } from "../lib/logger.js";
import { saveLastOrder } from "../lib/config.js";
import { FileError, TimeoutError } from "../lib/errors.js";
import { isTTY } from "../lib/tty.js";
import {
  DEFAULT_OUTPUT,
  POLL_INTERVAL_MS,
  TIMEOUT_MS,
} from "../lib/constants.js";

export const cvCommand = new Command("cv")
  .description("Envia seu currículo para otimização ATS com IA")
  .argument("<input>", "Caminho para arquivo PDF/DOCX ou conteúdo base64")
  .configureOutput({
    outputError(str) {
      if (str.includes("missing required argument")) {
        process.stderr.write(
          `\n  ${chalk.red("\u2718")} Nenhum arquivo informado.\n\n` +
          `  ${chalk.bold("Uso:")} ajusta cv ${chalk.dim("<arquivo>")} ${chalk.dim("[opções]")}\n\n` +
          `  ${chalk.bold("Exemplos:")}\n` +
          `    $ ajusta cv meu-curriculo.pdf\n` +
          `    $ ajusta cv curriculo.docx -o resultado.pdf\n\n`,
        );
      } else {
        process.stderr.write(str);
      }
    },
  })
  .option(
    "-o, --output <caminho>",
    "Caminho para salvar o resultado",
    DEFAULT_OUTPUT,
  )
  .option("--force", "Sobrescrever arquivo de saída se existir")
  .option(
    "--timeout <minutos>",
    "Timeout em minutos para aguardar processamento",
    "30",
  )
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta cv meu-curriculo.pdf
  $ ajusta cv meu-curriculo.docx -o resultado.pdf
  $ ajusta cv meu-curriculo.pdf --json
  $ ajusta cv meu-curriculo.pdf --force --timeout 60

Códigos de erro:
  file_not_found        Arquivo de entrada não encontrado
  unsupported_format    Formato não suportado (use PDF ou DOCX)
  api_error             Erro na API do AjustaCV
  network_error         Falha de conexão com a API
  timeout_error         Tempo limite excedido
`,
  )
  .action(async (input: string, opts) => {
    try {
      const output = opts.output as string;
      const force = opts.force as boolean | undefined;
      const timeoutMin = parseInt(opts.timeout as string, 10);
      const timeoutMs = (isNaN(timeoutMin) ? 30 : timeoutMin) * 60 * 1_000;

      // ── File overwrite protection ────────────────────────────────
      if (fs.existsSync(output) && !force) {
        throw new FileError(
          `Arquivo já existe: ${path.resolve(output)}. Use --force para sobrescrever.`,
          "file_read_error",
        );
      }

      // ── 1. Submit CV ─────────────────────────────────────────────
      const order = await withSpinner(
        "Enviando currículo...",
        () => submitCv(input),
        { successText: "Currículo enviado!" },
      );

      // ── 2. Save order ID to config ───────────────────────────────
      saveLastOrder(order.orderId);

      // ── 3. Show payment info ─────────────────────────────────────
      if (isJsonMode()) {
        outputResult(order);
      } else {
        await displayPaymentInfo(order);
      }

      // ── 4. Poll for payment + processing ─────────────────────────
      const useSpinner = isTTY() && !isJsonMode();
      const spinner = useSpinner
        ? ora({
            text: statusLabel("pending_payment"),
            stream: process.stderr,
          }).start()
        : null;

      const startTime = Date.now();
      let lastStatus = "";

      while (true) {
        if (Date.now() - startTime > timeoutMs) {
          spinner?.fail();
          throw new TimeoutError(
            `Tempo limite excedido (${timeoutMin} min). Use "ajusta status ${order.orderId}" para verificar.`,
          );
        }

        const status = await pollOrderStatus(order.orderId);

        if (status.status !== lastStatus) {
          if (spinner) {
            spinner.text = statusLabel(status.status, status.processingStep);
          }
          lastStatus = status.status;
        }

        if (status.status === "completed") {
          spinner?.succeed(chalk.green("Currículo otimizado com sucesso!"));

          // ── 5. Download result ───────────────────────────────────
          await withSpinner(
            "Baixando resultado...",
            () => downloadResult(order.orderId, output),
            { successText: chalk.green(`Salvo em: ${path.resolve(output)}`) },
          );

          if (isJsonMode()) {
            outputResult({
              orderId: order.orderId,
              status: "completed",
              outputFile: path.resolve(output),
            });
          } else {
            log.info("");
            log.info(chalk.cyan("Obrigado por usar AjustaCV! \u{1F680}"));
            log.info(chalk.dim("https://ajustacv.com"));
          }
          return;
        }

        if (status.status === "failed") {
          spinner?.fail(chalk.red("Processamento falhou."));
          throw new Error(
            "Processamento falhou.\n\n" +
            "  Próximos passos:\n" +
            "    1. Tente novamente com: ajusta cv <arquivo>\n" +
            "    2. Verifique se o arquivo não está corrompido\n" +
            "    3. Acesse https://ajustacv.com para suporte",
          );
        }

        if (status.status === "expired") {
          spinner?.fail(chalk.red("Pagamento expirado."));
          throw new Error(
            "O tempo para pagamento expirou.\n\n" +
            "  Próximos passos:\n" +
            "    1. Execute novamente: ajusta cv <arquivo>\n" +
            "    2. Um novo código PIX será gerado",
          );
        }

        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch (err) {
      outputError(err);
    }
  });
