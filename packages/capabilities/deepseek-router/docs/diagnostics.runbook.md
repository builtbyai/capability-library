# diagnostics.runbook.md — deepseek-router

## Health checks (from manifest)

```bash
claude-deepseek --check                     # flash tier reachable, mapping correct
claude-deepseek --tier pro --check          # pro tier reachable, mapping correct
claude-deepseek --code --cost "return 1"    # codegen bare-mode pricing < $0.001
```

## Failure: `missing key at ~/.claude/secrets/deepseek-anthropic.key`

Cause: key file absent or empty.

Fix: drop the API key as a single line, mode 600.

```bash
mkdir -p ~/.claude/secrets
echo 'sk-...' > ~/.claude/secrets/deepseek-anthropic.key
chmod 600 ~/.claude/secrets/deepseek-anthropic.key
```

## Failure: `claude-deepseek: FAIL (401)`

Cause: key revoked, rotated, or wrong format.

Fix: regenerate at https://platform.deepseek.com/api_keys and rewrite the key
file. Re-run `claude-deepseek --check` to confirm.

## Failure: `claude-deepseek: FAIL (429)`

Cause: rate limit. DeepSeek's free tier is throttled; the paid tier is generous
but bursty load can still trip it.

Fix: wait 60s, retry. For ongoing high throughput add `metadata.user_id` to
isolate from other consumers (the only metadata field DeepSeek honors).

## Failure: cost printed by Claude Code is ~$0.40 for a 1-turn flash run

Cause: this is **expected** — Claude Code's `total_cost_usd` uses Anthropic's
Opus rate card. Ignore that number entirely on any non-Anthropic provider.
Trust `ds-cost` instead.

## Failure: `--code` mode emits markdown fences

Cause: the model ignored the `--append-system-prompt` directive and wrapped
its response in ```` ```python ```` fences.

Fix already in wrapper: a regex strips a leading fence opener and a trailing
fence closer. If the output you got still has fences, check whether the model
emitted multiple fenced blocks (see sharp-edge #8) and consider splitting the
request.

## Failure: `--code --include` errors with `unknown option '=== FILE:'`

Cause: the file context was prepended ahead of a prompt that itself started
with text the parser misread, or the wrapper bypassed `-- "$FULL_PROMPT"`
guard for some reason.

Fix: confirm the wrapper passes `-p -- "$FULL_PROMPT"` (the `--` terminates
option parsing). The known-good delimiter for file context is
`=== FILE: <path> ===` — anything starting with `--` will re-trigger this.

## Failure: `cc model id` in `ds-cost` output shows haiku when you asked for sonnet

Cause: Claude Code's internal accounting label. Cosmetic — both haiku-* and
sonnet-* map to v4-flash server-side. Pricing in `ds-cost` is computed from
the **explicit `--tier`** flag, falling back to auto-detect from the
`modelUsage` key only if no flag was passed.

Fix: pass `--tier flash` (or `--tier pro`) explicitly to `ds-cost` when
analyzing a saved blob.

## How to verify pricing rates against DeepSeek's published rate card

```bash
# Spot-check that the numbers in manifest.yaml -> pricing: still match.
curl -s https://api-docs.deepseek.com/quick_start/pricing | grep -E '\$0\.[0-9]+'
```

If DeepSeek changes rates, edit:

- `manifest.yaml` → `pricing:` block
- `backend/ds-cost` → `RATES` constant (top of file)
- `README.md` → "Empirical cost" table (or annotate it as stale)
