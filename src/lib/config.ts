import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { log } from "./logger.js";
import type { Product } from "./constants.js";

function getConfigDir(): string {
  const base = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(base, "ajusta");
}

export function configDir(): string {
  return getConfigDir();
}

const LAST_ORDER_FILE = "last-order.json";

interface LastOrder {
  orderId: string;
  product?: Product;
  savedAt: string;
}

export function saveLastOrder(orderId: string, product: Product = "improve_curriculum"): void {
  try {
    const dir = getConfigDir();
    fs.mkdirSync(dir, { recursive: true });

    const data: LastOrder = { orderId, product, savedAt: new Date().toISOString() };
    fs.writeFileSync(
      path.join(dir, LAST_ORDER_FILE),
      JSON.stringify(data, null, 2),
    );
    log.debug(`Pedido salvo em ${path.join(dir, LAST_ORDER_FILE)}`);
  } catch {
    log.debug("Não foi possível salvar o pedido no config.");
  }
}

export function getLastOrder(): { orderId: string; product: Product } | null {
  try {
    const filePath = path.join(getConfigDir(), LAST_ORDER_FILE);
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as LastOrder;
    if (!data.orderId) return null;
    return {
      orderId: data.orderId,
      product: data.product ?? "improve_curriculum",
    };
  } catch {
    return null;
  }
}

export function getLastOrderId(): string | null {
  return getLastOrder()?.orderId ?? null;
}

// ── Pending create-from-scratch recovery (M7) ────────────────────────

export function savePendingCreate(orderId: string, formData: unknown): string | null {
  try {
    const dir = getConfigDir();
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, `pending-create-${orderId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(formData, null, 2));
    return filePath;
  } catch {
    return null;
  }
}

export function readPendingCreate(orderId: string): unknown | null {
  try {
    const filePath = path.join(getConfigDir(), `pending-create-${orderId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

export function clearPendingCreate(orderId: string): void {
  try {
    const filePath = path.join(getConfigDir(), `pending-create-${orderId}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // best-effort
  }
}
