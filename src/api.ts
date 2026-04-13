import fs from "node:fs";
import path from "node:path";
import { lookup } from "mime-types";

const API_URL = "https://api.ajustacv.com";

export interface CliOrderResponse {
  orderId: string;
  pixCode: string;
  pixQrCodeText: string;
  priceCents: number;
  expiresAt: string;
}

export interface CliOrderStatus {
  status: "pending_payment" | "paid" | "processing" | "completed" | "failed" | "expired";
  processingStep?: string;
  downloadUrl?: string;
}

function resolveInput(input: string): { type: "file"; buffer: Buffer; fileName: string; mimeType: string } | { type: "base64"; data: string } {
  // Check if it looks like base64 (no path separators, long string)
  if (!input.includes("/") && !input.includes("\\") && !fs.existsSync(input) && input.length > 100) {
    return { type: "base64", data: input };
  }

  const absolutePath = path.resolve(input);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Arquivo não encontrado: ${absolutePath}`);
  }

  const ext = path.extname(absolutePath).toLowerCase();
  if (ext !== ".pdf" && ext !== ".docx") {
    throw new Error("Formato não suportado. Use PDF ou DOCX.");
  }

  return {
    type: "file",
    buffer: fs.readFileSync(absolutePath),
    fileName: path.basename(absolutePath),
    mimeType: lookup(ext) || "application/octet-stream",
  };
}

export async function submitCv(input: string): Promise<CliOrderResponse> {
  const resolved = resolveInput(input);

  const formData = new FormData();

  if (resolved.type === "file") {
    formData.append(
      "resumeFile",
      new Blob([resolved.buffer], { type: resolved.mimeType }),
      resolved.fileName,
    );
  } else {
    formData.append("resumeBase64", resolved.data);
  }

  formData.append("source", "cli");

  const res = await fetch(`${API_URL}/cli/cv`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error || `Erro da API: ${res.status}`);
  }

  return res.json() as Promise<CliOrderResponse>;
}

export async function pollOrderStatus(orderId: string): Promise<CliOrderStatus> {
  const res = await fetch(`${API_URL}/cli/cv/${orderId}/status`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error || `Erro da API: ${res.status}`);
  }

  return res.json() as Promise<CliOrderStatus>;
}

export async function downloadResult(orderId: string, outputPath: string): Promise<void> {
  const res = await fetch(`${API_URL}/cli/cv/${orderId}/download`);

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error || `Erro da API: ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}
