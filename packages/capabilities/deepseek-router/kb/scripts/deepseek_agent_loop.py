#!/usr/bin/env python3
"""Tiny illustrative tool-call loop for DeepSeek's OpenAI-compatible API.

This is intentionally minimal. Production usage should add retries, logging,
argument validation, timeout controls, and a full tool registry.
"""

import json
import os
import re
import sys
from typing import Any

from openai import OpenAI


def extract_urls(text: str, dedupe: bool = True) -> dict[str, Any]:
    pattern = re.compile(r"https?://[^\s)\]>'\"]+|mailto:[^\s)\]>'\"]+", re.I)
    urls = [u.rstrip(".,;:!?") for u in pattern.findall(text)]
    if dedupe:
        urls = list(dict.fromkeys(urls))
    return {"urls": urls, "count": len(urls)}


def run_tool(name: str, arguments: str) -> dict[str, Any]:
    args = json.loads(arguments or "{}")
    if name == "extract_urls":
        return extract_urls(**args)
    raise ValueError(f"Unknown tool: {name}")


def main() -> int:
    api_key = os.getenv("DEEPSEEK_API_KEY")
    if not api_key:
        print("DEEPSEEK_API_KEY is not set", file=sys.stderr)
        return 1

    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")

    tools = [
        {
            "type": "function",
            "function": {
                "name": "extract_urls",
                "description": "Extract canonical URLs from arbitrary text.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "text": {"type": "string"},
                        "dedupe": {"type": "boolean"},
                    },
                    "required": ["text"],
                    "additionalProperties": False,
                },
            },
        }
    ]

    user_text = " ".join(sys.argv[1:]) or "Extract links from https://api-docs.deepseek.com and https://api-docs.deepseek.com/guides/thinking_mode"

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": "Use tools when useful. Return concise JSON."},
        {"role": "user", "content": user_text},
    ]

    first = client.chat.completions.create(
        model="deepseek-v4-pro",
        messages=messages,
        tools=tools,
        tool_choice="auto",
        extra_body={"thinking": {"type": "enabled"}, "reasoning_effort": "high"},
    )

    assistant_message = first.choices[0].message
    messages.append(assistant_message.model_dump(exclude_none=True))

    if assistant_message.tool_calls:
        for call in assistant_message.tool_calls:
            result = run_tool(call.function.name, call.function.arguments)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "content": json.dumps(result),
                }
            )

        second = client.chat.completions.create(
            model="deepseek-v4-pro",
            messages=messages,
            tools=tools,
            extra_body={"thinking": {"type": "enabled"}, "reasoning_effort": "high"},
        )
        print(second.choices[0].message.content)
    else:
        print(assistant_message.content)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
