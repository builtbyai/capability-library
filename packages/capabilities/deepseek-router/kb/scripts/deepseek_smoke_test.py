#!/usr/bin/env python3
"""Minimal DeepSeek OpenAI-compatible smoke test."""

import os
import sys

try:
    from openai import OpenAI
except ImportError:
    print("Install dependency first: pip install openai", file=sys.stderr)
    raise

api_key = os.getenv("DEEPSEEK_API_KEY")
if not api_key:
    raise SystemExit("DEEPSEEK_API_KEY is not set")

client = OpenAI(
    api_key=api_key,
    base_url=os.getenv("DEEPSEEK_OPENAI_BASE_URL", "https://api.deepseek.com"),
)

model = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-pro")

response = client.chat.completions.create(
    model=model,
    messages=[
        {"role": "system", "content": "Return a terse operational status."},
        {"role": "user", "content": "Say DeepSeek smoke test OK."},
    ],
    extra_body={"thinking": {"type": "enabled"}, "reasoning_effort": "high"},
)

print(response.choices[0].message.content)
