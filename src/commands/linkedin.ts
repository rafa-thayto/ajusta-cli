import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import { extractLinkedIn } from "../lib/api.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { CliError, EXIT_USAGE } from "../lib/errors.js";
import { log } from "../lib/logger.js";

export const linkedinCommand = new Command("linkedin")
  .description("Extrai texto público de um perfil do LinkedIn")
  .argument("<url>", "URL completa do perfil do LinkedIn")
  .option("-o, --output <caminho>", "Salvar texto extraído em arquivo")
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta linkedin https://linkedin.com/in/fulano
  $ ajusta linkedin https://linkedin.com/in/fulano -o perfil.txt
  $ ajusta linkedin https://linkedin.com/in/fulano --json | jq .profileText

Observações:
  - Rate limit: 5 req/min/IP.
  - Útil para pre-preencher dados em \`ajusta create --linkedin=<url>\`.
`,
  )
  .action(async (url: string, opts) => {
    try {
      if (!/^https?:\/\//i.test(url)) {
        throw new CliError(
          "URL inválida. Informe a URL completa (https://linkedin.com/in/...)",
          "invalid_argument",
          EXIT_USAGE,
        );
      }

      const result = await withSpinner("Extraindo perfil...", () =>
        extractLinkedIn(url),
      );

      const text = result.profileText ?? result.text ?? "";

      if (opts.output) {
        const abs = path.resolve(opts.output as string);
        fs.writeFileSync(abs, text, "utf-8");
        if (isJsonMode()) {
          outputResult({ ...result, savedTo: abs, bytes: Buffer.byteLength(text, "utf-8") });
        } else {
          log.success(`Texto salvo em: ${chalk.cyan(abs)}`);
        }
        return;
      }

      if (isJsonMode()) {
        outputResult({ ...result, savedTo: null });
      } else {
        process.stdout.write(text + "\n");
      }
    } catch (err) {
      outputError(err);
    }
  });
