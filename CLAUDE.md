# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

`ajusta` is the npm CLI for AjustaCV (api.ajustacv.com): ATS scoring, résumé
optimisation, résumé creation and AI headshots, paid via PIX from the terminal.
It is written for two audiences at once — a person in a TTY and an agent in a
pipe — and every command must serve both. The bundled skill in
`skill/ajusta-cv/` is what teaches Claude Code to drive it.

## Commands

```sh
npm install          # deps
npm run dev          # tsup --watch
npm run build        # dist/index.js (single ESM bundle, node18 target)
npm test             # node:test via tsx, test/**/*.test.ts
npm run typecheck    # tsc --noEmit
./scripts/release.sh [patch|minor|major]   # bump, build, publish, tag, GitHub release
```

Smoke-test a build with `node dist/index.js <command>`; `AJUSTA_API_URL` points
it at another API. Never create real orders while testing — `ajusta ats`,
`ajusta doctor`, `coupon validate` and any usage error are safe.

## Layout

- `src/index.ts` — the Commander program, global `--json`/`--verbose`, exit
  handlers. Every command is added here.
- `src/commands/` — one file per command, `order/` for the `order <verb>` group.
  A command parses options, calls `lib/`, and prints through `outputResult`
  or `outputError`; nothing else.
- `src/lib/api.ts` — the only `fetch`. `rawRequest` maps every non-OK status
  to a typed error (429 → `RateLimitError` with Retry-After), `apiRequest`
  adds `.json()`. Add endpoints here, never call `fetch` from a command.
- `src/lib/errors.ts` — `CliError(message, code, exitCode | { exitCode, hint })`.
  `code` is the machine-readable reason and `hint` is the next command; both
  travel in the JSON envelope, so an agent never has to parse prose.
- `src/lib/output.ts` — `outputResult` (stdout, `_meta`-wrapped),
  `outputEvent` (NDJSON), `outputError` (stderr envelope + exit). JSON mode is
  `--json` or a piped stdout.
- `src/lib/logger.ts` — `log.data()` is the **only** writer to stdout; every
  other method writes stderr. Human UI (spinners, PIX card) also goes to
  stderr so `--json` output stays parseable.
- `src/lib/poll.ts` — payment phase, `afterPayment` hook, processing phase.
  `create` submits the résumé form in that hook; `order wait` finishes an
  unfilled create order there.
- `src/lib/wait.ts` — the shared shape of every paid flow: `announceOrder`
  (the first JSON document / the PIX card), `waitForOrder` (spinner + poll),
  `assertCompleted` (failed/expired → typed error with hint).
- `src/lib/spinner.ts` — `withSpinner` retries 429/5xx/network with backoff.
- `src/lib/doctor.ts` — pure checks with injectable probes; `commands/doctor.ts`
  only renders them.
- `src/lib/skill-files.ts` — where the bundled skill lives and how it is copied.
- `skill/ajusta-cv/` — the Claude Code skill shipped in the npm package.

## Rules

- **Two output modes, one code path.** Every command must work with `--json`
  and non-interactive input. Interactive prompts live behind `-i` and throw
  `not_interactive` (exit 2) without a TTY.
- **Paid flows are three processes for agents.** `<cmd> --no-wait --json`
  creates the order and exits; `order wait <id> --json` blocks until done;
  `order download <id>` fetches the file. Without `--no-wait` the command does
  all three itself for a human. Do not add a paid command that blocks by
  default without also honouring `--no-wait`.
- **Errors are data.** Throw `CliError` with a code from `ErrorCode` and a
  `hint` whenever there is a command that fixes it. Never `console.error` +
  `process.exit` in a command; `outputError` owns the exit.
- **stdout is for results.** Anything a human reads goes to stderr.
- **Keep the skill in step.** A new command, flag, error code or JSON field
  must land in `skill/ajusta-cv/SKILL.md` and `references/cli-reference.md`
  in the same change; `ajusta doctor` tells users when their installed copy
  drifted from the package, which only helps if the package is right.
- **Prices are not typed here.** `PRODUCTS` in `constants.ts` is display-only;
  the API's `finalPriceCents` is the truth for money.
- No classes beyond the error hierarchy, no nested ternaries, early returns,
  PT-BR copy for humans, English for code and docs.
- Tests are `node:test` with `assert/strict`, co-located in `test/`. Pure
  logic takes injectable fetchers (see `poll.ts`, `doctor.ts`) so tests never
  touch the network.
