import { Command } from "commander";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chalk from "chalk";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { CliError } from "../lib/errors.js";
import { log } from "../lib/logger.js";

function locateSkillSource(): string {
  // Try several candidate locations so this works both when running from the
  // bundled npm package (dist/ alongside skill/) and during local dev.
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../skill/ajusta-cv"), // dist/../skill/ajusta-cv  (packaged layout)
    path.resolve(here, "../../skill/ajusta-cv"), // src/commands → repo/skill/ajusta-cv
    path.resolve(here, "skill/ajusta-cv"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, "SKILL.md"))) return c;
  }
  throw new CliError(
    "Não foi possível localizar o diretório da skill no pacote instalado.",
    "file_not_found",
  );
}

function copyRecursive(src: string, dest: string): number {
  let count = 0;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      count += copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
    count += 1;
  }
  return count;
}

export const installSkillCommand = new Command("install-skill")
  .description("Instala a skill ajusta-cv em ~/.claude/skills/ajusta-cv")
  .option("--force", "Sobrescrever instalação existente")
  .option(
    "--to <caminho>",
    "Diretório de destino customizado",
    path.join(os.homedir(), ".claude", "skills", "ajusta-cv"),
  )
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta install-skill
  $ ajusta install-skill --force
  $ ajusta install-skill --to ~/projetos/minhas-skills/ajusta-cv

Após a instalação, abra o Claude Code em qualquer diretório — a skill
será sugerida automaticamente para tarefas relacionadas a currículos.
`,
  )
  .action(async (opts) => {
    try {
      const source = locateSkillSource();
      const target = opts.to as string;

      const exists = fs.existsSync(target);
      if (exists && !opts.force) {
        throw new CliError(
          `Diretório de destino já existe: ${target}. Use --force para sobrescrever.`,
          "api_error",
        );
      }
      if (exists) {
        fs.rmSync(target, { recursive: true, force: true });
      }

      const count = copyRecursive(source, target);

      if (isJsonMode()) {
        outputResult({ source, target, filesCopied: count });
      } else {
        log.success(`Skill instalada em ${chalk.cyan(target)} (${count} arquivo(s)).`);
        log.info(`Reinicie o Claude Code para carregar a skill.`);
      }
    } catch (err) {
      outputError(err);
    }
  });
