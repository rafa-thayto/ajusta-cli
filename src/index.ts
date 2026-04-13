import { Command } from "commander";
import { VERSION } from "./lib/constants.js";
import { configureLogger } from "./lib/logger.js";
import { setJsonMode, outputError } from "./lib/output.js";
import { stopActiveSpinner } from "./lib/spinner.js";
import { EXIT_SIGINT } from "./lib/errors.js";
import { checkForUpdates } from "./lib/update.js";
import { cvCommand } from "./commands/cv.js";
import { statusCommand } from "./commands/status.js";
import { updateCommand } from "./commands/update.js";

// ── Global exit handlers ────────────────────────────────────────────

process.on("SIGINT", () => {
  stopActiveSpinner();
  process.stderr.write("\n");
  process.exit(EXIT_SIGINT);
});

process.on("uncaughtException", (err) => {
  // @inquirer/prompts throws ExitPromptError on Ctrl+C — clean exit
  if (err instanceof Error && err.name === "ExitPromptError") {
    stopActiveSpinner();
    process.stderr.write("\n");
    process.exit(0);
  }
  outputError(err);
});

process.on("unhandledRejection", (err) => {
  if (err instanceof Error && err.name === "ExitPromptError") {
    stopActiveSpinner();
    process.stderr.write("\n");
    process.exit(0);
  }
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
program.addCommand(updateCommand);

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
  $ ajusta update

Variáveis de ambiente:
  AJUSTA_API_URL              URL da API (padrão: https://api.ajustacv.com)
  AJUSTA_NO_UPDATE_CHECK=1    Desabilita verificação automática de atualizações

https://ajustacv.com — Otimize seu currículo com IA
`,
);

// Parse and run, then check for updates in the background
program
  .parseAsync()
  .then(() => {
    // Skip background check if user ran `update` explicitly
    const ran = program.args[0];
    if (ran === "update") return;

    return checkForUpdates().catch(() => {});
  })
  .catch(() => {});
