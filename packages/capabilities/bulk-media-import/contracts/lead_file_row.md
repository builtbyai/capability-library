# lead_files row contract

Canonical D1 row written by `fast_upload.mjs`. Schema target: any table with these columns (default name `lead_files`, override via `--table` flag if you fork).

| column                | type      | default            | written by Stage 5 | notes |
|-----------------------|-----------|--------------------|-----|------|
| `id`                  | INTEGER   | AUTOINCREMENT      | no (auto) | primary key |
| `lead_id`             | INTEGER   | NOT NULL           | yes | parsed from `{leadId}_` filename prefix; FK to `storm_leads.id` |
| `file_type`           | TEXT      | NOT NULL           | yes | `'photo'` or `'document'` (from filename `p` / `d`) |
| `file_name`           | TEXT      | NOT NULL           | yes | sanitized basename + ext (filename after `{leadId}_{p|d}{rl_id}_`) |
| `file_size`           | INTEGER   | NOT NULL           | yes | bytes on disk |
| `mime_type`           | TEXT      | NOT NULL           | yes | sniffed from magic bytes (JPEG / PNG / GIF / WebP / PDF) |
| `file_data`           | TEXT      | NOT NULL           | yes | `'r2:' + r2_key` — downstream resolver detects the `r2:` prefix and routes through the worker R2 binding |
| `description`         | TEXT      | NULL               | yes | `'Bulk import \| source_id=<rlId> \| <ISO date>'` |
| `storage_provider`    | TEXT      | `'inline'`         | yes | always `'r2'` from this pipeline |
| `r2_key`              | TEXT      | NULL               | yes | `leads/<leadId>/<uuid>-<baseName>.<ext>` |
| `source_url`          | TEXT      | NULL               | yes | empty by default; can be patched in if you want the original source URL preserved |
| `tags`                | TEXT      | `'[]'`             | yes | empty JSON array; tag in a follow-up UPDATE |
| `visible_to_customer` | INTEGER   | 1                  | yes | hardcoded to `1` (visible) — patch in fast_upload.mjs if you need per-row control |
| `created_at`          | TIMESTAMP | CURRENT_TIMESTAMP  | yes (explicit) | |
| `updated_at`          | TIMESTAMP | CURRENT_TIMESTAMP  | yes (explicit) | |

## R2 key convention

```
leads/{leadId}/{uuid}-{baseName}.{ext}
```

- `leadId`: integer, no padding (matches D1 PK).
- `uuid`: `crypto.randomUUID()` per file. Prevents same-name collisions when a lead has duplicate filenames across imports.
- `baseName.ext`: sanitized + lowercased ext. `safeName()` strips everything outside `[a-zA-Z0-9._-]` and caps at 180 chars.

## URL resolution downstream

The worker's image proxy at `/api/image/proxy/<r2_key>` parses `file_data`:

```js
const r2Key = stored.startsWith('r2:') ? stored.substring(3) : null;
if (r2Key) url = `/api/image/proxy/${r2Key}`;
```

If your downstream worker expects a different `file_data` shape, fork `fast_upload.mjs` and adjust the INSERT template (search for `'r2:'+q.r2Key`).
