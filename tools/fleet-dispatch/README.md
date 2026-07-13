# tools/fleet-dispatch

Race the 3-host fleet (node-a, node-b, node-c) for an Ollama task. First successful response wins. Simpler in-library twin of `~/.claude/tools/fleet-ollama.mjs`.

## Run

```bash
node tools/fleet-dispatch/dispatch.mjs \
  --prompt-file prompt.txt \
  --model qwen2.5-coder:7b \
  --out result.txt \
  --num-ctx 32768
```

Or limit to specific hosts:

```bash
node tools/fleet-dispatch/dispatch.mjs --prompt "hi" --hosts-only node-a,node-b
```

## When to use

- Library code wants a one-off inference without pulling in a full ModelInvocation adapter.
- You need racing semantics (first response wins) rather than picking a host.
- The task is text-only and ~10KB or less of prompt.

For richer needs (cost tracking, retry, cloud bridging, vision), use the user's `~/.claude/tools/fleet-ollama.mjs` directly — this tool is intentionally minimal.

## Hard rules (from user's CLAUDE.md)

- Always pass `--num-ctx 32768` for non-trivial prompts. Ollama defaults to 4096 and silently truncates.
- Never inline > 300 chars of prompt; use `--prompt-file`.
- Always `--out` to a file; don't pipe long results back into the shell.
