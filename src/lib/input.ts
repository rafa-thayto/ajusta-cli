import fs from "node:fs";
import path from "node:path";
import { lookup } from "mime-types";
import { FileError } from "./errors.js";
import {
  MAX_PHOTO_BYTES,
  MAX_RESUME_BYTES,
  PHOTO_EXTENSIONS,
  PHOTO_WARN_BYTES,
  RESUME_EXTENSIONS,
} from "./constants.js";

interface FileInput {
  type: "file";
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

interface Base64Input {
  type: "base64";
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

export type ResolvedInput = FileInput | Base64Input;

export interface ResolvedPhoto {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  warn?: string;
}

/** Detect whether input is a file path or base64 string; validate and return the buffer. */
export function resolveInput(input: string): ResolvedInput {
  if (!input || !input.trim()) {
    throw new FileError(
      "Nenhum arquivo informado. Informe o caminho para um PDF ou DOCX.\n\n  Exemplo: ajusta improve meu-curriculo.pdf",
      "file_not_found",
    );
  }

  // Base64 heuristic: no path separators, doesn't exist on disk, long string
  if (
    !input.includes("/") &&
    !input.includes("\\") &&
    !fs.existsSync(input) &&
    input.length > 100
  ) {
    let buffer: Buffer;
    try {
      buffer = Buffer.from(input, "base64");
    } catch {
      throw new FileError("Conteúdo base64 inválido.", "file_read_error");
    }
    if (buffer.length > MAX_RESUME_BYTES) {
      throw new FileError(
        `Arquivo grande demais (${Math.round(buffer.length / 1024 / 1024)}MB). Limite: 4MB.`,
        "file_too_large",
      );
    }
    return {
      type: "base64",
      buffer,
      fileName: "resume.pdf",
      mimeType: "application/pdf",
    };
  }

  const absolutePath = path.resolve(input);

  if (!fs.existsSync(absolutePath)) {
    throw new FileError(
      `Arquivo não encontrado: ${absolutePath}\n\n  Verifique se o caminho está correto e tente novamente.`,
      "file_not_found",
    );
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (!RESUME_EXTENSIONS.includes(ext as (typeof RESUME_EXTENSIONS)[number])) {
    throw new FileError(
      `Formato "${ext || "desconhecido"}" não suportado.\n\n  Formatos aceitos: PDF, DOCX\n  Exemplo: ajusta improve meu-curriculo.pdf`,
      "unsupported_format",
    );
  }

  const stats = fs.statSync(absolutePath);
  if (stats.size > MAX_RESUME_BYTES) {
    throw new FileError(
      `Arquivo grande demais (${Math.round(stats.size / 1024 / 1024)}MB). Limite: 4MB.`,
      "file_too_large",
    );
  }

  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(absolutePath);
  } catch {
    throw new FileError(
      `Não foi possível ler o arquivo: ${absolutePath}`,
      "file_read_error",
    );
  }

  return {
    type: "file",
    buffer,
    fileName: path.basename(absolutePath),
    mimeType: lookup(ext) || "application/octet-stream",
  };
}

/** Resolve + validate a photo file (JPG/PNG/WebP, ≤10MB). */
export function resolvePhotoInput(input: string): ResolvedPhoto {
  if (!input || !input.trim()) {
    throw new FileError(
      "Nenhuma foto informada. Informe o caminho para JPG, PNG ou WebP.",
      "file_not_found",
    );
  }

  const absolutePath = path.resolve(input);
  if (!fs.existsSync(absolutePath)) {
    throw new FileError(
      `Arquivo não encontrado: ${absolutePath}`,
      "file_not_found",
    );
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (!PHOTO_EXTENSIONS.includes(ext as (typeof PHOTO_EXTENSIONS)[number])) {
    throw new FileError(
      `Formato "${ext || "desconhecido"}" não aceito para fotos.\n\n  Formatos aceitos: JPG, JPEG, PNG, WebP`,
      "unsupported_photo_format",
    );
  }

  const stats = fs.statSync(absolutePath);
  if (stats.size > MAX_PHOTO_BYTES) {
    throw new FileError(
      `Foto grande demais (${(stats.size / 1024 / 1024).toFixed(1)}MB). Limite: 10MB.`,
      "photo_too_large",
    );
  }

  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(absolutePath);
  } catch {
    throw new FileError(
      `Não foi possível ler o arquivo: ${absolutePath}`,
      "file_read_error",
    );
  }

  const warn =
    stats.size > PHOTO_WARN_BYTES
      ? `Foto grande (${(stats.size / 1024 / 1024).toFixed(1)}MB). O upload pode demorar.`
      : undefined;

  return {
    buffer,
    fileName: path.basename(absolutePath),
    mimeType: lookup(ext) || "image/jpeg",
    warn,
  };
}

/** If the string resolves to an existing small file, read it; otherwise treat as inline. */
export function resolveTextInput(pathOrInline: string, maxBytes = 1_000_000): string {
  if (!pathOrInline) return "";
  const trimmed = pathOrInline.trim();
  if (!trimmed) return "";

  if (trimmed.length < 1024 && (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("."))) {
    const abs = path.resolve(trimmed);
    if (fs.existsSync(abs)) {
      const stats = fs.statSync(abs);
      if (stats.size > maxBytes) {
        throw new FileError(
          `Texto muito longo (${Math.round(stats.size / 1024)}KB). Limite: ${Math.round(maxBytes / 1024)}KB.`,
          "file_too_large",
        );
      }
      return fs.readFileSync(abs, "utf-8");
    }
  }
  return pathOrInline;
}
