# session-digest · sharp edges

## 1. Email-client CSS support is hostile

Inline-CSS mobile variant must avoid: `flexbox`, `grid`, `position`, `transform`, `:hover`, web fonts, SVG `<use>`, CSS variables. Gmail strips `<style>` blocks unless every rule is also inlined per-element. Use a tested table-layout template; do NOT hand-roll new CSS without round-tripping through Litmus.

## 2. Claude transcript JSONL format changes silently

The `~/.claude/projects/<slug>/conversation.jsonl` shape has changed at least twice across Claude Code releases. The ingester must tolerate missing fields + version-tag the parse path. Schema-validate optimistically; on parse failure, fall back to a regex-based extractor that grabs `role:` + `content:` blocks.

## 3. Caveman digest can over-compress

If `compressionRatio < 0.20`, the digest probably dropped material the next LLM needs. Add a guard: if ratio < 0.20, emit a warning event and keep one preserved-verbatim quote per stage to anchor context.

## 4. Sending HTML over WhatsApp drops the rendering

WhatsApp doesn't render HTML in messages. Sending a digest via `whatsapp-bridge` must convert to a thumbnail PNG (first page) + a link, never raw HTML. Use a `digest.send.channel-formatter` per-channel.

## 5. Brand palette enforcement

Per user memory `impactiq_brand_palette.md`, ImpactIQ digests MUST stick to gold (`#A0752C–#DEB568`) + ivory (`#F4F1ED`) + base black. Templates must declare which brand they're compatible with; the renderer rejects template-brand mismatches.
