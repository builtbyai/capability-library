# scheduled-r2-sync

**Composes:** scheduler, cloud-storage, notify
**Trigger:** scheduler tick (daily 02:00)
**Summary:** Daily incremental sync from a local folder to R2 with quota-aware throttling + notify on failures.

Wiring recipe; see `recipe.ts`.
