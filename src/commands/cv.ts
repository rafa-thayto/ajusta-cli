import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import ora from "ora";
import chalk from "chalk";
import { submitOrder } from "../lib/api.js";
import { pollUntilComplete } from "../lib/poll.js";
import { downloadOrderFile } from "../lib/download.js";
import { displayPaymentInfo, statusLabel } from "../lib/display.js";
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
`,
    )
    .action(async (input: string, opts) => {
      try {
        if (deprecated && !isJsonMode()) {
          log.warn(`"ajusta cv" será removido em breve. Use "ajusta improve".`);
        }

        const output = opts.output as string;
        const force = opts.force as boolean | undefined;
        const interactive = opts.interactive as boolean | undefined;
        const noDownload = opts.download === false;
        const timeoutMin = parseInt(opts.timeout as string, 10);
        const timeoutMs = (isNaN(timeoutMin) ? 30 : timeoutMin) * 60 * 1_000;

        if (!noDownload && fs.existsSync(output) && !force) {
          throw new FileError(
            `Arquivo já existe: ${path.resolve(output)}. Use --force para sobrescrever.`,
            "file_read_error",
          );
        }

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
            `Dados de checkout obrigatórios faltando:\n  - ${checkout.errors.join("\n  - ")}\n\n  ${hint}`,
            "invalid_argument",
            EXIT_USAGE,
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

        if (isJsonMode()) {
          outputResult({
            orderId: order.orderId,
            paymentUrl: order.paymentUrl,
            brCode: order.brCode,
            expiresAt: order.expiresAt,
            finalPriceCents: order.finalPriceCents,
            discountCents: order.discountCents,
            zeroPriceOrder: order.zeroPriceOrder ?? false,
          });
        } else {
          await displayPaymentInfo(order, "improve_curriculum");
        }

        // ── 2. Poll for payment + processing ────────────────────────
        const useSpinner = isTTY() && !isJsonMode();
        const spinner = useSpinner
          ? ora({ text: statusLabel("pending_payment"), stream: process.stderr }).start()
          : null;

        const result = await pollUntilComplete(order.orderId, {
          timeoutMs,
          onChange: ({ status, processingStep }) => {
            if (spinner) spinner.text = statusLabel(status, processingStep);
          },
        });

        if (result.status === "failed") {
          spinner?.fail(chalk.red("Processamento falhou."));
          throw new CliError(
            "Processamento falhou.\n\n" +
              "  Próximos passos:\n" +
              `    1. Tente novamente: ajusta order retry ${order.orderId}\n` +
              "    2. Verifique se o arquivo não está corrompido\n" +
              "    3. Acesse https://ajustacv.com para suporte",
            "api_error",
          );
        }

        if (result.status === "expired") {
          spinner?.fail(chalk.red("Pagamento expirado."));
          throw new CliError(
            "O tempo para pagamento expirou.\n\n" +
              "  Execute novamente para gerar um novo PIX.",
            "api_error",
          );
        }

        spinner?.succeed(chalk.green("Currículo otimizado com sucesso!"));

        // ── 3. Download (unless --no-download) ─────────────────────
        if (noDownload) {
          if (isJsonMode()) {
            outputResult({
              orderId: order.orderId,
              status: "completed",
              atsScoreOriginal: result.order.atsScoreOriginal,
              atsScoreImproved: result.order.atsScoreImproved,
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
            atsScoreOriginal: result.order.atsScoreOriginal,
            atsScoreImproved: result.order.atsScoreImproved,
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
