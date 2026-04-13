import { Command } from "commander";
import chalk from "chalk";
import { checkForUpdatesExplicit } from "../lib/update.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { log } from "../lib/logger.js";
import { VERSION } from "../lib/constants.js";

export const updateCommand = new Command("update")
  .description("Verifica se há uma nova versão disponível")
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

      if (result.updateAvailable) {
        log.success(
          `Atualização disponível! ${chalk.yellow(result.current)} ${chalk.dim("\u2192")} ${chalk.cyan(result.latest)}`,
        );
        process.stderr.write(`\n  ${chalk.bold("Execute:")}\n`);
        process.stderr.write(`    ${chalk.cyan("npm install -g ajusta")}\n\n`);
      } else {
        log.success("Você está usando a versão mais recente!");
      }
    } catch (err) {
      outputError(err);
    }
  });
