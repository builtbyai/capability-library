# DeepSeek V4 Task Skill

Use this skill for task planning when Claude Code is backed by DeepSeek V4.

## Model routing

- Use `deepseek-v4-pro[1m]` for architectural tasks, refactors, migrations, and multi-file debugging.
- Use `deepseek-v4-flash` for extraction, summarization, classification, and narrow helper tasks.

## Procedure

1. Classify task risk: low, medium, high, critical.
2. Select model/effort level.
3. Define acceptance criteria.
4. Read only required context first.
5. Produce execution plan.
6. Execute narrow steps.
7. Verify.
8. Summarize with risks.

## Risk policy

High-risk changes require a human checkpoint before execution:

- auth
- payments
- database migrations
- production deployments
- irreversible data operations
- security-sensitive config

## Output contract

```markdown
## Task Classification
## Acceptance Criteria
## Execution Plan
## Verification Plan
## Completion Summary
```
