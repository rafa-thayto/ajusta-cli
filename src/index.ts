import { Command } from "commander";
import { VERSION } from "./lib/constants.js";
import { configureLogger } from "./lib/logger.js";
import { setJsonMode, outputError } from "./lib/output.js";
import { stopActiveSpinner } from "./lib/spinner.js";
import { EXIT_SIGINT } from "./lib/errors.js";
import { cvCommand } from "./commands/cv.js";
import { statusCommand } from "./commands/status.js";

// ── Global exit handlers ────────────────────────────────────────────

process.on("SIGINT", () => {
  stopActiveSpinner();
  process.stderr.write("\n");
  process.exit(EXIT_SIGINT);
});

process.on("uncaughtException", (err) => {
  outputError(err);
});

process.on("unhandledRejection", (err) => {
  outputError(err);
});

// ── Program ─────────────────────────────────────────────────────────

const program = new Command()
  .name("ajusta")
  .description("Otimize seu currículo com IA — by AjustaCV")
  .version(VERSION, "-v, --version")
  .option("--json", "Saída em JSON (automático quando stdout é pipe)")
  .option("--verbose", "Exibir informações de debug")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    const json = !!opts.json;
    const verbose = !!opts.verbose;
    setJsonMode(json);
    configureLogger({ json, verbose });
  });

program.addCommand(cvCommand);
program.addCommand(statusCommand);

// Show help when no command is provided
program.action(() => {
  program.help();
});

program.addHelpText(
  "after",
  `
Exemplos:
  $ ajusta cv meu-curriculo.pdf
  $ ajusta cv curriculo.docx -o resultado.pdf
  $ ajusta status 507f1f77bcf86cd799439011
  $ ajusta cv curriculo.pdf --json | jq .orderId

Variáveis de ambiente:
  AJUSTA_API_URL    URL da API (padrão: https://api.ajustacv.com)

https://ajustacv.com — Otimize seu currículo com IA
`,
);

program.parse();
