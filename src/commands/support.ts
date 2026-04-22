import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import { input, editor } from "@inquirer/prompts";
import { createSupportTicket } from "../lib/api.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { CliError, EXIT_USAGE } from "../lib/errors.js";
import { isTTY } from "../lib/tty.js";
import { log } from "../lib/logger.js";

export const supportCommand = new Command("support")
  .description("Abre um ticket de suporte")
  .option("-i, --interactive", "Modo interativo")
  .option("--name <nome>", "Nome completo")
  .option("--email <email>", "Email de contato")
  .option("--message <texto>", "Mensagem")
  .option("--message-file <caminho>", "Ler mensagem de arquivo")
  .option("--order-id <id>", "Pedido relacionado (opcional)")
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta support -i
  $ ajusta support --name "João" --email "j@x.com" --message "Oi..."
  $ ajusta support --name X --email e@e.com --message-file msg.txt --json
`,
  )
  .action(async (opts) => {
    try {
      let name = opts.name as string | undefined;
      let email = opts.email as string | undefined;
      let message = opts.message as string | undefined;
      const orderId = opts.orderId as string | undefined;

      if (opts.messageFile) {
        const abs = path.resolve(opts.messageFile as string);
        if (!fs.existsSync(abs)) {
          throw new CliError(`Arquivo não encontrado: ${abs}`, "file_not_found", EXIT_USAGE);
        }
        message = fs.readFileSync(abs, "utf-8");
      }

      if (opts.interactive) {
        if (!isTTY()) {
          throw new CliError(
            "Modo interativo requer um terminal. Use --name/--email/--message.",
            "not_interactive",
            EXIT_USAGE,
          );
        }
        if (!name)
          name = await input({
            message: "Nome",
            required: true,
          });
        if (!email)
          email = await input({
            message: "Email",
            required: true,
            validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Email inválido.",
          });
        if (!message)
          message = await editor({
            message: "Mensagem (salve e feche o editor)",
          });
      }

      if (!name || !email || !message) {
        throw new CliError(
          "Faltam campos obrigatórios. Use -i ou forneça --name, --email e --message.",
          "invalid_argument",
          EXIT_USAGE,
        );
      }

      const result = await withSpinner("Enviando ticket...", () =>
        createSupportTicket({
          name,
          email,
          message,
          orderId,
        }),
      );

      if (isJsonMode()) {
        outputResult(result);
      } else {
        log.success("Ticket enviado! Responderemos no email informado.");
      }
    } catch (err) {
      outputError(err);
    }
  });
