import { input, select, confirm, editor } from "@inquirer/prompts";
import chalk from "chalk";
import { isTTY } from "./tty.js";
import { CliError, EXIT_USAGE } from "./errors.js";

export interface CheckoutFormData {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  language: string;
  jobDescription?: string;
}

/** Fields that can be pre-filled via CLI flags. */
export type PartialFormData = Partial<CheckoutFormData>;

// ── Formatting ──────────────────────────────────────────────────────

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ── Validation ──────────────────────────────────────────────────────

function validateEmail(value: string): boolean | string {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(value)) return "Email inválido.";
  return true;
}

function validateCpf(value: string): boolean | string {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return "CPF deve ter 11 dígitos.";
  if (/^(\d)\1{10}$/.test(digits)) return "CPF inválido.";
  return true;
}

// ── Visual framing ──────────────────────────────────────────────────

function intro(title: string) {
  process.stderr.write(`\n  ${chalk.bold.cyan("\u250C")}  ${chalk.bold.cyan(title)}\n`);
}

function bar() {
  process.stderr.write(`  ${chalk.cyan("\u2502")}\n`);
}

function outro(msg: string) {
  process.stderr.write(`  ${chalk.cyan("\u2502")}\n`);
  process.stderr.write(`  ${chalk.bold.cyan("\u2514")}  ${chalk.dim(msg)}\n\n`);
}

// ── Main form collector ─────────────────────────────────────────────

/**
 * Collect checkout form data interactively.
 * Fields already provided in `prefilled` are skipped.
 * Errors if not in a TTY (non-interactive environment).
 */
export async function collectCheckoutForm(
  prefilled: PartialFormData = {},
): Promise<CheckoutFormData> {
  if (!isTTY()) {
    throw new CliError(
      "Modo interativo requer um terminal (TTY).\n\n" +
      "  Use flags para fornecer os dados:\n" +
      "    --name, --email, --cpf, --phone, --language, --job",
      "not_interactive",
      EXIT_USAGE,
    );
  }

  intro("AjustaCV \u2014 Dados para o pedido");

  const name =
    prefilled.name ||
    (await input({
      message: "Nome completo",
      required: true,
      validate: (v) => (v.trim().length >= 2 ? true : "Informe seu nome."),
    }));

  const email =
    prefilled.email ||
    (await input({
      message: "Email",
      required: true,
      validate: validateEmail,
    }));

  const cpf =
    prefilled.cpf ||
    (await input({
      message: "CPF",
      required: true,
      validate: validateCpf,
      transformer: (v) => formatCpf(v),
    }));

  const phone =
    prefilled.phone ||
    (await input({
      message: "Telefone",
      required: true,
      validate: (v) =>
        v.replace(/\D/g, "").length >= 10 ? true : "Telefone inválido.",
      transformer: (v) => formatPhone(v),
    }));

  const LANGUAGE_CHOICES = [
    { value: "pt-BR", name: "Português (Brasil)" },
    { value: "en", name: "English" },
    { value: "es", name: "Español" },
    { value: "fr", name: "Français" },
    { value: "de", name: "Deutsch" },
    { value: "it", name: "Italiano" },
  ] as const;

  const language =
    prefilled.language ||
    (await select({
      message: "Idioma do currículo",
      choices: [...LANGUAGE_CHOICES],
    }));

  let jobDescription = prefilled.jobDescription;
  if (jobDescription === undefined) {
    const hasJobDesc = await confirm({
      message: "Você tem a descrição da vaga?",
      default: true,
    });

    if (hasJobDesc) {
      jobDescription = await editor({
        message: "Cole a descrição da vaga (salve e feche o editor)",
      });
      if (jobDescription && !jobDescription.trim()) {
        jobDescription = undefined;
      }
    }
  }

  bar();
  outro("Dados coletados!");

  return {
    name: name.trim(),
    email: email.trim(),
    cpf: cpf.replace(/\D/g, ""),
    phone: phone.replace(/\D/g, ""),
    language,
    jobDescription: jobDescription?.trim(),
  };
}
