# URL Extractor Skill

Use this skill when the user pastes raw URLs, browser-export text, docs pages, logs, markdown, emails, or transcripts and needs a clean source map.

## Inputs

- pasted text
- local text/markdown file
- source register
- transcript containing URLs

## Procedure

1. Extract all URL-like strings.
2. Normalize trailing punctuation.
3. Preserve fragments and query strings unless they are clearly tracking noise.
4. Dedupe exact URLs.
5. Group by domain.
6. Classify each URL by likely purpose.
7. Return Markdown by default.

## Categories

- api-docs
- quick-start
- pricing
- token-usage
- rate-limit
- error-codes
- agent-integration
- claude-code
- thinking-mode
- tool-calls
- json-mode
- fim
- context-cache
- status
- faq
- support
- github
- unknown

## Preferred command

```bash
python scripts/url_extractor.py <input-file> --markdown
```

## Output contract

```markdown
# URL Extraction Report

## Canonical URLs
| URL | Domain | Category | Notes |
|---|---|---|---|

## Domain Groups

## Recommended Fetch Order

## Missing Source Gaps
```
