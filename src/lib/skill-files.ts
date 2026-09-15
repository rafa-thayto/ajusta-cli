import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "./errors.js";

export const SKILL_NAME = "ajusta-cv";

export function defaultSkillTarget(): string {
  return path.join(os.homedir(), ".claude", "skills", SKILL_NAME);
}

/**
 * Find the bundled skill. Works both from the npm package (dist/ next to
 * skill/) and from a source checkout (src/lib → repo/skill).
 */
export function locateSkillSource(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(here, "../skill", SKILL_NAME),
    path.resolve(here, "../../skill", SKILL_NAME),
    path.resolve(here, "skill", SKILL_NAME),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "SKILL.md"))) return candidate;
  }
  throw new CliError(
    "Não foi possível localizar o diretório da skill no pacote instalado.",
    "file_not_found",
    { hint: "npm install -g ajusta@latest" },
  );
}

export function copyRecursive(src: string, dest: string): number {
  const stat = fs.statSync(src);
  if (!stat.isDirectory()) {
    fs.copyFileSync(src, dest);
    return 1;
  }
  fs.mkdirSync(dest, { recursive: true });
  let count = 0;
  for (const entry of fs.readdirSync(src)) {
    count += copyRecursive(path.join(src, entry), path.join(dest, entry));
  }
  return count;
}
