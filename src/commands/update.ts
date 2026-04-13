import { Command } from "commander";
import { execFileSync } from "node:child_process";
import chalk from "chalk";
import { checkForUpdatesExplicit } from "../lib/update.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { log } from "../lib/logger.js";

export const updateCommand = new Command("update")
  .description("Atualiza o CLI para a versão mais recente")
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta update
  $ ajusta update --json

Variáveis de ambiente:
  AJUSTA_NO_UPDATE_CHECK=1    Desabilita verificação automática
`,
  )
  .action(async () => {
    try {
      const result = await withSpinner(
        "Verificando atualizações...",
        () => checkForUpdatesExplicit(),
      );

      if (isJsonMode()) {
        outputResult(result);
        return;
      }

      process.stderr.write(`\n  ${chalk.bold("Versão atual:")}  ${chalk.dim(result.current)}\n`);
      process.stderr.write(`  ${chalk.bold("Última versão:")} ${chalk.dim(result.latest || "desconhecida")}\n\n`);

      if (!result.updateAvailable) {
        log.success("Você está usando a versão mais recente!");
        return;
      }

      log.success(
        `Atualização disponível! ${chalk.yellow(result.current)} ${chalk.dim("\u2192")} ${chalk.cyan(result.latest)}`,
      );
      process.stderr.write("\n");

      // Auto-update via npm
      await withSpinner(
        `Instalando ajusta@${result.latest}...`,
        async () => {
          execFileSync("npm", ["install", "-g", `ajusta@${result.latest}`], {
            stdio: "pipe",
          });
        },
        { successText: chalk.green(`Atualizado para ${result.latest}!`) },
      );

      process.stderr.write(`\n  ${chalk.dim("Execute")} ${chalk.cyan("ajusta --version")} ${chalk.dim("para confirmar.")}\n\n`);
    } catch (err) {
      outputError(err);
    }
  });
