import { Command } from "commander";
import path from "node:path";
import chalk from "chalk";
import { extractLinkedIn, fillResume, submitOrder } from "../lib/api.js";
import { downloadOrderFile } from "../lib/download.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { log } from "../lib/logger.js";
import { clearPendingCreate, saveLastOrder, savePendingCreate } from "../lib/config.js";
import { collectCheckoutForm, type PartialFormData } from "../lib/prompts.js";
import {
  collectFillResumeForm,
  extractFillBody,
  parseResumeSpecFile,
  type CreateResumeSpec,
  type PartialSpec,
} from "../lib/resume-form.js";
import { validateCheckout, validateResume } from "../lib/validation.js";
import { CliError, EXIT_USAGE } from "../lib/errors.js";
import { isTTY } from "../lib/tty.js";
import { DEFAULT_OUTPUT } from "../lib/constants.js";
import { announceOrder, assertCompleted, timeoutMinutesToMs, waitForOrder } from "../lib/wait.js";
import { ensureWritable } from "./cv.js";

export const createCommand = new Command("create")
  .description("Cria um currículo do zero (create_curriculum)")
  .option("-i, --interactive", "Modo interativo (wizard)")
  .option("--from <caminho>", "JSON com os dados completos do currículo")
  .option("--linkedin <url>", "URL do LinkedIn para pré-preenchimento")
  .option("--name <nome>", "Nome completo")
  .option("--email <email>", "Email")
  .option("--cpf <cpf>", "CPF")
  .option("--phone <telefone>", "Telefone")
  .option("--language <idioma>", "Idioma: pt-BR, en, es, fr, de, it")
  .option("--coupon <code>", "Código de cupom")
  .option("-o, --output <caminho>", "Caminho para salvar o PDF", DEFAULT_OUTPUT)
  .option("--force", "Sobrescrever arquivo de saída")
  .option("--timeout <minutos>", "Timeout em minutos", "30")
  .option("--no-download", "Não baixar o resultado automaticamente")
  .option("--no-wait", "Cria o pedido e sai; `ajusta order wait` envia o formulário após o pagamento")
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta create -i
  $ ajusta create --from resume.json --json
  $ ajusta create --linkedin https://linkedin.com/in/fulano -i
  $ ajusta create --from partial.json -i   # híbrido: preenche o que faltar
  $ ajusta create --from resume.json --no-wait --json   # agentes

Esquema do JSON em --from:
  Veja skill/ajusta-cv/references/resume-schema.md.
  Campos mínimos: name, email, cpf, phone, experiences[0].

Com --no-wait, os dados do currículo ficam em ~/.config/ajusta/ e são enviados
por \`ajusta order wait <id>\` assim que o pagamento for confirmado.
`,
  )
  .action(async (opts) => {
    try {
      const output = opts.output as string;
      const noDownload = opts.download === false;
      const noWait = opts.wait === false;
      const timeoutMs = timeoutMinutesToMs(opts.timeout, 30);

      if (!noDownload && !noWait) ensureWritable(output, opts.force as boolean | undefined);

      // ── Build a PartialSpec from --from, inline flags, and LinkedIn ───
      let spec: PartialSpec = {};

      if (opts.from) {
        spec = { ...spec, ...parseResumeSpecFile(opts.from as string) };
      }

      // Inline flags override --from
      if (opts.name) spec.name = opts.name as string;
      if (opts.email) spec.email = opts.email as string;
      if (opts.cpf) spec.cpf = (opts.cpf as string).replace(/\D/g, "");
      if (opts.phone) spec.phone = (opts.phone as string).replace(/\D/g, "");
      if (opts.language) spec.language = opts.language as string;
      if (opts.coupon) spec.couponCode = opts.coupon as string;

      // LinkedIn short-circuit
      let resumeTextFromLinkedIn: string | undefined;
      if (opts.linkedin) {
        const url = opts.linkedin as string;
        if (!/^https?:\/\//i.test(url)) {
          throw new CliError(
            "URL do LinkedIn inválida.",
            "invalid_argument",
            EXIT_USAGE,
          );
        }
        const extracted = await withSpinner(
          "Extraindo perfil do LinkedIn...",
          () => extractLinkedIn(url),
        );
        resumeTextFromLinkedIn = extracted.profileText ?? extracted.text;
        if (!spec.linkedinUrl) spec.linkedinUrl = url;
        if (!resumeTextFromLinkedIn && !isJsonMode()) {
          log.warn("LinkedIn não retornou conteúdo. Continuando sem pré-preenchimento.");
        }
      }

      // ── Interactive: fill in gaps ─────────────────────────────────
      const checkoutValid = validateCheckout(spec).valid;
      const needsInteractive = opts.interactive && (!checkoutValid || !spec.experiences);

      let fillBody: Record<string, unknown> = extractFillBody(spec as CreateResumeSpec);

      if (needsInteractive || (opts.interactive && !opts.from)) {
        if (!isTTY()) {
          throw new CliError(
            "Modo interativo requer um terminal.",
            "not_interactive",
            { exitCode: EXIT_USAGE, hint: "Use --from <resume.json> com os dados completos." },
          );
        }

        const prefilled: PartialFormData = {
          name: spec.name,
          email: spec.email,
          cpf: spec.cpf,
          phone: spec.phone,
          language: spec.language,
          jobDescription: spec.jobDescription,
        };
        const checkout = await collectCheckoutForm(prefilled);
        spec.name = checkout.name;
        spec.email = checkout.email;
        spec.cpf = checkout.cpf;
        spec.phone = checkout.phone;
        spec.language = checkout.language;
        spec.jobDescription = checkout.jobDescription;

        const form = await collectFillResumeForm(spec);
        fillBody = {
          ...fillBody,
          ...extractFillBody({ ...spec, ...form } as CreateResumeSpec),
        };
        if (resumeTextFromLinkedIn) fillBody.resumeText = resumeTextFromLinkedIn;
      } else {
        // Non-interactive: must have everything already
        const ck = validateCheckout(spec);
        if (!ck.valid) {
          throw new CliError(
            `Dados de checkout incompletos:\n  - ${ck.errors.join("\n  - ")}`,
            "invalid_argument",
            EXIT_USAGE,
          );
        }
        if (!resumeTextFromLinkedIn) {
          const rv = validateResume(spec);
          if (!rv.valid) {
            throw new CliError(
              `Dados do currículo incompletos:\n  - ${rv.errors.join("\n  - ")}`,
              "invalid_spec",
              EXIT_USAGE,
            );
          }
        } else {
          fillBody.resumeText = resumeTextFromLinkedIn;
        }
      }

      // ── 1. Create the order ──────────────────────────────────────
      const order = await withSpinner(
        "Criando pedido...",
        () =>
          submitOrder({
            product: "create_curriculum",
            name: spec.name!,
            email: spec.email!,
            cpf: spec.cpf!,
            phone: spec.phone!,
            language: spec.language,
            jobDescription: spec.jobDescription,
            couponCode: spec.couponCode,
            resumeText: resumeTextFromLinkedIn,
          }),
        { successText: "Pedido criado!" },
      );

      saveLastOrder(order.orderId, "create_curriculum");
      // Crash safety: `ajusta order wait` / `ajusta order fill` finish the
      // order from this file if this process dies before payment lands.
      savePendingCreate(order.orderId, fillBody);
      await announceOrder(order, "create_curriculum", { noWait });
      if (noWait) return;

      // ── 2. Wait for payment, submit the form, wait for processing ─
      const result = await waitForOrder(order.orderId, {
        timeoutMs,
        afterPayment: async () => {
          await fillResume(order.orderId, fillBody);
          clearPendingCreate(order.orderId);
        },
      });
      const completed = assertCompleted(result, order.orderId);

      if (noDownload) {
        if (isJsonMode()) outputResult({ orderId: order.orderId, status: "completed" });
        return;
      }

      const dl = await withSpinner(
        "Baixando PDF...",
        () => downloadOrderFile(order.orderId, "improved", output),
        { successText: chalk.green(`Salvo em: ${path.resolve(output)}`) },
      );

      if (isJsonMode()) {
        outputResult({
          orderId: order.orderId,
          status: "completed",
          savedTo: dl.savedTo,
          bytes: dl.bytes,
          atsScoreImproved: completed.atsScoreImproved,
        });
      } else {
        log.info(chalk.cyan("Pronto! Obrigado por usar AjustaCV."));
      }
    } catch (err) {
      outputError(err);
    }
  });
