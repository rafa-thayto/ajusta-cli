declare const PKG_VERSION: string;

export const VERSION = typeof PKG_VERSION !== "undefined" ? PKG_VERSION : "0.0.0-dev";
export const DEFAULT_API_URL = process.env.AJUSTA_API_URL || "https://api.ajustacv.com";
export const DEFAULT_OUTPUT = "curriculo-ajustado.pdf";
export const POLL_INTERVAL_MS = 3_000;
export const TIMEOUT_MS = 30 * 60 * 1_000; // 30 minutes
export const MAX_RETRIES = 3;
