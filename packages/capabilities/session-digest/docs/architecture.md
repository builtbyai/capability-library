# session-digest · architecture

```
DigestRequest{source, variants[], brand, templateId?}
        │
        ▼
ingest source → normalized DigestIR (intermediate representation):
  - claude-session: parse transcript JSONL → events[]
  - bus-window: query bus.history(fromAt, toAt) → events[]
  - whatsapp-chat: query whatsapp-bridge listMessages → events[]
  - manual: pass-through markdown
        │
        ▼
for each variant in variants[]:
    render(DigestIR, template[variant], brand) → HTML / markdown artifact
        │
        ▼
write to DIGEST_STORE/{digestId}/{variant}.{ext}
emit digest.html-rendered or digest.caveman-rendered per variant
        │
        ▼
emit digest.generated { artifacts: {desktop, mobile, caveman} }
```

Templates live in `templates/digest-templates/{desktop,mobile,caveman}/<id>.{hbs|md}` and are user-editable. Brand assets (logos, palette) come from `connector-config` or a static `brand-os` checkout.

## Caveman compression rules

The caveman variant applies a stable set of transforms:
- Strip articles (a/the/an), filler verbs (is/are/be)
- Replace path strings with `<file>`/`<dir>` placeholders past the first reference
- Convert "the user said X" → `usr:X`, "Claude said Y" → `cc:Y`
- Drop tool result bodies > 200 chars, replace with `<truncated +N lines>`
- Emit a footer with `compressionRatio = output_tokens / input_tokens`
