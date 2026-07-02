# clipboard-to-intake

**Composes:** clipboard-bridge, intake-pipeline
**Trigger:** user hotkey / clipboard.snapshot.captured
**Summary:** User copies content -> clipboard-bridge snapshots -> intake-pipeline stages -> downstream MIME-routed

This is a wiring recipe. It contains no domain logic.

See [packages/workflows/README.md](../README.md) for the workflow contract.
