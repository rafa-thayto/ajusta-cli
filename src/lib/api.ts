import fs from "node:fs";
import { DEFAULT_API_URL } from "./constants.js";
import { ApiError, NetworkError } from "./errors.js";
import { resolveInput } from "./input.js";
import { log } from "./logger.js";

// ── Types ───────────────────────────────────────────────────────────

export interface CliOrderResponse {
  orderId: string;
  pixCode: string;
  pixQrCodeText: string;
  priceCents: number;
  expiresAt: string;
  paymentUrl?: string;
}

export interface CliOrderStatus {
  status:
    | "pending_payment"
    | "paid"
    | "processing"
    | "completed"
    | "failed"
    | "expired";
  processingStep?: string;
  downloadUrl?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = `${DEFAULT_API_URL}${path}`;
  log.debug(`${init?.method ?? "GET"} ${url}`);

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new NetworkError(
      `Falha de conexão com a API: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message =
      (body as { error?: string }).error || `Erro da API: ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

// ── Public API ──────────────────────────────────────────────────────

export interface SubmitCvOptions {
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  language?: string;
  jobDescription?: string;
}

export async function submitCv(
  input: string,
  opts: SubmitCvOptions = {},
): Promise<CliOrderResponse> {
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

  if (opts.name) formData.append("name", opts.name);
  if (opts.email) formData.append("email", opts.email);
  if (opts.cpf) formData.append("cpf", opts.cpf);
  if (opts.phone) formData.append("phone", opts.phone);
  if (opts.language) formData.append("language", opts.language);
  if (opts.jobDescription) formData.append("jobDescription", opts.jobDescription);

  return apiRequest<CliOrderResponse>("/cli/cv", {
    method: "POST",
    body: formData,
  });
}

export async function pollOrderStatus(
  orderId: string,
): Promise<CliOrderStatus> {
  return apiRequest<CliOrderStatus>(`/cli/cv/${orderId}/status`);
}

export async function downloadResult(
  orderId: string,
  outputPath: string,
): Promise<void> {
  const url = `${DEFAULT_API_URL}/cli/cv/${orderId}/download`;
  log.debug(`GET ${url}`);

  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new NetworkError(
      `Falha de conexão com a API: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message =
      (body as { error?: string }).error || `Erro da API: ${res.status}`;
    throw new ApiError(message, res.status);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}
