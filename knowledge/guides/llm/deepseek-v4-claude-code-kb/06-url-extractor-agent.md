# URL Extractor Agent

## Purpose

Turn messy pasted notes, logs, browser exports, docs pages, and transcripts into clean URL intelligence.

## Capabilities

The URL extractor should:

- extract URLs from pasted text
- normalize trailing punctuation
- preserve fragments when they matter
- dedupe links
- group links by domain
- classify links by use case
- identify API docs, pricing, rate limits, errors, examples, integrations, status, and support links
- output Markdown, JSON, or a task matrix

## Recommended classification tags

```text
api-docs
quick-start
pricing
rate-limit
error-codes
agent-integration
claude-code
mcp
thinking-mode
tool-calls
json-mode
fim
context-cache
status
faq
support
community
source-code
unknown
```

## CLI usage

```bash
python scripts/url_extractor.py pasted-links.txt --markdown
python scripts/url_extractor.py pasted-links.txt --json
```

## Claude Code prompt

```text
Use the url-extractor skill on this pasted text. Return:
1. canonical deduped URL list
2. grouped-by-domain list
3. purpose classification
4. missing-doc gaps
5. recommended KB file map
```

## Output contract

```markdown
# URL Extraction Report

## Canonical URLs

| URL | Domain | Category | Notes |
|---|---|---|---|

## Domain Groups

## Recommended Knowledge Base Sections

## Follow-up Fetch Plan
```

## Integration pattern

```text
Pasted Text
  ↓
URL Extractor Skill
  ↓
Canonical Link Inventory
  ↓
Docs Fetch / Source Register
  ↓
Knowledge Base Generator
```

## Why this matters

URLs are often the highest-signal source map inside messy notes. Turning them into typed inventory lets an agent know what to fetch, cite, cache, and verify.
