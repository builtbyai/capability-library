#!/usr/bin/env python3
"""Extract, normalize, classify, and report URLs from text.

Examples:
  python scripts/url_extractor.py notes.txt --markdown
  python scripts/url_extractor.py notes.txt --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from urllib.parse import urlparse

URL_RE = re.compile(r"(?:https?://|mailto:)[^\s)\]>'\"`]+", re.IGNORECASE)
TRAILING = ".,;:!?)]}'\"`"


@dataclass(frozen=True)
class UrlRecord:
    url: str
    domain: str
    category: str


def canonicalize(raw: str) -> str:
    url = raw.strip().rstrip(TRAILING)
    return url


def classify(url: str) -> str:
    u = url.lower()
    if "pricing" in u:
        return "pricing"
    if "token_usage" in u or "token-usage" in u:
        return "token-usage"
    if "rate_limit" in u or "rate-limit" in u:
        return "rate-limit"
    if "error_codes" in u or "error-codes" in u:
        return "error-codes"
    if "claude_code" in u or "claude-code" in u:
        return "claude-code"
    if "agent_integrations" in u or "awesome-deepseek-agent" in u:
        return "agent-integration"
    if "thinking_mode" in u or "thinking-mode" in u:
        return "thinking-mode"
    if "tool_calls" in u or "tool-calls" in u:
        return "tool-calls"
    if "json_mode" in u or "json-mode" in u:
        return "json-mode"
    if "fim_completion" in u or "fim" in u:
        return "fim"
    if "kv_cache" in u or "cache" in u:
        return "context-cache"
    if "status." in u:
        return "status"
    if "faq" in u:
        return "faq"
    if "github.com" in u:
        return "github"
    if "api-docs" in u or "/api/" in u:
        return "api-docs"
    if u.startswith("mailto:"):
        return "support"
    return "unknown"


def extract(text: str) -> list[UrlRecord]:
    seen: dict[str, UrlRecord] = {}
    for match in URL_RE.findall(text):
        url = canonicalize(match)
        parsed = urlparse(url)
        domain = parsed.netloc or "mailto"
        seen.setdefault(url, UrlRecord(url=url, domain=domain, category=classify(url)))
    return list(seen.values())


def to_markdown(records: list[UrlRecord]) -> str:
    groups: dict[str, list[UrlRecord]] = defaultdict(list)
    for r in records:
        groups[r.domain].append(r)

    lines = ["# URL Extraction Report", "", "## Canonical URLs", "", "| URL | Domain | Category |", "|---|---|---|"]
    for r in records:
        lines.append(f"| {r.url} | {r.domain} | {r.category} |")

    lines.extend(["", "## Domain Groups", ""])
    for domain, items in sorted(groups.items()):
        lines.append(f"### {domain}")
        for item in items:
            lines.append(f"- `{item.category}` — {item.url}")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("input", nargs="?", help="Input file. Reads stdin if omitted.")
    parser.add_argument("--markdown", action="store_true", help="Output Markdown report.")
    parser.add_argument("--json", action="store_true", help="Output JSON records.")
    parser.add_argument("--mcp-stdio", action="store_true", help="Reserved placeholder for MCP stdio wrapping.")
    args = parser.parse_args()

    if args.mcp_stdio:
        print("This script is CLI-ready. Wrap it with an MCP adapter before production use.", file=sys.stderr)
        return 2

    if args.input:
        text = Path(args.input).read_text(encoding="utf-8")
    else:
        text = sys.stdin.read()

    records = extract(text)

    if args.json:
        print(json.dumps([asdict(r) for r in records], indent=2))
    else:
        print(to_markdown(records))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
