# deepseek-router

> Point Claude Code at DeepSeek's Anthropic-compatible endpoint, with a codegen
> mode that strips 80k of system-prompt overhead via `--bare` and a cost
> analyzer that recomputes real DeepSeek pricing.

## Why this capability exists

DeepSeek exposes an Anthropic-shaped endpoint at
`https://api.deepseek.com/anthropic`. Setting `ANTHROPIC_BASE_URL` +
`ANTHROPIC_API_KEY` is enough to make Claude Code talk to it, but four practical
problems remain:

1. **Model mapping is server-side and silent.** `claude-opus-*` lands on
   `deepseek-v4-pro`; everything else lands on `deepseek-v4-flash`. If you do
   nothing, Claude Code's default of opus-class quietly costs ~3× more.
2. **Claude Code's `total_cost_usd` is wrong** for any non-Anthropic provider —
   it uses Anthropic's rate card. Observed overstatement: **11–37×**.
3. **Anthropic `cache_control` is ignored** — every turn pays full input rate,
   so the usual prompt-cache savings don't apply. The 80k of system prompt +
   skills + memory that Claude Code loads each turn is the dominant cost.
4. **`--bare` mode** drops the 80k overhead to ~1.4k tokens (57× reduction),
   making one-shot codegen turns cost ~$0.0002 instead of ~$0.012. But you have
   to know to use it, and you have to re-pin `--model` because `--bare` ignores
   `ANTHROPIC_MODEL`.

This capability bundles the answers.

## Tools

| binary | purpose |
|---|---|
| `claude-deepseek` | launch Claude Code via DeepSeek (interactive / `--code` / `--agent`) |
| `claude-deepseek.bat` | same, for CMD / PowerShell on Windows |
| `ds-cost` | recompute real DeepSeek cost from any CC `--output-format json` blob |
| `ds-cost.bat` | same |

## Usage

```bash
# Interactive REPL, cheap tier (sonnet -> v4-flash)
claude-deepseek

# Interactive REPL, smart tier (opus -> v4-pro)
claude-deepseek --tier pro

# Health-ping without launching a session
claude-deepseek --check
claude-deepseek --tier pro --check

# --code: oneshot codegen. Uses `claude --bare` to drop ~80k system-prompt
# overhead. No fences. Clean code to stdout. Single LLM turn, no tools.
claude-deepseek --code "Write a Python function fizzbuzz(n)"
claude-deepseek --code --cost "..."                                # add cost line
claude-deepseek --code --tier pro --include src/foo.py,src/bar.py "..."
echo "Write a SQL query that ..." | claude-deepseek --code -        # stdin

# --agent: full Claude Code agent loop via DeepSeek. Tools (Bash/Read/Write/
# Edit/Grep/Glob/Agent/etc.), skills, hooks, CLAUDE.md, memory, AND ALL MCP
# SERVERS active. Bypasses the permission gate so tools fire without
# interactive approval. Subagents auto-route to flash via
# CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash.
claude-deepseek --agent "List the files in src/ and tell me which has TODOs"
claude-deepseek --agent --tier pro --cost "..."

# --pipeline: chain multiple subagents in sequence. The main DeepSeek agent
# acts as conductor and invokes each subagent via the Agent tool, feeding
# state forward. Each subagent runs on flash; orchestrator on --tier.
claude-deepseek --pipeline bug-hunter,security-reviewer,test-writer --include src/auth.py \
  "Audit, then write tests for any issue found"
claude-deepseek --pipeline architect,refactor-engineer,qa-verifier "..."

# --stream: live text deltas + tool-use markers to stdout as they arrive.
# Useful for long-horizon work; cost line still emitted at the end.
claude-deepseek --agent --stream "..."

# --mcp-warmup N: wait N seconds before first action so stdio MCPs finish
# spawning. Required when using sequential-thinking / memory / filesystem /
# git / fetch / github via --agent or --pipeline in single-turn -p mode.
# (HTTP MCPs like Canva/Cloudflare/Gmail/HF/PayPal don't need warmup.)
claude-deepseek --agent --mcp-warmup 15 "Use the github MCP to..."

# Pass-through flags for fine control
claude-deepseek --agent --tools "Read,Grep,Glob"          # restrict tool set
claude-deepseek --agent --mcp-config ./.mcp.json          # custom MCP servers
claude-deepseek --agent --continue                        # resume last session
claude-deepseek --agent --resume <session-id>             # resume specific session
claude-deepseek --agent --longctx                         # use deepseek-v4-pro[1m]

# Read the prompt from stdin
echo "Write a SQL query that ..." | claude-deepseek --code -

# Analyze a saved JSON result file
ds-cost result.json
ds-cost result.json --tier flash    # override autodetect

# Pipe directly
claude-deepseek --tier flash -p "..." --output-format json | ds-cost
```

## Empirical cost (verified 2026-06-28)

| Mode | Input | Cache_read | Output | Wall | Real cost | CC printed |
|---|---:|---:|---:|---:|---:|---:|
| Full session, flash | 81,339 | 0 | 473 | 14.6s | **$0.01152** | $0.25 (22×) |
| Full session, pro | 81,338 | 0 | 687 | 23.6s | **$0.03598** | $0.42 (12×) |
| `--code`, flash (fizzbuzz) | 1,493 | 0 | 151 | 3.2s | **$0.00025** | $0.01 (27×) |
| `--code`, pro (fizzbuzz) | 1,493 | 0 | 182 | 3.2s | **$0.00081** | $0.01 (15×) |
| `--code`, flash (3-bug fix) | 1,740 | 0 | 464 | 6.4s | **$0.00037** | $0.01 (33×) |
| `--code`, pro (3-bug fix) | 1,740 | 0 | 577 | 6.1s | **$0.00126** | $0.02 (18×) |
| `--code`, flash (rate limiter, thinking) | 1,783 | 0 | 24,866 | 218s | **$0.00721** | $0.40 (55×) |
| `--code`, pro (rate limiter, thinking) | 1,783 | 0 | 25,271 | 228s | **$0.02276** | $0.64 (28×) |
| `--agent`, flash (7-turn, Bash+Read) | 177,769 | 249,216 | 692 | 46.4s | **$0.02578** | $0.62 (24×) |
| `--agent`, flash (MCP — Hugging Face search + tool list) | 105,216 | 58,624 | 3,525 | 33.9s | **$0.01588** | $0.64 (40×) |
| `--pipeline`, flash (bug-hunter + security-reviewer, auth.py) | 207,969 | 587,520 | 2,226 | 212.2s | **$0.03138** | $1.82 (58×) |
| `--agent --mcp-warmup 15`, flash (6 new MCPs E2E) | 192,058 | 783,744 | 2,231 | 82.5s | **$0.02971** | $1.41 (47×) |

## 6 newly-installed coding-agent MCPs

Installed user-scope via `~/.claude.json -> mcpServers` (template snapshot in
`templates/mcp-servers-coding-agent.json`):

| Server | Transport | What it adds |
|---|---|---|
| **sequential-thinking** | stdio (`cmd /c npx`) | Structured reasoning canvas: branching thoughts, revisions, hypothesis tracking. Big win on hard debugging. |
| **memory** | stdio (`cmd /c npx`) | Knowledge graph persisted to disk. Entity/relation/observation CRUD. Survives across sessions — use for project-wide facts. |
| **filesystem** | stdio (`cmd /c npx`) | Path-scoped bulk file ops (read/write/list/move/search/edit). Scoped to `C:/Code`, `Desktop`, `PROJECTS` (no full FS access). |
| **git** | stdio (`uvx`) | Local git intelligence beyond Bash: status, diff, log, blame, branch ops on a given repo. |
| **fetch** | stdio (`uvx`) | Markdown-converting web fetch. Often cleaner than the built-in WebFetch for docs pages. |
| **github** | stdio (`cmd /c npx`) + PAT | Repo intelligence: PR/issue CRUD, code search, file CRUD, branch/commit ops. PAT auto-pulled from `gh auth token`. |

All 6 verified end-to-end through DeepSeek with one `--agent --mcp-warmup 15` call: 6/6 PASS, $0.030, 82s wall.

Notes:
- `--code` mode is ~50× cheaper than a full interactive turn for trivial codegen.
- For tasks that trigger DeepSeek's thinking mode (hard reasoning) output
  tokens can balloon to 25k+ even when the visible result is short. Wall
  time jumps with it. The thinking blocks count as output tokens — they
  are stripped from `result` but billed.
- `--agent` cost scales with turn count; DeepSeek's auto-prefix-cache
  recovers ~58% of multi-turn input (cache_read at $0.0028/M vs $0.14/M
  miss rate), but the first turn always pays full 80k.

## Pro vs flash empirical quality

Same prompt, same context, both tiers run cold:

| Task | Flash | Pro |
|---|---|---|
| 3-bug Python fix (paginate / days_between / chunk) | ✓ all 3 fixed | ✓ all 3 fixed |
| Multi-file TS refactor (extract validator) | ✓ correct, identical output | ✓ correct, identical output |
| 3-bug concurrent rate limiter (race + math + edge) | **✗ fix #3 broken under stress** | ✓ all 3 + caught subtle `_refill` side-effect bug |
| 4-file agent loop (Bash + Read + answer) | ✓ correct (cost $0.026) | not yet tested |

Take-away: **flash is sufficient for routine refactors and surface-level bug
fixes; pro pulls ahead on concurrent / state-machine / subtle-correctness
work**. Spend the 3× only on the third category.

## Install

This capability is currently delivered as four CLI binaries, not a package. The
canonical install is:

```bash
# 1. Drop the bins onto PATH (or copy them to a dir already on PATH)
cp backend/claude-deepseek backend/ds-cost     ~/.claude/tools/
cp backend/claude-deepseek.bat backend/ds-cost.bat ~/.claude/tools/
chmod +x ~/.claude/tools/claude-deepseek ~/.claude/tools/ds-cost

# 2. Put the API key here, single line, mode 600
echo 'sk-...' > ~/.claude/secrets/deepseek-anthropic.key
chmod 600 ~/.claude/secrets/deepseek-anthropic.key

# 3. Verify
claude-deepseek --check
claude-deepseek --tier pro --check
```

See `scripts/install.sh` for the same flow.

## Risk

`riskLevel: external-ai-processing`. Prompts and (with `--include`) file
contents are sent to a third-party provider in mainland China. **Do not point
this at files containing customer PII, secrets, or anything you wouldn't paste
into an external AI tool.**

## Sharp edges

See `docs/sharp-edges.md`. The big four:

1. `cache_control` hints are ignored, BUT DeepSeek's auto-prefix-cache fires
   across multi-turn agent loops (~58% of input tokens billed at cache_read).
2. `--bare` ignores `ANTHROPIC_MODEL`, so the wrapper re-pins `--model` inline.
3. `cc model id` cosmetic label is non-load-bearing — wrapper now uses direct
   DeepSeek model names (`deepseek-v4-pro`, `deepseek-v4-flash`) so the cost
   analyzer's auto-tier-detect is reliable.
4. `[1m]` long-context variant (`--longctx`) is accepted by the API but the
   response always reports `"model":"deepseek-v4-pro"` regardless, so we can't
   confirm from the response alone whether the 1M context window was used.

## Bundled knowledge base

`kb/` ships the full **DeepSeek V4 × Claude Code Knowledge Base** (8 docs, 3
runbooks, 5 scripts, 13 templates) imported 2026-06-28. Key items consumed
into this capability:

- The `ANTHROPIC_DEFAULT_OPUS_MODEL` / `_SONNET_MODEL` / `_HAIKU_MODEL` env
  vars are now set automatically by the wrapper so Claude Code's internal
  tier routing round-trips through DeepSeek correctly.
- `CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash` is exported so any subagent
  invoked via the `Agent` tool auto-routes to the cheap tier.
- `CLAUDE_CODE_EFFORT_LEVEL=max` (pro) / `high` (flash).
- The `[1m]` long-context suffix is supported via `--longctx`.
- The 5 KB subagent definitions (`architect`, `refactor-engineer`,
  `qa-verifier`, `url-extractor`, `docs-cartographer`) have been installed
  to `~/.claude/agents/` with their `model:` and `effort:` frontmatter
  stripped so they work in any Claude Code session (DeepSeek or otherwise).
- 3 additional subagents added to fill multi-agent E2E gaps: `bug-hunter`
  (root-cause-vs-symptom diagnosis), `test-writer` (regression-focused tests),
  `security-reviewer` (OWASP top-10 + secret leakage + injection). All 8
  available globally; copies preserved in `templates/agents/`.

## Multi-agent + MCP verified end-to-end

- **MCP tool routing through DeepSeek**: tested 2026-06-28 with 87 mcp__*
  tools across 9 servers. DeepSeek emits tool_use, Claude Code dispatches
  to the MCP server, results round-trip as tool_result. Worked for HF
  search; same protocol covers Canva/Cloudflare/Gmail/Obsidian/PayPal/etc.
- **`--pipeline`**: verified 2 subagents in series on a real auth.py audit
  (bug-hunter + security-reviewer), $0.031 total, 74% input cached.
- **Subagent auto-routing**: `CLAUDE_CODE_SUBAGENT_MODEL=deepseek-v4-flash`
  is exported so the orchestrator can be pro while subagents are cheap.

Original KB intact in `kb/` for reference. Re-read it if you want the
DeepSeek-specific operating model the upstream authors recommend (they
default to v4-pro everywhere; we default to v4-flash because empirical
testing showed equal output on routine tasks for 3× less).
