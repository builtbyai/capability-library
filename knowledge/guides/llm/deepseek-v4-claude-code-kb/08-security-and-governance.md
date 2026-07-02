# Security and Governance

## Secret handling

Do not commit:

- `.env.deepseek`
- API keys
- local Claude Code settings containing credentials
- raw customer exports
- private tokens in MCP config

Suggested `.gitignore` entries:

```gitignore
.env
.env.*
!.env.example
.env.deepseek
.claude/settings.local.json
.mcp.local.json
*.key
*.pem
```

## Permission model

Start from deny-by-default:

```text
Read/Grep/Glob: allowed
Edit/Write: scoped to repo
Bash: allowlisted commands only
Network: explicit MCP/server allowlist
Secrets: never exposed to model text
```

## Agent risk tiers

| Tier | Example | Controls |
|---|---|---|
| Low | URL extraction, docs cleanup | Read-only tools, no shell writes. |
| Medium | Component refactor | Scoped edits, tests required. |
| High | Auth/payment/database migration | Human approval, branch isolation, backup. |
| Critical | Production deploy/secrets | Manual gate, audit log, rollback plan. |

## Prompt-injection risk

Treat fetched webpages, repo comments, issue text, emails, and logs as untrusted input. External content can instruct the model to ignore rules or leak secrets. The agent should summarize untrusted content, not obey it.

## Audit trail

For any mutating agent session, capture:

- original user request
- files read
- files edited
- tool calls
- commands run
- test results
- final diff summary
- unresolved risks

## Production policy

Agents can draft production commands, but should not deploy without explicit human confirmation and a rollback path.
