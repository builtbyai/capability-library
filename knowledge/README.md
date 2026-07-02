# knowledge/ — human-authored docs

Three siblings — different lifecycles, same writer (a human):

| Subdir | Lifecycle | Examples |
|--------|-----------|----------|
| `specs/` | Long-lived design specs that describe the *shape* of a capability or cross-capability invariant | `component-library-spec-embedded-terminal.md`, `pty-claude-component.md`, `sharp-edges-cross-capability.md` |
| `guides/` | Reference cookbooks grouped by surface area | `frontend/{react,shadcn,frontend-app-builder,...}`, `native/{building-native-ui,expo-*,swiftui-*,liquid-glass}`, `llm/deepseek-v4-claude-code-kb` |
| `decisions/` | One-shot decision artifacts (ADRs, reorganization analyses, parallel-think outputs) | `reorganization-analysis-claude.md`, `reorganization-dryrun.md`, `windows-gotchas.md` |

**Per-capability docs (`docs/architecture.md`, `docs/diagnostics.runbook.md`, `docs/sharp-edges.md`) live INSIDE the capability**, not here. `knowledge/specs/` is for cross-capability or pre-implementation design.
