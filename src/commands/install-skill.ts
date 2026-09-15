import { Command } from "commander";
import fs from "node:fs";
import chalk from "chalk";
import { isJsonMode, outputResult, outputError } from "../lib/output.js";
import { CliError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import { copyRecursive, defaultSkillTarget, locateSkillSource } from "../lib/skill-files.js";

export const installSkillCommand = new Command("install-skill")
  .description("Instala a skill ajusta-cv em ~/.claude/skills/ajusta-cv")
  .option("--force", "Sobrescrever instalação existente")
  .option("--to <caminho>", "Diretório de destino customizado", defaultSkillTarget())
  .addHelpText(
    "after",
    `
Exemplos:
  $ ajusta install-skill
  $ ajusta install-skill --force
  $ ajusta install-skill --to ~/projetos/minhas-skills/ajusta-cv

Após a instalação, abra o Claude Code em qualquer diretório — a skill
será sugerida automaticamente para tarefas relacionadas a currículos.
\`ajusta doctor\` avisa quando a skill instalada ficar desatualizada.
`,
  )
  .action(async (opts) => {
    try {
      const source = locateSkillSource();
      const target = opts.to as string;

      const exists = fs.existsSync(target);
      if (exists && !opts.force) {
        throw new CliError(
          `Diretório de destino já existe: ${target}.`,
          "file_exists",
          { hint: "ajusta install-skill --force" },
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
