# tools/vocr

Vision OCR via local Ollama (`qwen2.5vl`, `llama3.2-vision`, `llava`). In-library twin of the user's `~/.claude/tools/vocr.mjs`. Hits Ollama at `127.0.0.1:11434` by default; costs nothing; avoids `Argument list too long` from inline base64.

## Run

```bash
node tools/vocr/vocr.mjs path/to/image.png

# Options:
node tools/vocr/vocr.mjs img.png --model qwen2.5vl:32b      # heaviest, best quality
node tools/vocr/vocr.mjs img.png --model llama3.2-vision:11b # better for dense text OCR
node tools/vocr/vocr.mjs img.png --prompt "what's the error?" # custom prompt
node tools/vocr/vocr.mjs img.png --host http://10.10.10.2:11434 # remote ollama
```

## When to use the in-library version vs `~/.claude/tools/vocr.mjs`

- Library version: programmatic use from other capabilities (`media-processing` extracting OCR text, `screenshot-capture` adding alt-text).
- User version: ad-hoc invocations from Claude Code sessions. Same wire format; substitutable.

## Why local Ollama

Per the user's CLAUDE.md: do NOT route screenshots through OpenRouter/Anthropic unless the local model is clearly wrong AND a second pass is explicitly requested. Local is free; the BBWADMIN/JMAIN fleet has GPU; the cost-ledger for hosted vision adds up fast.
