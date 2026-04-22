import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { rawRequest } from "./api.js";
import { FileError } from "./errors.js";

export type FileType =
  | "original"
  | "improved"
  | "improved-docx"
  | "improved-latex"
  | "generated-photo"
  | "photo-history";

export interface DownloadResult {
  savedTo: string;
  bytes: number;
}

/** Stream a file from `GET /orders/:id/file/<type>` (or `/photo-history/:index`) to disk. */
export async function downloadOrderFile(
  orderId: string,
  type: FileType,
  outputPath: string,
  index?: number,
): Promise<DownloadResult> {
  const absPath = path.resolve(outputPath);
  const dir = path.dirname(absPath);
  if (!fs.existsSync(dir)) {
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch {
      throw new FileError(
        `Não foi possível criar o diretório: ${dir}`,
        "file_write_error",
      );
    }
  }

  const suffix =
    type === "photo-history"
      ? `/photo-history/${index ?? 0}`
      : `/${type}`;

  const res = await rawRequest(
    `/orders/${encodeURIComponent(orderId)}/file${suffix}`,
  );

  if (!res.body) {
    throw new FileError(
      "Resposta da API sem conteúdo para download.",
      "file_write_error",
    );
  }

  const writable = fs.createWriteStream(absPath);
  // @ts-expect-error — Node's Response.body is web ReadableStream; Readable.fromWeb handles it
  await pipeline(Readable.fromWeb(res.body), writable);

  const stats = fs.statSync(absPath);
  return { savedTo: absPath, bytes: stats.size };
}
