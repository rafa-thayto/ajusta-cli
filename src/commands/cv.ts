import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { submitOrder } from "../lib/api.js";
import { downloadOrderFile } from "../lib/download.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { log } from "../lib/logger.js";
import { saveLastOrder } from "../lib/config.js";
import { collectCheckoutForm, type PartialFormData } from "../lib/prompts.js";
import { CliError, EXIT_USAGE, FileError } from "../lib/errors.js";
import { isTTY } from "../lib/tty.js";
import { resolveInput } from "../lib/input.js";
import { validateCheckout } from "../lib/validation.js";
import { DEFAULT_OUTPUT } from "../lib/constants.js";
import { announceOrder, assertCompleted, timeoutMinutesToMs, waitForOrder } from "../lib/wait.js";

/** Refuse to clobber an output file unless --force was given. */
export function ensureWritable(output: string, force: boolean | undefined): void {
  if (!fs.existsSync(output) || force) return;
  throw new FileError(
    `Arquivo já existe: ${path.resolve(output)}.`,
    "file_exists",
    "Use --force para sobrescrever ou -o <outro-caminho>.",
  );
}

/**
 * Build the improve-curriculum command. `deprecated` causes a stderr notice to print
 * (used by the `cv` alias kept for backward compatibility).
 */
export function buildImproveCommand(name: string, deprecated = false): Command {
  return new Command(name)
    .description(
      deprecated
        ? "[DEPRECATED] Use `ajusta improve` — envia currículo para otimização ATS"
        : "Envia seu currículo para otimização ATS com IA",
    )
    .argument("<input>", "Caminho para arquivo PDF/DOCX ou conteúdo base64")
    .configureOutput({
      outputError(str) {
        if (str.includes("missing required argument")) {
          process.stderr.write(
            `\n  ${chalk.red("✘")} Nenhum arquivo informado.\n\n` +
              `  ${chalk.bold("Uso:")} ajusta ${name} ${chalk.dim("<arquivo>")} ${chalk.dim("[opções]")}\n\n` +
              `  ${chalk.bold("Exemplos:")}\n` +
              `    $ ajusta ${name} meu-curriculo.pdf\n` +
              `    $ ajusta ${name} curriculo.docx -o resultado.pdf\n\n`,
          );
        } else {
          process.stderr.write(str);
        }
      },
    })
    .option("-o, --output <caminho>", "Caminho para salvar o resultado", DEFAULT_OUTPUT)
    .option("--force", "Sobrescrever arquivo de saída se existir")
    .option("--timeout <minutos>", "Timeout em minutos para aguardar processamento", "30")
    .option("-i, --interactive", "Modo interativo: preenche dados no terminal")
    .option("--name <nome>", "Nome completo (pula o prompt)")
    .option("--email <email>", "Email (pula o prompt)")
    .option("--cpf <cpf>", "CPF (pula o prompt)")
    .option("--phone <telefone>", "Telefone (pula o prompt)")
    .option("--language <idioma>", "Idioma: pt-BR, en, es, fr, de, it (pula o prompt)")
    .option("--job <descricao>", "Descrição da vaga (pula o prompt)")
    .option("--coupon <code>", "Código de cupom de desconto")
    .option("--no-download", "Não baixar o resultado automaticamente")
    .option("--no-wait", "Cria o pedido e sai; acompanhe com `ajusta order wait`")
    .addHelpText(
      "after",
      `
Exemplos:
  $ ajusta ${name} meu-curriculo.pdf
  $ ajusta ${name} meu-curriculo.pdf -i
  $ ajusta ${name} curriculo.pdf --name "João" --email "joao@email.com"
  $ ajusta ${name} curriculo.pdf -i --language pt-BR
  $ ajusta ${name} meu-curriculo.pdf --json
  $ ajusta ${name} meu-curriculo.pdf --force --timeout 60
  $ ajusta ${name} meu-curriculo.pdf --no-wait --json   # agentes: cria e devolve o PIX
`,
    )
    .action(async (input: string, opts) => {
      try {
        if (deprecated && !isJsonMode()) {
          log.warn(`"ajusta cv" será removido em breve. Use "ajusta improve".`);
        }

        const output = opts.output as string;
        const interactive = opts.interactive as boolean | undefined;
        const noDownload = opts.download === false;
        const noWait = opts.wait === false;
        const timeoutMs = timeoutMinutesToMs(opts.timeout, 30);

        if (!noDownload && !noWait) ensureWritable(output, opts.force as boolean | undefined);

        // ── Collect form data ────────────────────────────────────────
        const prefilled: PartialFormData = {};
        if (opts.name) prefilled.name = opts.name as string;
        if (opts.email) prefilled.email = opts.email as string;
        if (opts.cpf) prefilled.cpf = (opts.cpf as string).replace(/\D/g, "");
        if (opts.phone) prefilled.phone = (opts.phone as string).replace(/\D/g, "");
        if (opts.language) prefilled.language = opts.language as string;
        if (opts.job) prefilled.jobDescription = opts.job as string;

        let formData: PartialFormData = prefilled;
        if (interactive) {
          formData = await collectCheckoutForm(prefilled);
        }

        // ── Validate required checkout fields ─────────────────────────
        // Without these, the API returns an opaque 500. Catch it locally
        // with a precise hint so users know what to do.
        const checkout = validateCheckout(formData);
        if (!checkout.valid) {
          const hint = isTTY()
            ? "Use -i para preencher interativamente, ou forneça as flags: --name, --email, --cpf, --phone."
            : "Forneça as flags: --name, --email, --cpf, --phone (ou rode com -i em um terminal).";
          throw new CliError(
            `Dados de checkout obrigatórios faltando:\n  - ${checkout.errors.join("\n  - ")}`,
            "invalid_argument",
            { exitCode: EXIT_USAGE, hint },
          );
        }

        const resume = resolveInput(input);

        // ── 1. Submit order ─────────────────────────────────────────
        const order = await withSpinner(
          "Enviando currículo...",
          () =>
            submitOrder({
              product: "improve_curriculum",
              name: formData.name,
              email: formData.email,
              cpf: formData.cpf,
              phone: formData.phone,
              language: formData.language,
              jobDescription: formData.jobDescription,
              couponCode: opts.coupon as string | undefined,
              resume,
            }),
          { successText: "Currículo enviado!" },
        );

        saveLastOrder(order.orderId, "improve_curriculum");
        await announceOrder(order, "improve_curriculum", { noWait });
        if (noWait) return;

        // ── 2. Poll for payment + processing ────────────────────────
        const result = await waitForOrder(order.orderId, { timeoutMs });
        const completed = assertCompleted(result, order.orderId);

        // ── 3. Download (unless --no-download) ─────────────────────
        if (noDownload) {
          if (isJsonMode()) {
            outputResult({
              orderId: order.orderId,
              status: "completed",
              atsScoreOriginal: completed.atsScoreOriginal,
              atsScoreImproved: completed.atsScoreImproved,
            });
          } else {
            log.info(`Pedido concluído: ${order.orderId}. Baixe com "ajusta order download ${order.orderId}".`);
          }
          return;
        }

        const dl = await withSpinner(
          "Baixando resultado...",
          () => downloadOrderFile(order.orderId, "improved", output),
          { successText: chalk.green(`Salvo em: ${path.resolve(output)}`) },
        );

        if (isJsonMode()) {
          outputResult({
            orderId: order.orderId,
            status: "completed",
            savedTo: dl.savedTo,
            bytes: dl.bytes,
            atsScoreOriginal: completed.atsScoreOriginal,
            atsScoreImproved: completed.atsScoreImproved,
          });
        } else {
          log.info("");
          log.info(chalk.cyan("Obrigado por usar AjustaCV! \u{1F680}"));
          log.info(chalk.dim("https://ajustacv.com"));
        }
      } catch (err) {
        outputError(err);
      }
    });
}

// Backwards-compatible export — used by index.ts
export const cvCommand = buildImproveCommand("cv", true);
