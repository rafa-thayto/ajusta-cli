import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { VERSION, DEFAULT_API_URL } from "./constants.js";
import { configDir } from "./config.js";
import { getHealth } from "./api.js";
import { fetchLatestVersion, isNewer } from "./update.js";
import { locateSkillSource, defaultSkillTarget } from "./skill-files.js";

export type CheckStatus = "pass" | "warn" | "fail";

export interface DoctorCheck {
  id: string;
  status: CheckStatus;
  message: string;
  /** The command that fixes it, when there is one. */
  hint?: string;
}

export interface DoctorReport {
  ok: boolean;
  cliVersion: string;
  checks: DoctorCheck[];
}

const MIN_NODE_MAJOR = 18;

export function checkNodeVersion(version: string = process.versions.node): DoctorCheck {
  const major = parseInt(version.split(".")[0] ?? "0", 10);
  if (major >= MIN_NODE_MAJOR) {
    return { id: "node", status: "pass", message: `Node.js ${version}` };
  }
  return {
    id: "node",
    status: "fail",
    message: `Node.js ${version} — o ajusta requer ${MIN_NODE_MAJOR}+.`,
    hint: "Atualize o Node.js em https://nodejs.org",
  };
}

export async function checkApi(
  probe: () => Promise<{ status: string }> = () => getHealth(),
  apiUrl: string = DEFAULT_API_URL,
): Promise<DoctorCheck> {
  try {
    const health = await probe();
    if (health.status === "ok") {
      return { id: "api", status: "pass", message: `API alcançável em ${apiUrl}` };
    }
    return { id: "api", status: "warn", message: `API respondeu status "${health.status}" em ${apiUrl}` };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    return {
      id: "api",
      status: "fail",
      message: `API inacessível em ${apiUrl}: ${reason}`,
      hint: process.env.AJUSTA_API_URL
        ? "Confira AJUSTA_API_URL ou remova a variável para usar a API padrão."
        : "Verifique sua conexão e tente novamente.",
    };
  }
}

export function checkConfigDir(dir: string = configDir()): DoctorCheck {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return { id: "config", status: "pass", message: `Config gravável em ${dir}` };
  } catch {
    return {
      id: "config",
      status: "warn",
      message: `Não foi possível gravar em ${dir}; o último pedido e a recuperação de \`create\` não serão salvos.`,
      hint: "Defina XDG_CONFIG_HOME para um diretório gravável.",
    };
  }
}

/** Compare every file of the bundled skill with the installed copy. */
export function skillDrift(source: string, target: string): string[] {
  const drifted: string[] = [];
  const walk = (rel: string) => {
    for (const entry of fs.readdirSync(path.join(source, rel))) {
      const relPath = path.join(rel, entry);
      const src = path.join(source, relPath);
      if (fs.statSync(src).isDirectory()) {
        walk(relPath);
        continue;
      }
      const dst = path.join(target, relPath);
      if (!fs.existsSync(dst) || !fs.readFileSync(src).equals(fs.readFileSync(dst))) {
        drifted.push(relPath);
      }
    }
  };
  walk("");
  return drifted;
}

export function checkSkill(
  target: string = defaultSkillTarget(),
  source: string | null = safeLocateSkillSource(),
): DoctorCheck {
  const home = os.homedir();
  const shown = target.startsWith(home) ? `~${target.slice(home.length)}` : target;
  if (!fs.existsSync(path.join(target, "SKILL.md"))) {
    return {
      id: "skill",
      status: "warn",
      message: `Skill do Claude Code não instalada em ${shown}.`,
      hint: "ajusta install-skill",
    };
  }
  if (!source) {
    return { id: "skill", status: "pass", message: `Skill instalada em ${shown}` };
  }
  const drifted = skillDrift(source, target);
  if (drifted.length === 0) {
    return { id: "skill", status: "pass", message: `Skill instalada e atualizada em ${shown}` };
  }
  return {
    id: "skill",
    status: "warn",
    message: `Skill instalada em ${shown} está desatualizada (${drifted.length} arquivo(s) diferem do pacote).`,
    hint: "ajusta install-skill --force",
  };
}

function safeLocateSkillSource(): string | null {
  try {
    return locateSkillSource();
  } catch {
    return null;
  }
}

export async function checkUpdate(
  fetchLatest: () => Promise<string | null> = fetchLatestVersion,
  current: string = VERSION,
): Promise<DoctorCheck> {
  const latest = await fetchLatest();
  if (!latest) {
    return { id: "update", status: "warn", message: "Não foi possível consultar o npm para verificar atualizações." };
  }
  if (isNewer(current, latest)) {
    return {
      id: "update",
      status: "warn",
      message: `Versão ${current} instalada; ${latest} disponível.`,
      hint: "ajusta update",
    };
  }
  return { id: "update", status: "pass", message: `ajusta ${current} é a versão mais recente` };
}

export async function runDoctor(): Promise<DoctorReport> {
  const [api, update] = await Promise.all([checkApi(), checkUpdate()]);
  const checks = [checkNodeVersion(), api, checkConfigDir(), checkSkill(), update];
  return {
    ok: checks.every((c) => c.status !== "fail"),
    cliVersion: VERSION,
    checks,
  };
}
