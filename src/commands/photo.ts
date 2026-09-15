import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { select, input as askInput, confirm } from "@inquirer/prompts";
import { submitOrder } from "../lib/api.js";
import { downloadOrderFile } from "../lib/download.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { log } from "../lib/logger.js";
import { saveLastOrder } from "../lib/config.js";
import { collectCheckoutForm, type PartialFormData } from "../lib/prompts.js";
import { CliError, EXIT_USAGE, FileError } from "../lib/errors.js";
import { resolvePhotoInput } from "../lib/input.js";
import { DEFAULT_PHOTO_OUTPUT, PHOTO_STYLES } from "../lib/constants.js";
import { announceOrder, assertCompleted, timeoutMinutesToMs, waitForOrder } from "../lib/wait.js";
import { ensureWritable } from "./cv.js";

export const photoCommand = new Command("photo")
  .description("Gera uma foto profissional com IA")
  .argument("<image>", "Caminho para JPG/PNG/WebP (máx. 10MB)")
  .option(
    "--style <estilo>",
    `Estilo: ${PHOTO_STYLES.join(" | ")} (obrigatório sem -i ou --from)`,
  )
  .option("--profession <texto>", "Sua profissão (ex: 'Engenheira de Software')")
  .option("-i, --interactive", "Modo interativo")
  .option("--from <caminho>", "JSON com { checkout, photo }")
  .option("--name <nome>", "Nome completo")
  .option("--email <email>", "Email")
  .option("--cpf <cpf>", "CPF")
  .option("--phone <telefone>", "Telefone")
  .option("--language <idioma>", "Idioma: pt-BR, en, es, fr, de, it")
  .option("--coupon <code>", "Código de cupom")
  .option(
    "-o, --output <caminho>",
    "Caminho para salvar o PNG",
    DEFAULT_PHOTO_OUTPUT,
  )
  .option("--force", "Sobrescrever arquivo de saída")
  .option("--timeout <minutos>", "Timeout em minutos", "15")
  .option("--no-download", "Não baixar o resultado automaticamente")
  .option("--no-wait", "Cria o pedido e sai; acompanhe com `ajusta order wait`")
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta photo selfie.jpg --style linkedin --profession "Engenheiro" -i
  $ ajusta photo selfie.jpg --style corporate --profession "Médica" \\
      --name "Dra. Ana" --email "ana@ex.com" --cpf "12345678901" \\
      --phone "11987654321" --json
  $ ajusta photo selfie.png --from spec.json --no-wait --json

Esquema de --from spec.json:
  {
    "checkout": { "name":"...", "email":"...", "cpf":"...", "phone":"...",
                  "language":"pt-BR", "coupon":"OPTIONAL" },
    "photo":    { "style":"linkedin", "profession":"Engenheira" }
  }
`,
  )
  .action(async (image: string, opts) => {
    try {
      const output = opts.output as string;
      const noDownload = opts.download === false;
      const noWait = opts.wait === false;
      const timeoutMs = timeoutMinutesToMs(opts.timeout, 15);

      if (!noDownload && !noWait) ensureWritable(output, opts.force as boolean | undefined);

      const photo = resolvePhotoInput(image);
      if (photo.warn && !isJsonMode()) log.warn(photo.warn);

      // ── Load spec from --from ────────────────────────────────────
      const prefilled: PartialFormData = {};
      let style: string | undefined = opts.style as string | undefined;
      let profession: string | undefined = opts.profession as string | undefined;
      let coupon: string | undefined = opts.coupon as string | undefined;

      if (opts.from) {
        const abs = path.resolve(opts.from as string);
        if (!fs.existsSync(abs)) {
          throw new FileError(`Arquivo não encontrado: ${abs}`, "file_not_found");
        }
        let spec: {
          checkout?: {
            name?: string;
            email?: string;
            cpf?: string;
            phone?: string;
            language?: string;
            coupon?: string;
          };
          photo?: { style?: string; profession?: string };
        };
        try {
          spec = JSON.parse(fs.readFileSync(abs, "utf-8"));
        } catch {
          throw new FileError(`JSON inválido em ${abs}`, "invalid_spec");
        }
        if (spec.checkout) {
          prefilled.name = spec.checkout.name;
          prefilled.email = spec.checkout.email;
          prefilled.cpf = spec.checkout.cpf?.replace(/\D/g, "");
          prefilled.phone = spec.checkout.phone?.replace(/\D/g, "");
          prefilled.language = spec.checkout.language;
          coupon = coupon ?? spec.checkout.coupon;
        }
        if (spec.photo) {
          style = style ?? spec.photo.style;
          profession = profession ?? spec.photo.profession;
        }
      }

      // Inline flags override --from
      if (opts.name) prefilled.name = opts.name as string;
      if (opts.email) prefilled.email = opts.email as string;
      if (opts.cpf) prefilled.cpf = (opts.cpf as string).replace(/\D/g, "");
      if (opts.phone) prefilled.phone = (opts.phone as string).replace(/\D/g, "");
      if (opts.language) prefilled.language = opts.language as string;

      // ── Interactive / validation ─────────────────────────────────
      let formData: PartialFormData = prefilled;
      if (opts.interactive) {
        formData = await collectCheckoutForm(prefilled);
        if (!style) {
          style = await select({
            message: "Estilo da foto",
            choices: PHOTO_STYLES.map((s) => ({ value: s, name: s })),
          });
        }
        if (!profession) {
          const wants = await confirm({
            message: "Informar sua profissão? (melhora o resultado)",
            default: true,
          });
          if (wants) {
            profession = await askInput({ message: "Profissão" });
          }
        }
      }

      if (
        !formData.name ||
        !formData.email ||
        !formData.cpf ||
        !formData.phone
      ) {
        throw new CliError(
          "Dados de checkout incompletos.",
          "invalid_argument",
          { exitCode: EXIT_USAGE, hint: "Use -i ou --name/--email/--cpf/--phone." },
        );
      }
      if (!style) {
        throw new CliError(
          `--style é obrigatório (ou use -i). Opções: ${PHOTO_STYLES.join(", ")}`,
          "invalid_argument",
          EXIT_USAGE,
        );
      }
      if (!PHOTO_STYLES.includes(style as (typeof PHOTO_STYLES)[number])) {
        throw new CliError(
          `Estilo inválido: ${style}. Opções: ${PHOTO_STYLES.join(", ")}`,
          "invalid_argument",
          EXIT_USAGE,
        );
      }

      // ── Submit ───────────────────────────────────────────────────
      const order = await withSpinner(
        "Enviando foto...",
        () =>
          submitOrder({
            product: "professional_photo",
            name: formData.name,
            email: formData.email,
            cpf: formData.cpf,
            phone: formData.phone,
            language: formData.language,
            couponCode: coupon,
            photo,
            photoStyle: style,
            photoProfession: profession,
          }),
        { successText: "Foto enviada!" },
      );

      saveLastOrder(order.orderId, "professional_photo");
      await announceOrder(order, "professional_photo", { noWait });
      if (noWait) return;

      const result = await waitForOrder(order.orderId, {
        timeoutMs,
        processingFallback: "Gerando foto com IA...",
      });
      assertCompleted(result, order.orderId);

      if (noDownload) {
        if (isJsonMode()) outputResult({ orderId: order.orderId, status: "completed" });
        return;
      }

      const dl = await withSpinner(
        "Baixando foto...",
        () => downloadOrderFile(order.orderId, "generated-photo", output),
        { successText: chalk.green(`Salvo em: ${path.resolve(output)}`) },
      );

      if (isJsonMode()) {
        outputResult({
          orderId: order.orderId,
          status: "completed",
          savedTo: dl.savedTo,
          bytes: dl.bytes,
        });
      } else {
        log.info(
          chalk.dim("Dica: use `ajusta order regenerate-photo` para tentar outros estilos (até 3 vezes)."),
        );
      }
    } catch (err) {
      outputError(err);
    }
  });
