---
name: ajusta-cv
description: Use whenever the user wants to improve a resume, create a CV from scratch, generate a professional headshot photo, or check ATS compatibility with the ajusta-cli (npm package "ajusta", powered by AjustaCV at ajustacv.com). Triggers on "improve my resume", "improve my CV", "optimize my curriculum", "ajustar meu currículo", "melhorar currículo", "create a resume", "create a CV from scratch", "criar currículo", "gerar currículo", "generate professional headshot", "foto profissional", "ATS score", "check ATS", "análise ATS", "ajusta", "ajusta-cli", "ajustacv", "AjustaCV", "payment link for resume", "PIX para currículo", "coupon for resume", "cupom ajusta", "readjust CV", "reajustar currículo", "edit improved resume", "regenerate professional photo".
---

# ajusta-cv

`ajusta` (npm: `ajusta`) drives api.ajustacv.com: AI-optimized PDF/DOCX/LaTeX resumes and professional headshots, paid via PIX. **Agents never pay** — surface `paymentUrl` + `brCode` to the human and poll.

## Prerequisites

```sh
npm install -g ajusta       # version ≥1.9
ajusta --version
```

Always pass `--json` (auto when stdout is piped). Every success payload is wrapped `{ "_meta": { "cliVersion", "schemaVersion": "1" }, ... }`. Errors go to **stderr** as `{ "error": { "message", "code" } }` with typed exit codes (see error table).

Env: `AJUSTA_API_URL` (override), `AJUSTA_API_KEY` (optional bearer).

## Products

| Product | Command | Price | In → Out |
|---|---|---|---|
| Improve CV | `ajusta improve <file>` | R$7.80 | PDF/DOCX → improved PDF/DOCX/LaTeX |
| Create CV | `ajusta create --from resume.json` | R$4.90 | JSON form → PDF/DOCX/LaTeX |
| Pro headshot | `ajusta photo <image> --style=X` | R$1.95 | JPG/PNG/WebP → headshot PNG |
| ATS score | `ajusta ats <file>` | **Free** | PDF/DOCX/text → JSON score |

**Run `ajusta ats` first** when the user is unsure — free and instant. Scores <60 strongly warrant `improve`.

## Core pattern: order → payment → poll → download

Every paid flow follows the same shape:

1. **Create order** — run the command with `--no-download --json`. Parse stdout:
   `{ orderId, paymentUrl, brCode, expiresAt, finalPriceCents, discountCents, zeroPriceOrder }`.
2. **Surface payment to the human** — show both `paymentUrl` (browser) and `brCode` (PIX copy-paste). They have 6 minutes (`expiresAt`).
3. **Poll** every 3s: `ajusta order get <id> --json` → check `.status`. Continue until `completed | failed | expired`.
4. **Download** the artifact: `ajusta order download <id> --type improved -o cv.pdf --json`.

| Status | Meaning | Agent action |
|---|---|---|
| `pending_payment` | Awaiting PIX | Wait; re-surface payment if >2 min |
| `paid` | Confirmed, queued | Inform, keep polling |
| `processing` | AI working | Show `.processingStep` if present |
| `completed` | Done | Download |
| `failed` | Processing error | `ajusta order retry <id>` once |
| `expired` | PIX TTL elapsed | Create a new order — do NOT reuse |

**Zero-price orders** (`zeroPriceOrder: true`, 100% coupon): skip payment, poll straight to completion.

## Workflow recipes

**Improve** — see Recipe 1 in [references/agent-recipes.md](references/agent-recipes.md).

**Create from scratch** — build `resume.json` per [references/resume-schema.md](references/resume-schema.md) (minimum: `name`, `email`, `cpf`, `phone`, one `experiences[]` entry), then `ajusta create --from resume.json --no-download --json`. The fill-resume call runs automatically after payment. If the user aborts post-payment, `ajusta order fill <orderId>` resumes from a crash-safety file.

**Professional photo** — `ajusta photo selfie.jpg --style linkedin --profession "..." --name "..." --email "..." --cpf "..." --phone "..." --no-download --json`. Style is one of `linkedin | corporate | creative | casual`. Three free regenerations via `ajusta order regenerate-photo <id>`.

**ATS score** — `ajusta ats resume.pdf --job-file job.txt --json` (or inline `--job "..."` or piped stdin). Categories: keywords 30%, content 25%, structure 20%, completeness 15%, formatting 10%. Without `--job`, keywords is `null`.

**LinkedIn pre-fill** — `ajusta create --linkedin https://linkedin.com/in/... -i` hits `/linkedin/extract` (free, 5/min/IP) and passes the text to the AI — no need to structure it manually.

## Download types

```sh
ajusta order download <id> --type improved          # PDF (default for CVs)
ajusta order download <id> --type improved-docx
ajusta order download <id> --type improved-latex
ajusta order download <id> --type generated-photo   # PNG (default for photos)
ajusta order download <id> --type photo-history --index 0
```

## Post-completion ops (with limits)

| Op | Command | Max |
|---|---|---|
| Edit improved text | `ajusta order edit <id> --text-file edited.md --yes --json` | 5 |
| Readjust for new job (R$3.40) | `ajusta order readjust <id> --job "..." --no-download --json` | 10 |
| Regenerate photo | `ajusta order regenerate-photo <id> --style X --yes --json` | 3 |
| Resend delivery email | `ajusta order resend <id> --yes --json` | 2 |

Always check remaining quota via `ajusta order get <id> --json` before mutating.

## Coupons

```sh
ajusta coupon validate PROMO --product improve_curriculum --json
# → { valid, code, type, value, discountCents, finalPriceCents }
```
If `valid === true`, pass `--coupon <code>` to the order command. `finalPriceCents === 0` means no PIX — skip payment surfacing.

## Errors

| Code | Recovery |
|---|---|
| `api_error` | Surface `error.message` to user |
| `network_error` | Retry |
| `rate_limit_error` | Back off 60s, retry |
| `timeout_error` | Resume via `ajusta order get <id>` |
| `file_not_found` / `unsupported_format` / `file_too_large` / `photo_too_large` | User error — re-prompt |
| `edit_limit_reached` / `readjust_limit_reached` / `regen_limit_reached` / `resend_limit_reached` | Quota spent, no retry |
| `needs_form_fill` | `ajusta order fill <id>` |

Exit codes: 0 success · 2 usage · 3 API business error · 4 network · 5 timeout · 124 explicit timeout · 130 SIGINT.

## References

- [references/resume-schema.md](references/resume-schema.md) — JSON schema for `ajusta create --from` with a complete realistic pt-BR example.
- [references/cli-reference.md](references/cli-reference.md) — Every command, flag, and JSON output shape.
- [references/agent-recipes.md](references/agent-recipes.md) — Seven copy-pasteable end-to-end flows.
