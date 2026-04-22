import { API_KEY, DEFAULT_API_URL, type Product, type SupportedLanguage, type PhotoStyle } from "./constants.js";
import { ApiError, NetworkError, RateLimitError } from "./errors.js";
import { resolveInput, type ResolvedInput, type ResolvedPhoto } from "./input.js";
import { log } from "./logger.js";
import { maskCpf, maskEmail, maskPhone } from "./security.js";

// ── Types ───────────────────────────────────────────────────────────

export type OrderStatus =
  | "pending_payment"
  | "paid"
  | "processing"
  | "completed"
  | "failed"
  | "expired";

export interface OrderCreatedResponse {
  orderId: string;
  paymentUrl?: string;
  brCode?: string;
  brCodeBase64?: string;
  expiresAt?: string;
  finalPriceCents: number;
  discountCents?: number;
  devMode?: boolean;
  zeroPriceOrder?: boolean;
}

export interface OrderDetailResponse {
  id: string;
  name?: string;
  email?: string;
  status: OrderStatus;
  paymentUrl?: string;
  expiresAt?: string;
  isGift?: boolean;
  giftToken?: string | null;
  parentOrderId?: string | null;
  readjustCount?: number;
  readjustMaxCount?: number;
  product: Product;
  processingStep?: string | null;
  resumeText?: string;
  improvedText?: string;
  hasOriginalFile?: boolean;
  hasImprovedPdf?: boolean;
  hasImprovedDocx?: boolean;
  hasImprovedLatex?: boolean;
  hasGeneratedPhoto?: boolean;
  photoHistory?: Array<{ createdAt: string }>;
  photoRegenerateCount?: number;
  photoRegenerateMaxCount?: number;
  editCount?: number;
  editMaxCount?: number;
  emailResendCount?: number;
  emailResendMaxCount?: number;
  atsScoreOriginal?: number;
  atsScoreImproved?: number;
  atsDetails?: unknown;
  needsFormFill?: boolean;
}

export interface PaymentStatusResponse {
  status: OrderStatus;
}

export interface ReadjustInfoResponse {
  parentOrderId: string;
  name: string;
  email: string;
  cpf: string;
  phone: string;
  language: SupportedLanguage;
  hasResumeFile: boolean;
  hasResumeText: boolean;
  readjustCount: number;
  readjustMaxCount: number;
  readjustPriceCents: number;
}

export interface CouponValidateResponse {
  valid: boolean;
  code?: string;
  type?: "percentage" | "fixed";
  value?: number;
  discountCents?: number;
  finalPriceCents?: number;
  error?: string;
}

export interface AtsCategoryScore {
  score: number | null;
  weight: number;
}

export interface AtsAnalysisResult {
  score: number;
  scoreInterpretation?: string;
  categories: {
    keywords: AtsCategoryScore | null;
    structure: AtsCategoryScore;
    content: AtsCategoryScore;
    completeness: AtsCategoryScore;
    formatting: AtsCategoryScore;
  };
  details: {
    matchedKeywords?: string[];
    missingKeywords?: string[];
    keywordFrequency?: Array<{ keyword: string; count: number }>;
    jobTitleMatch?: boolean;
    foundSections?: string[];
    missingSections?: string[];
    actionVerbRatio?: string;
    quantifiedRatio?: string;
    totalBullets?: number;
    issues?: string[];
    strengths?: string[];
  };
}

export interface EditResumeResponse {
  success: boolean;
  editCount: number;
  atsScoreImproved?: number;
  atsDetails?: unknown;
}

export interface RegeneratePhotoResponse {
  success: boolean;
  photoRegenerateCount: number;
  generatedPhotoUrl?: string;
}

export interface GiftValidateResponse {
  orderId: string;
  buyerName?: string;
  language?: SupportedLanguage;
  valid: boolean;
  redeemed?: boolean;
  error?: string;
}

export interface LinkedInExtractResponse {
  profileText?: string;
  text?: string;
  name?: string;
  headline?: string;
  error?: string;
}

export interface SupportTicketBody {
  name: string;
  email: string;
  message: string;
  orderId?: string;
}

// ── Core HTTP helper ────────────────────────────────────────────────

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${DEFAULT_API_URL}${path}`;
  log.debug(`${init?.method ?? "GET"} ${url}`);

  const headers = new Headers(init?.headers);
  if (API_KEY && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${API_KEY}`);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (err) {
    throw new NetworkError(
      `Falha de conexão com a API: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;
      const body = await res.json().catch(() => ({}));
      const message =
        (body as { error?: string }).error || "Limite de requisições excedido.";
      throw new RateLimitError(message, retryAfterMs);
    }
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const message =
      (body as { error?: string }).error || `Erro da API: ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return res.json() as Promise<T>;
}

/** Returns a raw Response for streaming (file downloads). */
export async function rawRequest(path: string, init?: RequestInit): Promise<Response> {
  const url = `${DEFAULT_API_URL}${path}`;
  log.debug(`${init?.method ?? "GET"} ${url}`);

  const headers = new Headers(init?.headers);
  if (API_KEY && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${API_KEY}`);
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
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

  return res;
}

// ── Orders — creation and mutation ──────────────────────────────────

export interface SubmitOrderOptions {
  product: Product;
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  language?: SupportedLanguage | string;
  jobDescription?: string;
  couponCode?: string;
  parentOrderId?: string;
  isGift?: boolean;
  source?: string;
  /** For improve_curriculum */
  resume?: ResolvedInput;
  resumeText?: string;
  /** For professional_photo */
  photo?: ResolvedPhoto;
  photoStyle?: PhotoStyle | string;
  photoProfession?: string;
}

export async function submitOrder(
  opts: SubmitOrderOptions,
): Promise<OrderCreatedResponse> {
  const form = new FormData();
  form.append("product", opts.product);
  form.append("source", opts.source ?? "cli");

  if (opts.name) form.append("name", opts.name);
  if (opts.email) form.append("email", opts.email);
  if (opts.cpf) form.append("cpf", opts.cpf);
  if (opts.phone) form.append("phone", opts.phone);
  if (opts.language) form.append("language", opts.language);
  if (opts.jobDescription) form.append("jobDescription", opts.jobDescription);
  if (opts.couponCode) form.append("couponCode", opts.couponCode);
  if (opts.parentOrderId) form.append("parentOrderId", opts.parentOrderId);
  if (opts.isGift) form.append("isGift", "true");

  if (opts.resume) {
    form.append(
      "resumeFile",
      new Blob([new Uint8Array(opts.resume.buffer)], { type: opts.resume.mimeType }),
      opts.resume.fileName,
    );
  } else if (opts.resumeText) {
    form.append("resumeText", opts.resumeText);
  }

  if (opts.photo) {
    form.append(
      "photoFile",
      new Blob([new Uint8Array(opts.photo.buffer)], { type: opts.photo.mimeType }),
      opts.photo.fileName,
    );
  }
  if (opts.photoStyle) form.append("photoStyle", opts.photoStyle);
  if (opts.photoProfession) form.append("photoProfession", opts.photoProfession);

  log.debug(
    `submitOrder product=${opts.product} name=${opts.name ?? "-"} email=${maskEmail(opts.email)} cpf=${maskCpf(opts.cpf)} phone=${maskPhone(opts.phone)}`,
  );

  return apiRequest<OrderCreatedResponse>("/orders", {
    method: "POST",
    body: form,
  });
}

export function getOrder(id: string): Promise<OrderDetailResponse> {
  return apiRequest<OrderDetailResponse>(`/orders/${encodeURIComponent(id)}`);
}

export function getOrderPaymentStatus(id: string): Promise<PaymentStatusResponse> {
  return apiRequest<PaymentStatusResponse>(
    `/orders/${encodeURIComponent(id)}/payment-status`,
  );
}

export function getReadjustInfo(id: string): Promise<ReadjustInfoResponse> {
  return apiRequest<ReadjustInfoResponse>(
    `/orders/${encodeURIComponent(id)}/readjust-info`,
  );
}

export function retryOrder(id: string): Promise<{ status: OrderStatus }> {
  return apiRequest<{ status: OrderStatus }>(
    `/orders/${encodeURIComponent(id)}/retry`,
    { method: "POST" },
  );
}

export function resendOrderEmail(
  id: string,
): Promise<{ success: boolean; emailResendCount: number }> {
  return apiRequest<{ success: boolean; emailResendCount: number }>(
    `/orders/${encodeURIComponent(id)}/resend-email`,
    { method: "POST" },
  );
}

export function editResume(
  id: string,
  improvedText: string,
): Promise<EditResumeResponse> {
  return apiRequest<EditResumeResponse>(
    `/orders/${encodeURIComponent(id)}/edit-resume`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ improvedText }),
    },
  );
}

export interface FillResumeBody {
  experiences?: unknown[];
  education?: unknown[];
  skills?: unknown[];
  languages?: unknown[];
  certifications?: unknown[];
  projects?: unknown[];
  jobDescription?: string;
  linkedinUrl?: string;
  summary?: string;
  [key: string]: unknown;
}

export function fillResume(
  id: string,
  data: FillResumeBody,
): Promise<{ success: boolean; orderId: string }> {
  return apiRequest<{ success: boolean; orderId: string }>(
    `/orders/${encodeURIComponent(id)}/fill-resume`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}

export function regeneratePhoto(
  id: string,
  opts: { photoStyle?: string; photoProfession?: string } = {},
): Promise<RegeneratePhotoResponse> {
  return apiRequest<RegeneratePhotoResponse>(
    `/orders/${encodeURIComponent(id)}/regenerate-photo`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    },
  );
}

export function validateGift(token: string): Promise<GiftValidateResponse> {
  return apiRequest<GiftValidateResponse>(
    `/orders/gift/${encodeURIComponent(token)}`,
  );
}

export interface RedeemGiftBody {
  name: string;
  email: string;
  language?: string;
  jobDescription?: string;
  resume?: ResolvedInput;
  resumeText?: string;
}

export async function redeemGift(
  token: string,
  body: RedeemGiftBody,
): Promise<{ orderId: string }> {
  const form = new FormData();
  form.append("name", body.name);
  form.append("email", body.email);
  if (body.language) form.append("language", body.language);
  if (body.jobDescription) form.append("jobDescription", body.jobDescription);
  if (body.resume) {
    form.append(
      "resumeFile",
      new Blob([new Uint8Array(body.resume.buffer)], { type: body.resume.mimeType }),
      body.resume.fileName,
    );
  } else if (body.resumeText) {
    form.append("resumeText", body.resumeText);
  }
  return apiRequest<{ orderId: string }>(
    `/orders/gift/${encodeURIComponent(token)}/redeem`,
    { method: "POST", body: form },
  );
}

// ── ATS ─────────────────────────────────────────────────────────────

export interface AtsOptions {
  resume?: ResolvedInput;
  resumeText?: string;
  jobDescription?: string;
  language?: SupportedLanguage | string;
}

export async function analyzeAts(opts: AtsOptions): Promise<AtsAnalysisResult> {
  if (opts.resume) {
    const form = new FormData();
    form.append(
      "resumeFile",
      new Blob([new Uint8Array(opts.resume.buffer)], { type: opts.resume.mimeType }),
      opts.resume.fileName,
    );
    if (opts.jobDescription) form.append("jobDescription", opts.jobDescription);
    if (opts.language) form.append("language", opts.language);
    return apiRequest<AtsAnalysisResult>("/ats-analysis", {
      method: "POST",
      body: form,
    });
  }

  return apiRequest<AtsAnalysisResult>("/ats-analysis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resumeText: opts.resumeText,
      jobDescription: opts.jobDescription,
      language: opts.language,
    }),
  });
}

// ── Coupons, LinkedIn, Support ─────────────────────────────────────

export function validateCoupon(
  code: string,
  product?: Product | string,
): Promise<CouponValidateResponse> {
  const params = new URLSearchParams({ code });
  if (product) params.set("product", product);
  return apiRequest<CouponValidateResponse>(
    `/coupons/validate?${params.toString()}`,
  );
}

export function extractLinkedIn(url: string): Promise<LinkedInExtractResponse> {
  return apiRequest<LinkedInExtractResponse>("/linkedin/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
}

export function createSupportTicket(
  body: SupportTicketBody,
): Promise<{ success: boolean }> {
  return apiRequest<{ success: boolean }>("/support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Re-exports needed by existing callers during transition ─────────

export { resolveInput } from "./input.js";
