import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import path from "node:path";
import { analyzeAts } from "../lib/api.js";
import { withSpinner } from "../lib/spinner.js";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { displayAtsScoreCard } from "../lib/display.js";
import { resolveInput, resolveTextInput } from "../lib/input.js";
import { CliError, EXIT_USAGE } from "../lib/errors.js";
import { SUPPORTED_LANGUAGES } from "../lib/constants.js";
import { log } from "../lib/logger.js";

export const atsCommand = new Command("ats")
  .description("Pontuação ATS gratuita — sem pedido, sem pagamento")
  .argument(
    "[input]",
    "Caminho para PDF/DOCX ou conteúdo de currículo; omita para ler de stdin",
  )
  .option("--job <texto>", "Descrição da vaga (inline)")
  .option("--job-file <caminho>", "Descrição da vaga a partir de arquivo")
  .option(
    "--language <idioma>",
    `Idioma: ${SUPPORTED_LANGUAGES.join(", ")}`,
  )
  .option("--score-only", "Imprime apenas a pontuação inteira em stdout")
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta ats meu-curriculo.pdf
  $ ajusta ats meu-curriculo.pdf --job "Vaga de Engenheiro..."
  $ ajusta ats curriculo.pdf --job-file vaga.txt
  $ cat curriculo.txt | ajusta ats
  $ ajusta ats curriculo.pdf --json | jq .score

Observações:
  - Endpoint gratuito, determinístico e rate-limited (10 req/min/IP).
  - Sem descrição de vaga, a categoria "keywords" é omitida e os pesos
    se redistribuem.
`,
  )
  .action(async (input: string | undefined, opts) => {
    try {
      // ── Collect job description ─────────────────────────────────
      let jobDescription: string | undefined;
      if (opts.job && opts.jobFile) {
        throw new CliError(
          "Use --job OU --job-file, não ambos.",
          "invalid_argument",
          EXIT_USAGE,
        );
      }
      if (opts.job) jobDescription = opts.job as string;
      if (opts.jobFile) {
        const abs = path.resolve(opts.jobFile as string);
        if (!fs.existsSync(abs)) {
          throw new CliError(
            `Arquivo não encontrado: ${abs}`,
            "file_not_found",
            EXIT_USAGE,
          );
        }
        jobDescription = fs.readFileSync(abs, "utf-8");
      }

      const language = (opts.language as string | undefined) ?? undefined;

      // ── Resolve resume input (positional / stdin / inline text) ─
      let resumeArg = input;

      // If no positional and stdin is piped, read stdin as raw text
      if (!resumeArg && !process.stdin.isTTY) {
        const chunks: Buffer[] = [];
        for await (const chunk of process.stdin) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const text = Buffer.concat(chunks).toString("utf-8").trim();
        if (!text) {
          throw new CliError(
            "Nenhum conteúdo recebido via stdin.",
            "invalid_argument",
            EXIT_USAGE,
          );
        }
        const result = await withSpinner("Analisando...", () =>
          analyzeAts({ resumeText: text, jobDescription, language }),
        );
        return emit(result, opts.scoreOnly as boolean | undefined);
      }

      if (!resumeArg) {
        throw new CliError(
          "Informe um arquivo ou envie conteúdo por stdin.\n\n  Exemplo: ajusta ats meu-curriculo.pdf",
          "invalid_argument",
          EXIT_USAGE,
        );
      }

      // If the argument exists as a file path → upload; else resolve as text
      const absPath = path.resolve(resumeArg);
      if (fs.existsSync(absPath) && fs.statSync(absPath).isFile()) {
        const ext = path.extname(absPath).toLowerCase();
        if (ext === ".pdf" || ext === ".docx") {
          const resume = resolveInput(resumeArg);
          const result = await withSpinner("Analisando...", () =>
            analyzeAts({ resume, jobDescription, language }),
          );
          return emit(result, opts.scoreOnly as boolean | undefined);
        }
        // Text file → read as plain text
        const text = resolveTextInput(resumeArg);
        const result = await withSpinner("Analisando...", () =>
          analyzeAts({ resumeText: text, jobDescription, language }),
        );
        return emit(result, opts.scoreOnly as boolean | undefined);
      }

      // Not a file — treat as inline text
      const result = await withSpinner("Analisando...", () =>
        analyzeAts({ resumeText: resumeArg, jobDescription, language }),
      );
      return emit(result, opts.scoreOnly as boolean | undefined);
    } catch (err) {
      outputError(err);
    }
  });

function emit(result: Awaited<ReturnType<typeof analyzeAts>>, scoreOnly: boolean | undefined) {
  if (scoreOnly) {
    process.stdout.write(`${result.score}\n`);
    return;
  }

  if (isJsonMode()) {
    outputResult(result);
    return;
  }

  displayAtsScoreCard(result);

  if (result.score < 70) {
    log.info(
      `${chalk.dim("Quer melhorar esta pontuação?")} ${chalk.cyan("ajusta improve <arquivo>")}`,
    );
  }
}
