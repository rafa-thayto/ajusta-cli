import fs from "node:fs";
import path from "node:path";
import { lookup } from "mime-types";
import { FileError } from "./errors.js";

interface FileInput {
  type: "file";
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}

interface Base64Input {
  type: "base64";
  data: string;
}

export type ResolvedInput = FileInput | Base64Input;

/**
 * Detect whether input is a file path or base64 content, validate, and return
 * the resolved data ready for the API call.
 */
export function resolveInput(input: string): ResolvedInput {
  // Base64 heuristic: no path separators, doesn't exist on disk, long string
  if (
    !input.includes("/") &&
    !input.includes("\\") &&
    !fs.existsSync(input) &&
    input.length > 100
  ) {
    return { type: "base64", data: input };
  }

  const absolutePath = path.resolve(input);

  if (!fs.existsSync(absolutePath)) {
    throw new FileError(
      `Arquivo não encontrado: ${absolutePath}`,
      "file_not_found",
    );
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (ext !== ".pdf" && ext !== ".docx") {
    throw new FileError(
      "Formato não suportado. Use PDF ou DOCX.",
      "unsupported_format",
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
