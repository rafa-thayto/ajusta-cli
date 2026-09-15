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

Always pass `--json` (auto when stdout is piped). Every success payload is wrapped `{ "_meta": { "cliVersion", "schemaVersion": "1" }, ... }`. Errors go to **stderr** as `{ "error": { "message", "code", "exitCode", "hint"? } }` with typed exit codes (see error table). **When `hint` is present, it is the command to run next.** If anything looks off, `ajusta doctor --json` diagnoses Node, API, config and this skill's installation.

Env: `AJUSTA_API_URL` (override), `AJUSTA_API_KEY` (optional bearer).

## Products

| Product | Command | Price | In → Out |
|---|---|---|---|
| Improve CV | `ajusta improve <file>` | R$7.80 | PDF/DOCX → improved PDF/DOCX/LaTeX |
| Create CV | `ajusta create --from resume.json` | R$4.90 | JSON form → PDF/DOCX/LaTeX |
| Pro headshot | `ajusta photo <image> --style=X` | R$1.95 | JPG/PNG/WebP → headshot PNG |
| ATS score | `ajusta ats <file>` | **Free** | PDF/DOCX/text → JSON score |

**Run `ajusta ats` first** when the user is unsure — free and instant. Scores <60 strongly warrant `improve`.

## Core pattern: create → wait → download

Every paid flow is the same three processes:

1. **Create order** — run the command with `--no-wait --json`. It exits immediately; parse stdout:
   `{ orderId, paymentUrl, brCode, expiresAt, finalPriceCents, discountCents, zeroPriceOrder, next }`.
   (Without `--no-wait` the command blocks up to 30 minutes doing steps 3–4 itself — that is the human mode. `--no-wait` implies `--no-download`.)
2. **Surface payment to the human** — show both `paymentUrl` (browser) and `brCode` (PIX copy-paste). They have 6 minutes (`expiresAt`).
3. **Wait** — `ajusta order wait <id> --json` blocks through payment and processing and prints `{ status: "completed", atsScoreOriginal, atsScoreImproved, next }`. Exit 3 with `error.code` `order_failed` or `order_expired` otherwise; follow `error.hint`. Safe to re-run if interrupted. Add `--stream` for one NDJSON line per status change (implies `--json`).
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

**Create from scratch** — build `resume.json` per [references/resume-schema.md](references/resume-schema.md) (minimum: `name`, `email`, `cpf`, `phone`, one `experiences[]` entry), then `ajusta create --from resume.json --no-wait --json`. `ajusta order wait <orderId>` submits the résumé form automatically once payment is confirmed (it was saved to `~/.config/ajusta/`). If that file is gone, `order wait` answers `needs_form_fill` and its hint is `ajusta order fill <orderId> --from resume.json`.

**Professional photo** — `ajusta photo selfie.jpg --style linkedin --profession "..." --name "..." --email "..." --cpf "..." --phone "..." --no-wait --json`. Style is one of `linkedin | corporate | creative | casual`. Three free regenerations via `ajusta order regenerate-photo <id>`.

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
| Readjust for new job (R$3.40) | `ajusta order readjust <id> --job "..." --no-wait --json` | 10 |
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
| any | If `error.hint` is present, run it |
| `api_error` | Surface `error.message` to user |
| `order_failed` | `ajusta order retry <id> --follow` (the hint) |
| `order_expired` | Create a new order — do NOT reuse |
| `network_error` | Retry (the CLI already retried 3× with backoff) |
| `rate_limit_error` | Wait `retryAfterMs` (or 60s), retry |
| `timeout_error` | `ajusta order wait <id>` again |
| `file_exists` | Pass `--force` or another `-o` |
| `doctor_failed` | `ajusta doctor --json` had a `fail` check — run its `hint` |
| `file_not_found` / `unsupported_format` / `file_too_large` / `photo_too_large` | User error — re-prompt |
| `edit_limit_reached` / `readjust_limit_reached` / `regen_limit_reached` / `resend_limit_reached` | Quota spent, no retry |
| `needs_form_fill` | `ajusta order fill <id>` |

Exit codes: 0 success · 2 usage · 3 API business error · 4 network · 5 timeout · 124 explicit timeout · 130 SIGINT.

## References

- [references/resume-schema.md](references/resume-schema.md) — JSON schema for `ajusta create --from` with a complete realistic pt-BR example.
- [references/cli-reference.md](references/cli-reference.md) — Every command, flag, and JSON output shape.
- [references/agent-recipes.md](references/agent-recipes.md) — Eight copy-pasteable end-to-end flows.
