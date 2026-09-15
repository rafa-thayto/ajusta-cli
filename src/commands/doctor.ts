import { Command } from "commander";
import chalk from "chalk";
import { runDoctor, type DoctorCheck } from "../lib/doctor.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { CliError, EXIT_GENERAL } from "../lib/errors.js";

const MARK: Record<DoctorCheck["status"], string> = {
  pass: chalk.green("✔"),
  warn: chalk.yellow("⚠"),
  fail: chalk.red("✘"),
};

export const doctorCommand = new Command("doctor")
  .description("Verifica Node, API, config e a skill do Claude Code")
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta doctor
  $ ajusta doctor --json

Sai com código 1 se alguma verificação falhar (avisos não falham).
`,
  )
  .action(async () => {
    try {
      const report = await withSpinner("Verificando...", () => runDoctor(), { retries: 0 });

      if (isJsonMode()) {
        outputResult(report);
      } else {
        process.stderr.write("\n");
        for (const check of report.checks) {
          process.stderr.write(`  ${MARK[check.status]} ${check.message}\n`);
          if (check.hint) {
            process.stderr.write(`      ${chalk.dim("→")} ${chalk.cyan(check.hint)}\n`);
          }
        }
        process.stderr.write("\n");
      }

      if (!report.ok) {
        throw new CliError(
          "Algumas verificações falharam.",
          "doctor_failed",
          { exitCode: EXIT_GENERAL, hint: "Siga as sugestões acima." },
        );
      }
    } catch (err) {
      outputError(err);
    }
  });
