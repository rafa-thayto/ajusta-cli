# Agent Recipes

Seven copy-pasteable end-to-end flows. Each is a numbered CLI sequence with JSON parsing hints. All commands use `--json` so stdout is pure machine-readable output.

Every paid flow is the same three processes:

```sh
ajusta <cmd> ... --no-wait --json     # 1. create → { orderId, paymentUrl, brCode, expiresAt, next }
ajusta order wait <orderId> --json    # 2. block until completed (exit 3 + error.hint on failed/expired)
ajusta order download <orderId> ...   # 3. fetch the artifact
```

`order wait` is the only long-running step, and it is resumable: if it dies, run it again. Errors on stderr are `{ "error": { "message", "code", "exitCode", "hint" } }` — when `hint` is present it is the command to run next.

## Recipe 1 — User uploads an old PDF, wants it improved in English

1. Confirm the file exists and is PDF or DOCX.
2. *(Optional)* Validate a coupon: `ajusta coupon validate PROMO --product improve_curriculum --json`.
3. Create the order:
   ```sh
   ajusta improve resume.pdf --language en \
     --name "John Doe" --email "john@example.com" \
     --cpf "12345678909" --phone "11987654321" \
     --no-wait --json
   ```
4. Parse stdout → `{ orderId, paymentUrl, brCode, expiresAt }`. **Surface `paymentUrl` + `brCode` to the human.**
5. Wait: `ajusta order wait <orderId> --json` → `{ status: "completed", atsScoreOriginal, atsScoreImproved }`.
6. Download:
   ```sh
   ajusta order download <orderId> --type improved -o improved-cv.pdf --json
   ```
7. Report local path + `atsScoreOriginal` → `atsScoreImproved` delta.

## Recipe 2 — Agent builds a CV from scratch for a backend developer (pt-BR)

1. Ask the user for: name, email, CPF, phone, experiences (role/company/start/end/description), education, skills, languages, certifications, projects, target job description.
2. Assemble `resume.json` per [references/resume-schema.md](resume-schema.md).
3. Create the order:
   ```sh
   ajusta create --from resume.json --no-wait --json
   ```
4. Parse `{ orderId, paymentUrl, brCode, expiresAt }`. Surface payment.
5. Wait: `ajusta order wait <orderId> --json`. The résumé form is submitted automatically the moment payment is confirmed (it was saved to `~/.config/ajusta/pending-create-<orderId>.json` at step 3).
6. Download:
   ```sh
   ajusta order download <orderId> --type improved -o cv.pdf --json
   ```

If `order wait` answers `needs_form_fill` (the pending file is gone — another machine, wiped config), run `ajusta order fill <orderId> --from resume.json --json`, then `order wait` again.

## Recipe 3 — Check ATS compatibility for a given job (free, no payment)

1. Run:
   ```sh
   ajusta ats resume.pdf --job-file job.txt --json
   ```
2. Parse `score`, `categories.*.score`, `details.missingKeywords`, `details.issues`.
3. Present categories with weights to the user.
4. If `score < 70`, offer:
   > "Quer que eu melhore este currículo por R$7,80?" → Recipe 1.

## Recipe 4 — Professional LinkedIn photo

1. Confirm selfie path (JPG/PNG/WebP ≤10MB). Ask profession + style (`linkedin` | `corporate` | `creative` | `casual`).
2. Create:
   ```sh
   ajusta photo selfie.jpg --style linkedin \
     --profession "Engenheira de Dados" \
     --name "..." --email "..." --cpf "..." --phone "..." \
     --no-wait --json
   ```
3. Surface payment. `ajusta order wait <orderId> --json`.
4. Download:
   ```sh
   ajusta order download <orderId> --type generated-photo -o linkedin-photo.png --json
   ```
5. *(Optional)* offer regenerate with a different style (3 free):
   ```sh
   ajusta order regenerate-photo <orderId> --style corporate --profession "CTO" --json
   ajusta order download <orderId> --type generated-photo -o v2.png --force --json
   ```

## Recipe 5 — User already paid, wants to edit the improved text

1. Verify eligibility:
   ```sh
   ajusta order get <orderId> --json
   ```
   Confirm `.status === "completed"` and `.editCount < .editMaxCount`.
2. Show the current `improvedText` to the user; collect their edits into `edited.md`.
3. Submit:
   ```sh
   ajusta order edit <orderId> --text-file edited.md --yes --json
   ```
4. Re-download:
   ```sh
   ajusta order download <orderId> --type improved -o updated.pdf --force --json
   ```

## Recipe 6 — Readjust CV for a new job description

1. Verify eligibility: `ajusta order get <orderId> --json` → check `.status === "completed"` and `.readjustCount < .readjustMaxCount`.
2. Inspect price: `ajusta order readjust-info <orderId> --json` — always R$3.40.
3. Create:
   ```sh
   ajusta order readjust <orderId> --job "<new JD>" --no-wait --json
   ```
4. A NEW order is created at R$3.40 — surface new `paymentUrl`, `ajusta order wait <newOrderId> --json`, download.

## Recipe 7 — Order failed, retry and fall back to support

1. Verify: `ajusta order get <orderId> --json` → `.status === "failed"`. (An `order wait` that ended with `error.code === "order_failed"` already tells you this; its `hint` is the retry command.)
2. Retry:
   ```sh
   ajusta order retry <orderId> --follow --json
   ```
3. If the retry also fails, open a support ticket:
   ```sh
   ajusta support --name "..." --email "..." \
     --message "Pedido <orderId> falhou duas vezes" \
     --order-id <orderId> --json
   ```
4. Advise the user to check their email; support responds there.

## Recipe 8 — Something looks broken

```sh
ajusta doctor --json
```
`{ ok, checks: [{ id, status: "pass"|"warn"|"fail", message, hint? }] }` over Node version, API reachability, config dir, the installed skill (and whether it drifted from the package) and available updates. Run each `hint` that appears. Exit 1 only when a check *fails*.
