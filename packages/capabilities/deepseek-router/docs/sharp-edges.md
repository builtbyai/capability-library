# sharp-edges.md — deepseek-router

Failure modes and surprises that already cost time. Read before editing.

## 1. `cache_control` hints are ignored, BUT auto-prefix-caching DOES fire

DeepSeek's Anthropic-compat layer documents `cache_control` as ignored on every
message-content variant. The Anthropic-style explicit cache breakpoints have no
effect — sending them raises no error and grants no discount.

However, DeepSeek runs its **own automatic prompt-prefix cache** that fires
when the same prefix is replayed within a short window. This means:

- **Single-turn requests** (one `claude -p ...` invocation): cache_read=0
  always. You pay the full ~$0.14/M flash / $0.435/M pro input rate on the
  whole 80k of Claude Code system prompt.
- **Multi-turn agent loops** (one `--agent` invocation that becomes 5-10
  internal tool_use turns): cache_read fires *across* turns. Observed
  cache_read/input ratio in a 7-turn agent loop: 249k cached / 178k fresh
  = 58% of input tokens billed at the cache_read rate (~$0.0028/M flash).

Take-aways:
- For one-shot codegen, use `--code` (which uses `--bare` to drop the 80k
  overhead in the first place).
- For agent loops, the auto-cache pays for some of the multi-turn waste,
  but you still pay full price on the first turn's 80k context. Plan
  accordingly: a 7-turn agent loop on flash currently costs ~$0.026
  total (~$0.004/turn amortized), vs ~$0.012 for a single fresh turn.

`ds-cost` treats `input_tokens`, `cache_creation_input_tokens`, and
`cache_read_input_tokens` as **mutually exclusive** counters (per Anthropic
spec). Total billable input = sum of all three at their respective rates.
The earlier version of `ds-cost` subtracted `cache_read` from `input_tokens`
and double-discounted — that was a bug, fixed 2026-06-28.

## 2. `--bare` ignores `ANTHROPIC_MODEL`

`claude --bare` is the secret weapon for codegen — it skips hooks, plugin sync,
auto-memory, CLAUDE.md discovery, and the entire skills preload. Input drops
from ~81k to ~1.4k. But `--bare` also stops reading `ANTHROPIC_MODEL` from the
environment, so the tier the wrapper exported via env is silently dropped to
whatever Claude Code picks as its default (currently haiku-class).

The wrapper compensates by passing `--model <pinned>` explicitly on the
`claude` command line whenever `--code` mode is used.

If you remove that explicit `--model` thinking the env var will cover it, the
model will silently fall back. You'll still get a working response and the
server will still map it to v4-flash (because haiku-* also maps to flash), so
the price doesn't change, but `--tier pro` won't actually deliver pro behavior.

## 3. `cc model id` is non-load-bearing

In some `--code` runs (especially with `--include`), CC reports
`claude-haiku-4-5-20251001` in the `modelUsage` block even when you pinned
`claude-sonnet-4-6`. This appears to be a Claude Code internal accounting label
that doesn't reflect the actual API call body. Both names map to v4-flash
server-side, so cost is unchanged.

If you're auto-detecting tier from a saved JSON blob via `ds-cost`, you can be
misled into thinking a tier=pro request actually used haiku. Override with
`--tier pro` to force the correct rate card.

## 4. Prompt arguments starting with `--` get parsed as flags

`claude -p` is a boolean flag, not a key/value. The prompt is positional. If
the prompt string starts with `--` or `---` (e.g., when prepending file context
with a `--- FILE: ---` delimiter), claude's CLI parser tries to interpret it as
a flag and errors out.

Fix already applied in the wrapper:
- Pass `--` before the positional prompt: `claude ... -p -- "$FULL_PROMPT"`.
- Use a non-dash file delimiter: `=== FILE: path ===`.

If you change the delimiter format, keep it non-dash-prefixed.

## 5. Server-side mapping is opaque and not configurable

You cannot request `deepseek-v4-flash` by name through this endpoint. You ask
for `claude-sonnet-*` and trust the server to map it. If DeepSeek changes the
mapping (e.g. routes haiku to a smaller cheaper tier in the future), tests
relying on `cc model id ↔ pricing-tier` mapping will silently shift.

Mitigation: the manifest `pricing:` block is the source of truth for token
cost calculation. If DeepSeek changes rates, edit the manifest and re-test
against `api-docs.deepseek.com/quick_start/pricing`.

## 6. Anthropic SDK features that DeepSeek doesn't support

From DeepSeek's compat docs, these are silently ignored or rejected:

- `cache_control` (see #1)
- `mcp_servers`
- `container`
- `service_tier`
- `top_k`
- `anthropic-beta` and `anthropic-version` HTTP headers
- `disable_parallel_tool_use` on `tool_choice`
- `cache_control` on `tools[].cache_control`
- `is_error` on tool_result blocks
- `citations` on text blocks
- image / document / search_result / redacted_thinking / code_execution_tool_result content blocks (rejected as unsupported)
- `budget_tokens` inside `thinking` (parent `thinking:` flag is honored)

If your Claude Code session uses skills that depend on any of these, expect
silent behavior changes vs the real Anthropic backend.

## 7. The 80k Claude Code overhead is not optional in interactive mode

The cost win of `--code` mode comes from `--bare`. In interactive REPL mode
you can't use `--bare` (you'd lose hooks, skills, CLAUDE.md, the whole
working environment). So **expect interactive sessions to cost ~$0.012/turn
on flash and ~$0.036/turn on pro**, regardless of how short your individual
messages are. The 80k input floor is fixed per turn.

If your task is "run one command and exit," use `--code`. If your task is
"work in a project," use the interactive mode and accept the floor.

## 9. Stdio MCP startup race in `-p` mode

Claude Code's `-p` (print/non-interactive) mode does NOT wait for stdio MCP
servers to finish their handshake before serving the agent its tool list.
On Windows this is especially bad: every `cmd /c npx -y @org/server-foo`
invocation spawns a cmd, then a node, then npm cache resolution, then the
actual server — 5 to 15 seconds per server. With 14+ stdio MCPs configured
(the user has chrome-devtools x3, playwright x3, obsidian, plus our 6 new
ones), most of them are still `"status": "pending"` when the agent's first
turn begins. Any MCP not yet `"connected"` at that moment is **invisible**
to the agent for that turn.

The `system.init` stream-json event proves this:

```json
"mcp_servers": [
  { "name": "obsidian",            "status": "connected" },
  { "name": "chrome-devtools",     "status": "pending"   },
  { "name": "sequential-thinking", "status": "pending"   },
  { "name": "memory",              "status": "pending"   },
  { "name": "filesystem",          "status": "pending"   },
  { "name": "git",                 "status": "pending"   },
  { "name": "fetch",               "status": "pending"   },
  { "name": "github",              "status": "pending"   }
]
```

Mitigations:

1. **`--mcp-warmup <sec>`** (built into the wrapper) — prepends a Bash-sleep
   preamble that forces the agent's first turn to wait, after which the
   next turn's tool list refreshes with the now-connected stdio MCPs.
   Use 15s for routine, 30s if running many MCPs cold. Verified to bring
   all 6 new MCPs from invisible to operational in a single command.

2. **HTTP MCPs are immune** — they're just URLs; the connect is instant.
   When designing a new MCP, prefer HTTP/SSE transport over stdio if you
   want it to "just work" in `-p` mode without warmup.

3. **Multi-turn interactive sessions** don't hit this — by turn 2 the stdio
   MCPs have all connected and the agent's tool list refreshes.

This is NOT a 3P provider security block (initial hypothesis). Native
Anthropic shows the same race; tested both endpoints with same result.

## 8. Output stripping is heuristic

The fence-stripper in `--code` mode strips a leading ```` ```lang ```` line
and a trailing ```` ``` ```` line. If the model emits **multiple** fenced
blocks (e.g., one Python file followed by one shell command both fenced), the
stripper will only remove the outer pair and the inner fences will remain in
output. Mitigation: the system prompt explicitly says no fences, and in
practice this almost never triggers — but it's a known edge case.
