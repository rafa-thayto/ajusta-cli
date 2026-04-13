import { input, select, confirm, editor } from "@inquirer/prompts";
import chalk from "chalk";

export interface CheckoutFormData {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  language: string;
  jobDescription?: string;
}

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

export async function collectCheckoutForm(): Promise<CheckoutFormData> {
  process.stderr.write(`\n${chalk.bold.cyan("  AjustaCV — Dados para o pedido")}\n\n`);

  const name = await input({
    message: "Nome completo",
    required: true,
    validate: (v) => (v.trim().length >= 2 ? true : "Informe seu nome."),
  });

  const email = await input({
    message: "Email",
    required: true,
    validate: validateEmail,
  });

  const cpf = await input({
    message: "CPF",
    required: true,
    validate: validateCpf,
    transformer: (v) => formatCpf(v),
  });

  const phone = await input({
    message: "Telefone",
    required: true,
    validate: (v) =>
      v.replace(/\D/g, "").length >= 10 ? true : "Telefone inválido.",
    transformer: (v) => formatPhone(v),
  });

  const language = await select({
    message: "Idioma do currículo",
    choices: [
      { value: "pt-BR", name: "Português (Brasil)" },
      { value: "en", name: "English" },
      { value: "es", name: "Español" },
      { value: "fr", name: "Français" },
      { value: "de", name: "Deutsch" },
      { value: "it", name: "Italiano" },
    ],
  });

  const hasJobDesc = await confirm({
    message: "Você tem a descrição da vaga?",
    default: true,
  });

  let jobDescription: string | undefined;
  if (hasJobDesc) {
    jobDescription = await editor({
      message: "Cole a descrição da vaga (salve e feche o editor)",
    });
    if (jobDescription && !jobDescription.trim()) {
      jobDescription = undefined;
    }
  }

  return {
    name: name.trim(),
    email: email.trim(),
    cpf: cpf.replace(/\D/g, ""),
    phone: phone.replace(/\D/g, ""),
    language,
    jobDescription: jobDescription?.trim(),
  };
}
