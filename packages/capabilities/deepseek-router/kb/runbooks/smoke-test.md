# Runbook — Smoke Test

## API smoke test

```bash
source .env.deepseek
pip install openai
python scripts/deepseek_smoke_test.py
```

Expected result:

```text
DeepSeek smoke test OK
```

## URL extractor smoke test

```bash
cat > /tmp/links.txt <<'EOF'
DeepSeek docs: https://api-docs.deepseek.com/guides/thinking_mode
Claude Code: https://api-docs.deepseek.com/quick_start/agent_integrations/claude_code
EOF
python scripts/url_extractor.py /tmp/links.txt --markdown
```

Expected result: a Markdown table with two canonical URLs.

## Claude Code smoke test

```text
Read README.md and return the project file map. Do not edit files.
```

Then:

```text
Use the url-extractor skill on sources.md and return a grouped link inventory.
```
