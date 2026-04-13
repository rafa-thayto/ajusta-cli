import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { log } from "./logger.js";

function getConfigDir(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "ajusta");
}

const LAST_ORDER_FILE = "last-order.json";

interface LastOrder {
  orderId: string;
  savedAt: string;
}

/** Persist the most recent order ID so `ajusta status` can resume. */
export function saveLastOrder(orderId: string): void {
  try {
    const dir = getConfigDir();
    fs.mkdirSync(dir, { recursive: true });

    const data: LastOrder = { orderId, savedAt: new Date().toISOString() };
    fs.writeFileSync(
      path.join(dir, LAST_ORDER_FILE),
      JSON.stringify(data, null, 2),
    );
    log.debug(`Pedido salvo em ${path.join(dir, LAST_ORDER_FILE)}`);
  } catch {
    // Best-effort — never crash the CLI for config issues
    log.debug("Não foi possível salvar o pedido no config.");
  }
}

/** Read the last saved order ID, or null if none exists. */
export function getLastOrder(): string | null {
  try {
    const filePath = path.join(getConfigDir(), LAST_ORDER_FILE);
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as LastOrder;
    return data.orderId || null;
  } catch {
    return null;
  }
}
