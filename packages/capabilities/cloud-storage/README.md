# cloud-storage · _planned_

Google-Drive-style UI over Cloudflare R2: file browser, upload/download, share links, folder structure (R2 has flat keys; we layer folder semantics on top), scheduled sync from local folders / S3 / Google Drive. Includes cron-driven backup workflows.

**Surfaces:** FileBrowser, UploadDropzone, ShareLinkPanel, SyncJobsTable, StorageQuotaCard, TrashBin
**Emits:** `cloud.object.uploaded`, `cloud.object.deleted`, `cloud.object.restored`, `cloud.share-link.created`, `cloud.sync.run.completed`, `cloud.quota.warning`
**Jobs:** `cloud-storage:upload`, `cloud-storage:scheduled-sync`, `cloud-storage:quota-rollup`, `cloud-storage:expire-shares`
**Depends on:** connector-config, scheduler, notify, bulk-media-import

See `docs/sharp-edges.md` for project-specific landmines.
