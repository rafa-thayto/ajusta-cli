import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import chalk from "chalk";
import { VERSION } from "./constants.js";
import { isTTY } from "./tty.js";
import { log } from "./logger.js";

// ── Config ──────────────────────────────────────────────────────────

const NPM_REGISTRY_URL = "https://registry.npmjs.org/ajusta/latest";
const CHECK_INTERVAL_MS = 60 * 60 * 1_000; // 1 hour
const FETCH_TIMEOUT_MS = 5_000;

function getConfigDir(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "ajusta");
}

const UPDATE_STATE_FILE = "update-state.json";

interface UpdateState {
  lastChecked: number;
  latestVersion: string;
}

// ── Semver comparison ───────────────────────────────────────────────

export function isNewer(local: string, remote: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [lMaj, lMin, lPat] = parse(local);
  const [rMaj, rMin, rPat] = parse(remote);
  if (rMaj !== lMaj) return rMaj > lMaj;
  if (rMin !== lMin) return rMin > lMin;
  return rPat > lPat;
}

// ── Cache ───────────────────────────────────────────────────────────

function readState(): UpdateState | null {
  try {
    const filePath = path.join(getConfigDir(), UPDATE_STATE_FILE);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as UpdateState;
  } catch {
    return null;
  }
}

function writeState(state: UpdateState): void {
  try {
    const dir = getConfigDir();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      path.join(dir, UPDATE_STATE_FILE),
      JSON.stringify(state),
      { mode: 0o600 },
    );
  } catch {
    // best-effort
  }
}

// ── Fetch ───────────────────────────────────────────────────────────

export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(NPM_REGISTRY_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { version?: string };
    const version = data.version;
    if (!version || !/^\d+\.\d+\.\d+$/.test(version)) return null;
    return version;
  } catch {
    return null;
  }
}

// ── Should skip ─────────────────────────────────────────────────────

function shouldSkipCheck(): boolean {
  if (process.env.AJUSTA_NO_UPDATE_CHECK === "1") return true;
  if (process.env.CI === "true" || process.env.CI === "1") return true;
  if (process.env.GITHUB_ACTIONS) return true;
  if (!isTTY()) return true;
  return false;
}

// ── Notification ────────────────────────────────────────────────────

function formatNotice(current: string, latest: string): string {
  return (
    `\n  ${chalk.dim("Atualização disponível:")} ` +
    `${chalk.yellow(current)} ${chalk.dim("\u2192")} ${chalk.cyan(latest)}\n` +
    `  ${chalk.dim("Execute:")} ${chalk.cyan("npm install -g ajusta")}\n`
  );
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Background update check — runs after command execution.
 * Uses 1-hour cache. Never blocks the user.
 */
export async function checkForUpdates(): Promise<void> {
  if (shouldSkipCheck()) return;

  const state = readState();
  let latestVersion: string | null = null;

  if (state && Date.now() - state.lastChecked < CHECK_INTERVAL_MS) {
    latestVersion = state.latestVersion;
  } else {
    latestVersion = await fetchLatestVersion();
    if (latestVersion) {
      writeState({ lastChecked: Date.now(), latestVersion });
    }
  }

  if (latestVersion && isNewer(VERSION, latestVersion)) {
    process.stderr.write(formatNotice(VERSION, latestVersion));
  }
}

/**
 * Explicit update check — always fetches fresh, returns structured result.
 */
export async function checkForUpdatesExplicit(): Promise<{
  current: string;
  latest: string | null;
  updateAvailable: boolean;
}> {
  const latest = await fetchLatestVersion();
  const updateAvailable = !!latest && isNewer(VERSION, latest);

  if (latest) {
    writeState({ lastChecked: Date.now(), latestVersion: latest });
  }

  return { current: VERSION, latest, updateAvailable };
}
