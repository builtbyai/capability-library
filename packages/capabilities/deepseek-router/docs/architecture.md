# architecture.md — deepseek-router

## Shape

This is a **CLI-only capability**. No frontend, no backend service, no
Cloudflare layer. Three components:

```
backend/
  claude-deepseek          bash launcher (Git Bash / macOS / Linux)
  claude-deepseek.bat      CMD launcher (Windows)
  ds-cost                  Node cost analyzer
  ds-cost.bat              CMD shim that calls `node ds-cost`
```

The wrapper sets four env vars and exec's `claude`:

```
ANTHROPIC_BASE_URL = https://api.deepseek.com/anthropic
ANTHROPIC_AUTH_TOKEN = <key from ~/.claude/secrets/deepseek-anthropic.key>
ANTHROPIC_API_KEY    = <same>
ANTHROPIC_MODEL      = claude-sonnet-4-6 | claude-opus-4-7   (tier dependent)
```

DeepSeek's server then maps the requested model name to its own internal model
(see `manifest.yaml → modelMapping`).

## Three execution paths

| Flag | Behavior |
|---|---|
| (none) | Full interactive REPL. Claude Code loads all hooks, skills, CLAUDE.md, memory. ~81k input/turn. |
| `--check` | Single HTTP POST to `/v1/messages` with a 4-token ping. Prints HTTP code + server model name. No `claude` launch. |
| `--code "<prompt>"` | Oneshot codegen via `claude --bare`. Drops 80k overhead → ~1.4k input. Strips markdown fences. Optional `--include path[,path]` prepends file contents. |

## The `--bare` optimization

`claude --bare` is the load-bearing flag for `--code` mode cost-effectiveness.
It disables:

- hooks (PreToolUse, UserPromptSubmit, etc.)
- LSP integration
- plugin sync
- attribution headers
- auto-memory (no MEMORY.md / no memory-first-lookup)
- background prefetches
- keychain reads
- CLAUDE.md auto-discovery

The wrapper still passes `--append-system-prompt` to inject a terse codegen
contract ("output ONLY code, no fences, no prose") so the model behaves like a
codegen-only oracle rather than a general-purpose assistant.

## ds-cost: why a separate binary

`ds-cost` is independent of the wrapper for three reasons:

1. **Audit any saved JSON.** Run it on a result.json from a CI job, or pipe a
   prior `--output-format json` into it after the fact.
2. **Auto-detect tier.** Reads `modelUsage` keys and infers flash/pro from the
   model name. Override with `--tier`.
3. **Single source of truth for rates.** The `RATES` constant at the top of
   `ds-cost` mirrors `manifest.yaml → pricing:`. If DeepSeek changes prices,
   both must be updated.

## Why this isn't a `core-jobs` registered handler

Other capabilities in the library register handlers with `@multimarcdown/core`
(`bus`, `jobs`, `health`, etc.). `deepseek-router` doesn't, because it's a
provider-routing wrapper consumed at the **shell** layer, not the
dashboard-runtime layer. There's no event for "user asked the AI a question"
that another capability needs to subscribe to. If a future capability wants to
route AI calls through it programmatically, the right extension is a
`backend/router.ts` that exposes `routeViaDeepSeek({tier, prompt}) →
Promise<{result, cost, tokens}>` and registers a `bus.publish('ai.completion',
…)` event. That's deferred until a consumer exists.

## File context injection

`--include path1,path2` prepends:

```
=== FILE: path1 ===
<contents of path1>

=== FILE: path2 ===
<contents of path2>

<user prompt>
```

The `=== FILE: ===` delimiter is non-dash-prefixed deliberately — see
`docs/sharp-edges.md` #4.

No tokenization or pre-summarization happens on includes — the full file
contents go to the API. For large files, expect the input token count to
balloon; verify with `ds-cost` after the run.

## What this capability does NOT do

- Streaming (`--output-format stream-json`) is not wrapped. If you need it,
  invoke `claude` directly with the wrapper's env in place.
- Multi-file output parsing. The system prompt instructs the model to emit
  `=== FILE: <path> ===` between files for multi-file responses, but the
  wrapper does not split the response back into separate file writes. That's
  the caller's job (or a future enhancement).
- Diff mode. There's no built-in "show me what changed" for `--include`
  workflows — get the file back via `--code` and pipe through `diff` yourself.
- Provider failover. If DeepSeek is down, there's no fallback to Ollama or
  Anthropic. Add `--fallback-model` if you want the underlying `claude` CLI's
  built-in fallback (only works in `--print` mode).
