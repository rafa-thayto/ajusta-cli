# ajusta CLI Reference

## Global flags

- `--json` — machine-readable output (auto-enabled when stdout is piped)
- `--verbose` — debug logging to stderr
- `-v, --version` — print version

## Environment variables

- `AJUSTA_API_URL` — override API base (default `https://api.ajustacv.com`)
- `AJUSTA_API_KEY` — optional Bearer token
- `AJUSTA_NO_UPDATE_CHECK=1` — skip background update check

## JSON envelope

Every `--json` success payload is wrapped:
```json
{ "_meta": { "cliVersion": "1.x.y", "schemaVersion": "1" }, ...fields }
```
Errors go to **stderr** as:
```json
{ "error": { "message": "...", "code": "..." } }
```

## Commands

### `ajusta improve <file>` — improve_curriculum (R$7.80)

```
<file>                       PDF or DOCX (max 4MB), or base64 string
-o, --output <path>          default: curriculo-ajustado.pdf
--force                      overwrite existing output
--timeout <min>              default: 30
-i, --interactive            inquirer wizard in TTY
--name --email --cpf --phone --language --job
--coupon <code>
--no-download                stop after creation, print orderId
```

**JSON on order creation:**
```json
{
  "orderId": "683abc...",
  "paymentUrl": "https://checkout.abacatepay.com/...",
  "brCode": "00020126...",
  "expiresAt": "2026-04-21T12:00:00.000Z",
  "finalPriceCents": 780,
  "discountCents": 0,
  "zeroPriceOrder": false
}
```

**JSON on completion:**
```json
{
  "orderId": "683abc...",
  "status": "completed",
  "savedTo": "/abs/path/cv.pdf",
  "bytes": 54321,
  "atsScoreOriginal": 45,
  "atsScoreImproved": 78
}
```

### `ajusta create` — create_curriculum (R$4.90)

```
-i, --interactive            full wizard
--from <spec.json>           JSON matching references/resume-schema.md
--linkedin <url>             pre-fill via /linkedin/extract
--name --email --cpf --phone --language --coupon
-o, --output <path>          default: curriculo-ajustado.pdf
--force --timeout --no-download
```

Same order-created / completion JSON shape as `improve`.

### `ajusta photo <image>` — professional_photo (R$1.95)

```
<image>                      JPG/PNG/WebP, max 10MB
--style <linkedin|corporate|creative|casual>   required (unless -i)
--profession <text>          optional
-i, --interactive
--from <spec.json>           { checkout: {...}, photo: { style, profession? } }
--name --email --cpf --phone --language --coupon
-o, --output <path>          default: foto-profissional.png
--force --timeout --no-download
```

**JSON on completion:**
```json
{
  "orderId": "...",
  "status": "completed",
  "savedTo": "/abs/path/foto.png",
  "bytes": 204800
}
```

### `ajusta ats [input]` — free ATS score

```
[input]                      file path OR inline text; omit to read stdin
--job <text>                 job description inline
--job-file <path>            job description from file
--language <pt-BR|en|es|fr|de|it>
--score-only                 print integer to stdout
```

**JSON output:**
```json
{
  "score": 74,
  "scoreInterpretation": "Bom, mas há espaço para melhorar...",
  "categories": {
    "keywords":     { "score": 68, "weight": 0.30 },
    "content":      { "score": 79, "weight": 0.25 },
    "structure":    { "score": 82, "weight": 0.20 },
    "completeness": { "score": 71, "weight": 0.15 },
    "formatting":   { "score": 90, "weight": 0.10 }
  },
  "details": {
    "matchedKeywords": ["Node.js", "TypeScript"],
    "missingKeywords": ["AWS", "Kubernetes"],
    "issues": ["..."],
    "strengths": ["..."],
    "jobTitleMatch": true,
    "foundSections": ["experience"],
    "missingSections": ["summary"],
    "actionVerbRatio": "8/12",
    "quantifiedRatio": "4/12",
    "totalBullets": 12
  }
}
```

Categories when no `--job` is given: `keywords` is `null`, weights redistribute.

### `ajusta coupon validate <code>`

```
<code>
--product <improve_curriculum|create_curriculum|professional_photo>
```

**JSON:**
```json
{
  "valid": true,
  "code": "PROMO20",
  "type": "percentage",
  "value": 20,
  "discountCents": 156,
  "finalPriceCents": 624
}
```

### `ajusta linkedin <url>`

```
<url>                        full LinkedIn profile URL
-o, --output <path>          save to file instead of stdout
```

Rate limit: 5/min/IP. Used mainly for `ajusta create --linkedin=<url>`.

### `ajusta gift validate <token>` · `ajusta gift redeem <token>`

Redeem accepts: `-i` · `--name --email --file --text --text-file --job --language -o --force --no-download --timeout`.

### `ajusta support` — open a ticket

```
-i | --name --email --message[--message-file] [--order-id]
```

### `ajusta order <verb> <id>`

| Verb | Purpose |
|---|---|
| `get [id]` | Full detail (uses last order if omitted) |
| `list-files [id]` | Available files |
| `download <id>` | `--type <original\|improved\|improved-docx\|improved-latex\|generated-photo\|photo-history>`; `--index N` required for photo-history; `-o path` |
| `retry <id>` | Requeue failed order; `--follow` to poll |
| `resend <id>` | Resend delivery email (max 2) |
| `edit <id>` | `--text | --text-file | -i` (max 5) |
| `fill <id>` | `--from <resume.json>` for unfilled create_curriculum orders |
| `readjust-info <id>` | Eligibility + price |
| `readjust <id>` | `--job | --job-file` · optional `--file` · R$3.40 · max 10 |
| `regenerate-photo <id>` | `--style --profession` · max 3 · optional `-o` |

Order mutations respect quotas and emit a `quota_exceeded` error code when exceeded.

### `ajusta status [id]` — alias for `ajusta order get [id]`

### `ajusta install-skill [--force]`

Copies the bundled skill (`skill/ajusta-cv/`) into `~/.claude/skills/ajusta-cv/`. Use `--force` to overwrite.

### `ajusta update`

Checks npm for a newer version and reinstalls globally.
