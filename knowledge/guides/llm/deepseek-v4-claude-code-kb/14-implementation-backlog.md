# Implementation Backlog

## Phase 0 — Baseline

- [ ] Copy `.env.deepseek.example` into project root as `.env.deepseek`.
- [ ] Configure Claude Code to use DeepSeek Anthropic-compatible API.
- [ ] Add root `CLAUDE.md`.
- [ ] Add `.agent/` state files.
- [ ] Run `scripts/deepseek_smoke_test.py` with a real API key.

## Phase 1 — Agent OS

- [ ] Add project-specific subagents.
- [ ] Add long-horizon agent skill.
- [ ] Add model-router skill.
- [ ] Add URL extractor skill.
- [ ] Add command-policy hook.
- [ ] Add completion-contract hook.
- [ ] Add verification matrix.

## Phase 2 — Tooling

- [ ] Wire MCP servers for docs/search/issues if needed.
- [ ] Add read-only database introspection MCP if the project needs data debugging.
- [ ] Add browser/screenshot tool only in sandbox mode.
- [ ] Add test-runner wrapper.
- [ ] Add cost logging.

## Phase 3 — Evaluation

- [ ] Create five eval task fixtures.
- [ ] Run DeepSeek V4 Pro max-effort baseline.
- [ ] Run DeepSeek V4 Flash helper baseline.
- [ ] Compare against manual or current model flow.
- [ ] Record scores in `evals/results/`.

## Phase 4 — Production hardening

- [ ] Add hard gates for migrations, deploys, auth, payments, secrets.
- [ ] Add audit log for agent runs.
- [ ] Add rollback checklist.
- [ ] Add source register refresh job for external docs.
- [ ] Add provider status check before long runs.

## Definition of done

The stack is ready when a fresh repo task can be executed with:

1. deterministic setup;
2. visible model routing;
3. clear permission gates;
4. subagent delegation;
5. persistent memory;
6. verification commands;
7. final handoff that a human can review quickly.
