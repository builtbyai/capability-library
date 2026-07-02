# session-digest · _planned_

One capability, three output variants from one source. Replaces 5 ad-hoc digest skills (session-digest, cave-digest, client-digest, insight, insights).

**Variants:**
- `desktop` — A4-printable branded HTML (for archive in `Y:\CONSOLE_LEARN\03_Sessions\Digests\`)
- `mobile` — email-client-safe HTML with inline CSS (for sending via gmail / postiz)
- `caveman` — token-compressed markdown for LLM-to-LLM handoff (`tok / kept` ratio shown)

**Emits:** `digest.requested`, `digest.generated`, `digest.html-rendered`, `digest.caveman-rendered`, `digest.sent`, `digest.failed`
**Depends on:** intake-pipeline (for embedded screenshots), notify (for send)

## Brand

The `brand` field picks the visual treatment: Ward Tech Systems gold (`#A0752C–#DEB568`), ImpactIQ Storm-Gold, OnlyJalen, or generic. Per the user's memory `impactiq_brand_palette.md`, ImpactIQ assets reject blue/red/green/violet.

## Caveman digest

A heavily compressed markdown format (verb-first, omit articles, ID-only references) intended for LLM ingestion when summarizing a session for the NEXT LLM. The user has a `cave-digest` skill that does this; this capability provides the canonical implementation.
