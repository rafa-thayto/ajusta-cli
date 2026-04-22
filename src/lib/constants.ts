declare const PKG_VERSION: string;

export const VERSION = typeof PKG_VERSION !== "undefined" ? PKG_VERSION : "0.0.0-dev";
export const DEFAULT_API_URL = process.env.AJUSTA_API_URL || "https://api.ajustacv.com";
export const API_KEY = process.env.AJUSTA_API_KEY || "";
export const DEFAULT_OUTPUT = "curriculo-ajustado.pdf";
export const DEFAULT_PHOTO_OUTPUT = "foto-profissional.png";
export const POLL_INTERVAL_MS = 3_000;
export const TIMEOUT_MS = 30 * 60 * 1_000;
export const MAX_RETRIES = 3;

export const SCHEMA_VERSION = "1";

export const RESUME_EXTENSIONS = [".pdf", ".docx"] as const;
export const PHOTO_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"] as const;
export const MAX_RESUME_BYTES = 4 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
export const PHOTO_WARN_BYTES = 5 * 1024 * 1024;

export const SUPPORTED_LANGUAGES = ["pt-BR", "en", "es", "fr", "de", "it"] as const;
export const PHOTO_STYLES = ["linkedin", "corporate", "creative", "casual"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export type PhotoStyle = (typeof PHOTO_STYLES)[number];

export const PRODUCTS = {
  improve_curriculum: {
    name: "Melhorar currículo",
    priceCents: 780,
    description: "Envie PDF/DOCX existente, receba versão otimizada por IA.",
  },
  create_curriculum: {
    name: "Criar currículo do zero",
    priceCents: 490,
    description: "Preencha formulário, IA gera currículo completo.",
  },
  professional_photo: {
    name: "Foto profissional",
    priceCents: 195,
    description: "Envie selfie, receba foto profissional gerada por IA.",
  },
} as const;

export type Product = keyof typeof PRODUCTS;
export const PRODUCT_KEYS = Object.keys(PRODUCTS) as readonly Product[];

export const READJUST_PRICE_CENTS = 340;
