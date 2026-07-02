# Jobs & Events Catalog

> Auto-derived from `packages/capabilities/*/manifest.yaml` on 2026-06-29. Hand-edit and you will lose changes on the next regen.

This file is the cross-capability surface index. Subscribe by event name; dispatch by job name; consume UI by component name.

**Totals:** 211 events · 99 jobs · 178 HTTP endpoints · 6 WS endpoints · 196 UI components · 19 CLI commands across 40 capabilities (2 production-ready, 5 prototype, 33 planned).

## Events emitted

| Event | Emitted by | Risk |
|---|---|---|
| `files.scanned` | ai-file-renamer | filesystem-write |
| `file.rename.proposed` | ai-file-renamer | filesystem-write |
| `file.rename.approved` | ai-file-renamer | filesystem-write |
| `file.renamed` | ai-file-renamer | filesystem-write |
| `file.rename.failed` | ai-file-renamer | filesystem-write |
| `file.rename.rolled-back` | ai-file-renamer | filesystem-write |
| `orch.run.started` | ai-orchestration | external-ai-processing |
| `orch.angle.completed` | ai-orchestration | external-ai-processing |
| `orch.synthesis.completed` | ai-orchestration | external-ai-processing |
| `orch.run.completed` | ai-orchestration | external-ai-processing |
| `orch.run.failed` | ai-orchestration | external-ai-processing |
| `booking.availability.queried` | booking-scheduler | sensitive-data |
| `booking.created` | booking-scheduler | sensitive-data |
| `booking.confirmed` | booking-scheduler | sensitive-data |
| `booking.cancelled` | booking-scheduler | sensitive-data |
| `booking.rescheduled` | booking-scheduler | sensitive-data |
| `booking.reminder.sent` | booking-scheduler | sensitive-data |
| `booking.no-show` | booking-scheduler | sensitive-data |
| `bulk-import.run.started` | bulk-media-import | filesystem-write |
| `bulk-import.file.uploaded` | bulk-media-import | filesystem-write |
| `bulk-import.run.completed` | bulk-media-import | filesystem-write |
| `bulk-import.run.failed` | bulk-media-import | filesystem-write |
| `clipboard.snapshot.captured` | clipboard-bridge | sensitive-data |
| `clipboard.write.requested` | clipboard-bridge | sensitive-data |
| `clipboard.write.completed` | clipboard-bridge | sensitive-data |
| `cloud.object.uploaded` | cloud-storage | sensitive-data |
| `cloud.object.deleted` | cloud-storage | sensitive-data |
| `cloud.object.restored` | cloud-storage | sensitive-data |
| `cloud.share-link.created` | cloud-storage | sensitive-data |
| `cloud.sync.run.completed` | cloud-storage | sensitive-data |
| `cloud.quota.warning` | cloud-storage | sensitive-data |
| `cf.deploy.requested` | cloudflare-deploy | privileged |
| `cf.deploy.completed` | cloudflare-deploy | privileged |
| `cf.deploy.failed` | cloudflare-deploy | privileged |
| `cf.deploy.hash-verified` | cloudflare-deploy | privileged |
| `cf.rollback.completed` | cloudflare-deploy | privileged |
| `connector.created` | connector-config | sensitive-data |
| `connector.tested` | connector-config | sensitive-data |
| `connector.health.changed` | connector-config | sensitive-data |
| `connector.deleted` | connector-config | sensitive-data |
| `connector.secret.rotated` | connector-config | sensitive-data |
| `dashboard.item.pinned` | content-dashboard | normal |
| `dashboard.item.tagged` | content-dashboard | normal |
| `dashboard.workflow.triggered` | content-dashboard | normal |
| `document.uploaded` | document-ingestion | data-processing |
| `document.preserved` | document-ingestion | data-processing |
| `document.extraction.started` | document-ingestion | data-processing |
| `document.page.extracted` | document-ingestion | data-processing |
| `document.page.failed` | document-ingestion | data-processing |
| `document.table.extracted` | document-ingestion | data-processing |
| `document.normalized` | document-ingestion | data-processing |
| `document.chunked` | document-ingestion | data-processing |
| `document.enriched` | document-ingestion | data-processing |
| `document.indexed` | document-ingestion | data-processing |
| `document.ingestion.failed` | document-ingestion | data-processing |
| `esig.session.started` | e-signature | sensitive-data |
| `esig.contract.selected` | e-signature | sensitive-data |
| `esig.terms.accepted` | e-signature | sensitive-data |
| `esig.party.signed` | e-signature | sensitive-data |
| `esig.session.completed` | e-signature | sensitive-data |
| `esig.session.abandoned` | e-signature | sensitive-data |
| `esig.verify.failed` | e-signature | sensitive-data |
| `email.connected` | email-connector | sensitive-data |
| `email.disconnected` | email-connector | sensitive-data |
| `email.sync.started` | email-connector | sensitive-data |
| `email.sync.completed` | email-connector | sensitive-data |
| `email.sync.failed` | email-connector | sensitive-data |
| `email.message.received` | email-connector | sensitive-data |
| `email.attachment.detected` | email-connector | sensitive-data |
| `email.classified` | email-connector | sensitive-data |
| `email.oauth.token.refreshed` | email-connector | sensitive-data |
| `search.query.received` | everything-search | filesystem-read |
| `search.results.delivered` | everything-search | filesystem-read |
| `search.indexer.refreshed` | everything-search | filesystem-read |
| `fleet.machine.unreachable` | fleet-control | privileged |
| `fleet.machine.recovered` | fleet-control | privileged |
| `fleet.service.failed` | fleet-control | privileged |
| `fleet.gui.action.completed` | fleet-control | privileged |
| `fleet.metrics.snapshot` | fleet-control | privileged |
| `geo.layer.created` | geo-visualization | normal |
| `geo.layer.imported` | geo-visualization | normal |
| `geo.layer.exported` | geo-visualization | normal |
| `geo.feature.created` | geo-visualization | normal |
| `geo.feature.updated` | geo-visualization | normal |
| `geo.feature.deleted` | geo-visualization | normal |
| `geo.feature.selected` | geo-visualization | normal |
| `geo.place.geocoded` | geo-visualization | normal |
| `geo.kml.watch.refreshed` | geo-visualization | normal |
| `gpu.snapshot` | gpu-router | external-ai-processing |
| `gpu.routed` | gpu-router | external-ai-processing |
| `gpu.host.overloaded` | gpu-router | external-ai-processing |
| `gvoice.sms.sent` | gvoice-relay | sensitive-data |
| `gvoice.sms.received` | gvoice-relay | sensitive-data |
| `gvoice.delivery.failed` | gvoice-relay | sensitive-data |
| `gvoice.session.expired` | gvoice-relay | sensitive-data |
| `intake.object.received` | intake-pipeline | filesystem-write |
| `intake.object.stored` | intake-pipeline | filesystem-write |
| `intake.object.routed` | intake-pipeline | filesystem-write |
| `intake.object.rejected` | intake-pipeline | filesystem-write |
| `knowledge.chunk.created` | knowledge-index | knowledge-index |
| `knowledge.chunk.embedded` | knowledge-index | knowledge-index |
| `knowledge.chunk.embed.failed` | knowledge-index | knowledge-index |
| `knowledge.index.updated` | knowledge-index | knowledge-index |
| `knowledge.query.received` | knowledge-index | knowledge-index |
| `knowledge.sources.retrieved` | knowledge-index | knowledge-index |
| `knowledge.reindex.started` | knowledge-index | knowledge-index |
| `knowledge.reindex.completed` | knowledge-index | knowledge-index |
| `pty:send-to-claude` | local-agent-terminal | privileged |
| `gen.run.started` | media-generation | external-ai-processing |
| `gen.asset.created` | media-generation | external-ai-processing |
| `gen.run.completed` | media-generation | external-ai-processing |
| `gen.run.failed` | media-generation | external-ai-processing |
| `gen.run.refunded` | media-generation | external-ai-processing |
| `media.uploaded` | media-processing | external-ai-processing |
| `media.processing.started` | media-processing | external-ai-processing |
| `media.variant.created` | media-processing | external-ai-processing |
| `media.processing.failed` | media-processing | external-ai-processing |
| `media.variant.rolled-back` | media-processing | external-ai-processing |
| `mega.mount.started` | mega-mount | filesystem-write |
| `mega.mount.stopped` | mega-mount | filesystem-write |
| `mega.mount.hung` | mega-mount | filesystem-write |
| `mega.mount.recovered` | mega-mount | filesystem-write |
| `notification.sent` | notify | sensitive-data |
| `notification.delivery.failed` | notify | sensitive-data |
| `notification.dropped` | notify | sensitive-data |
| `og-proxy.request.intercepted` | og-unfurl-proxy | network-bridge |
| `og-proxy.crawler.detected` | og-unfurl-proxy | network-bridge |
| `og-proxy.upstream.failed` | og-unfurl-proxy | network-bridge |
| `paypal.order.created` | paypal-payments | sensitive-data |
| `paypal.order.captured` | paypal-payments | sensitive-data |
| `paypal.subscription.activated` | paypal-payments | sensitive-data |
| `paypal.subscription.cancelled` | paypal-payments | sensitive-data |
| `paypal.webhook.received` | paypal-payments | sensitive-data |
| `paypal.webhook.verified` | paypal-payments | sensitive-data |
| `paypal.token.refreshed` | paypal-payments | sensitive-data |
| `replicate.prediction.started` | replicate-api | external-ai-processing |
| `replicate.prediction.output` | replicate-api | external-ai-processing |
| `replicate.prediction.completed` | replicate-api | external-ai-processing |
| `replicate.training.started` | replicate-api | external-ai-processing |
| `replicate.training.completed` | replicate-api | external-ai-processing |
| `scheduler.job.scheduled` | scheduler | scheduled-automation |
| `scheduler.job.started` | scheduler | scheduled-automation |
| `scheduler.job.completed` | scheduler | scheduled-automation |
| `scheduler.job.failed` | scheduler | scheduled-automation |
| `scheduler.job.retrying` | scheduler | scheduled-automation |
| `scheduler.job.disabled` | scheduler | scheduled-automation |
| `scheduler.tick` | scheduler | scheduled-automation |
| `screenshot.captured` | screenshot-capture | filesystem-write |
| `screenshot.normalized` | screenshot-capture | filesystem-write |
| `screenshot.failed` | screenshot-capture | filesystem-write |
| `digest.requested` | session-digest | external-ai-processing |
| `digest.generated` | session-digest | external-ai-processing |
| `digest.html-rendered` | session-digest | external-ai-processing |
| `digest.caveman-rendered` | session-digest | external-ai-processing |
| `digest.sent` | session-digest | external-ai-processing |
| `digest.failed` | session-digest | external-ai-processing |
| `storm.query.completed` | storm-data | sensitive-data |
| `storm.event.matched` | storm-data | sensitive-data |
| `storm.cache.refreshed` | storm-data | sensitive-data |
| `storm.provider.degraded` | storm-data | sensitive-data |
| `sysmon.alert.cpu-spike` | system-monitor | privileged |
| `sysmon.alert.memory-pressure` | system-monitor | privileged |
| `sysmon.alert.disk-full` | system-monitor | privileged |
| `sysmon.process.killed` | system-monitor | privileged |
| `sysmon.service.restarted` | system-monitor | privileged |
| `transcription.requested` | transcription | data-processing |
| `transcription.started` | transcription | data-processing |
| `transcription.segment.created` | transcription | data-processing |
| `transcription.completed` | transcription | data-processing |
| `transcription.failed` | transcription | data-processing |
| `vec.embedded` | vectorize | sensitive-data |
| `vec.embed.failed` | vectorize | sensitive-data |
| `vec.cluster.completed` | vectorize | sensitive-data |
| `clip.captured` | web-clipper | sensitive-data |
| `clip.normalized` | web-clipper | sensitive-data |
| `clip.failed` | web-clipper | sensitive-data |
| `rtc.room.created` | webrtc-stream | network-bridge |
| `rtc.room.opened` | webrtc-stream | network-bridge |
| `rtc.room.ended` | webrtc-stream | network-bridge |
| `rtc.room.expired` | webrtc-stream | network-bridge |
| `rtc.peer.joined` | webrtc-stream | network-bridge |
| `rtc.peer.left` | webrtc-stream | network-bridge |
| `rtc.peer.kicked` | webrtc-stream | network-bridge |
| `rtc.session.opened` | webrtc-stream | network-bridge |
| `rtc.peer.connected` | webrtc-stream | network-bridge |
| `rtc.peer.disconnected` | webrtc-stream | network-bridge |
| `rtc.stats.tick` | webrtc-stream | network-bridge |
| `rtc.signaling.failed` | webrtc-stream | network-bridge |
| `rtc.chat.message.sent` | webrtc-stream | network-bridge |
| `rtc.chat.message.received` | webrtc-stream | network-bridge |
| `whatsapp.message.received` | whatsapp-bridge | sensitive-data |
| `whatsapp.message.sent` | whatsapp-bridge | sensitive-data |
| `whatsapp.media.received` | whatsapp-bridge | sensitive-data |
| `whatsapp.delivery.failed` | whatsapp-bridge | sensitive-data |
| `widget.added` | widget-framework | normal |
| `widget.removed` | widget-framework | normal |
| `widget.moved` | widget-framework | normal |
| `widget.resized` | widget-framework | normal |
| `layout.saved` | widget-framework | normal |
| `wctl.action.completed` | windows-control | privileged |
| `wctl.action.denied` | windows-control | privileged |
| `wctl.uia.click.miss` | windows-control | privileged |
| `wctl.ocr.completed` | windows-control | privileged |

## Jobs declared

| Job | Owner capability |
|---|---|
| `ai-file-renamer:scan` | ai-file-renamer |
| `ai-file-renamer:propose` | ai-file-renamer |
| `ai-file-renamer:apply` | ai-file-renamer |
| `ai-file-renamer:rollback` | ai-file-renamer |
| `ai-orchestration:parallel-think` | ai-orchestration |
| `ai-orchestration:parallel-synthesis` | ai-orchestration |
| `ai-orchestration:devils-advocate` | ai-orchestration |
| `ai-orchestration:multi-model-consensus` | ai-orchestration |
| `booking-scheduler:create` | booking-scheduler |
| `booking-scheduler:send-reminder` | booking-scheduler |
| `booking-scheduler:detect-no-show` | booking-scheduler |
| `booking-scheduler:cancel` | booking-scheduler |
| `clipboard-bridge:snapshot` | clipboard-bridge |
| `clipboard-bridge:write` | clipboard-bridge |
| `cloud-storage:upload` | cloud-storage |
| `cloud-storage:scheduled-sync` | cloud-storage |
| `cloud-storage:quota-rollup` | cloud-storage |
| `cloud-storage:expire-shares` | cloud-storage |
| `cloudflare-deploy:pages` | cloudflare-deploy |
| `cloudflare-deploy:worker` | cloudflare-deploy |
| `cloudflare-deploy:d1-migrate` | cloudflare-deploy |
| `cloudflare-deploy:rollback` | cloudflare-deploy |
| `content-dashboard:rebuild-index` | content-dashboard |
| `content-dashboard:digest-daily` | content-dashboard |
| `e-signature:render-pdf` | e-signature |
| `e-signature:verify-hash` | e-signature |
| `e-signature:notify-counterparties` | e-signature |
| `everything-search:query` | everything-search |
| `everything-search:refresh-index` | everything-search |
| `everything-search:open-result` | everything-search |
| `fleet-control:health-rollup` | fleet-control |
| `fleet-control:gui-dispatch` | fleet-control |
| `fleet-control:restart-service` | fleet-control |
| `gpu-router:route` | gpu-router |
| `gpu-router:rebalance` | gpu-router |
| `gvoice-relay:send` | gvoice-relay |
| `gvoice-relay:poll-inbox` | gvoice-relay |
| `gvoice-relay:refresh-session` | gvoice-relay |
| `media-generation:image` | media-generation |
| `media-generation:video` | media-generation |
| `media-generation:upscale` | media-generation |
| `media-processing:upscale` | media-processing |
| `media-processing:transcode` | media-processing |
| `mega-mount:start` | mega-mount |
| `mega-mount:stop` | mega-mount |
| `mega-mount:watchdog` | mega-mount |
| `notify:dispatch` | notify |
| `og-unfurl-proxy:deploy-worker` | og-unfurl-proxy |
| `og-unfurl-proxy:test-route` | og-unfurl-proxy |
| `paypal-payments:capture` | paypal-payments |
| `paypal-payments:verify-webhook` | paypal-payments |
| `paypal-payments:sync-subscriptions` | paypal-payments |
| `screenshot-capture:fromUrl` | screenshot-capture |
| `screenshot-capture:fromDesktop` | screenshot-capture |
| `session-digest:generate` | session-digest |
| `session-digest:render-html` | session-digest |
| `session-digest:render-caveman` | session-digest |
| `session-digest:send` | session-digest |
| `storm-data:query` | storm-data |
| `storm-data:cache-refresh` | storm-data |
| `system-monitor:rollup-snapshot` | system-monitor |
| `system-monitor:cleanup-tmp` | system-monitor |
| `system-monitor:kill-process` | system-monitor |
| `transcription:run` | transcription |
| `transcription:diarize` | transcription |
| `vectorize:embed-batch` | vectorize |
| `vectorize:dedup` | vectorize |
| `vectorize:cluster` | vectorize |
| `webrtc-stream:create-room` | webrtc-stream |
| `webrtc-stream:end-room` | webrtc-stream |
| `webrtc-stream:open-session` | webrtc-stream |
| `webrtc-stream:close-session` | webrtc-stream |
| `webrtc-stream:capture-snapshot` | webrtc-stream |
| `webrtc-stream:cleanup-expired-rooms` | webrtc-stream |
| `whatsapp-bridge:send` | whatsapp-bridge |
| `whatsapp-bridge:syncChats` | whatsapp-bridge |
| `widget-framework:persist-layout` | widget-framework |
| `widget-framework:reset-defaults` | widget-framework |
| `windows-control:dispatch` | windows-control |
| `windows-control:capture-uia-tree` | windows-control |

## API endpoints

| Endpoint | Capability |
|---|---|
| `POST /api/rename/scan` | ai-file-renamer |
| `POST /api/rename/:batchId/propose` | ai-file-renamer |
| `POST /api/rename/:batchId/apply` | ai-file-renamer |
| `POST /api/rename/:batchId/rollback` | ai-file-renamer |
| `POST /api/orch/parallel-think` | ai-orchestration |
| `POST /api/orch/parallel-agent-synthesis` | ai-orchestration |
| `POST /api/orch/devils-advocate` | ai-orchestration |
| `POST /api/orch/multi-model-consensus` | ai-orchestration |
| `GET  /api/orch/runs/:runId` | ai-orchestration |
| `GET  /api/availability` | booking-scheduler |
| `POST /api/book` | booking-scheduler |
| `GET  /api/bookings/:bookingId` | booking-scheduler |
| `POST /api/bookings/:bookingId/cancel` | booking-scheduler |
| `POST /api/bookings/:bookingId/reschedule` | booking-scheduler |
| `GET  /api/join/:bookingId` | booking-scheduler |
| `POST /api/clipboard/snapshot` | clipboard-bridge |
| `GET  /api/clipboard/history` | clipboard-bridge |
| `POST /api/clipboard/write` | clipboard-bridge |
| `GET /api/cloud/buckets/:bucket` | cloud-storage |
| `POST /api/cloud/buckets/:bucket/upload` | cloud-storage |
| `GET /api/cloud/buckets/:bucket/objects/:key` | cloud-storage |
| `POST /api/cloud/share` | cloud-storage |
| `DELETE /api/cloud/buckets/:bucket/objects/:key` | cloud-storage |
| `POST /api/cloud/sync/schedule` | cloud-storage |
| `GET /api/cloud/sync/jobs` | cloud-storage |
| `POST /api/cloud/restore-from-trash` | cloud-storage |
| `POST /api/cf/deploy/pages` | cloudflare-deploy |
| `POST /api/cf/deploy/worker` | cloudflare-deploy |
| `POST /api/cf/d1/migrate` | cloudflare-deploy |
| `POST /api/cf/rollback/:deployId` | cloudflare-deploy |
| `GET  /api/cf/deploys` | cloudflare-deploy |
| `GET  /api/cf/deploys/:deployId/verify` | cloudflare-deploy |
| `POST /api/connectors` | connector-config |
| `POST /api/connectors/:id/test` | connector-config |
| `GET  /api/connectors` | connector-config |
| `GET  /api/connectors/:id` | connector-config |
| `DELETE /api/connectors/:id` | connector-config |
| `POST /api/connectors/:id/secrets` | connector-config |
| `GET /api/dashboard/feed` | content-dashboard |
| `POST /api/dashboard/items/:id/pin` | content-dashboard |
| `POST /api/dashboard/items/:id/tag` | content-dashboard |
| `POST /api/dashboard/items/:id/trigger-workflow` | content-dashboard |
| `GET /api/dashboard/stats` | content-dashboard |
| `POST /api/documents/ingest` | document-ingestion |
| `GET  /api/documents/:documentId` | document-ingestion |
| `GET  /api/documents/:documentId/pages` | document-ingestion |
| `GET  /api/documents/:documentId/chunks` | document-ingestion |
| `POST /api/documents/:documentId/retry-page` | document-ingestion |
| `POST /api/esig/sessions` | e-signature |
| `GET  /api/esig/sessions/:sessionId` | e-signature |
| `POST /api/esig/sessions/:sessionId/sign` | e-signature |
| `GET  /api/esig/sessions/:sessionId/receipt.pdf` | e-signature |
| `POST /api/esig/verify` | e-signature |
| `GET  /api/esig/audit/:sessionId` | e-signature |
| `POST /api/email/connect` | email-connector |
| `GET  /api/email/oauth/callback` | email-connector |
| `POST /api/email/:accountId/sync` | email-connector |
| `GET  /api/email/messages` | email-connector |
| `GET  /api/email/:accountId/status` | email-connector |
| `POST /api/email/:accountId/disconnect` | email-connector |
| `GET /api/search` | everything-search |
| `GET /api/search/extensions` | everything-search |
| `GET /api/search/recent` | everything-search |
| `POST /api/search/index-refresh` | everything-search |
| `GET  /api/fleet/machines` | fleet-control |
| `GET  /api/fleet/machines/:host/identity` | fleet-control |
| `GET  /api/fleet/machines/:host/health` | fleet-control |
| `GET  /api/fleet/machines/:host/services` | fleet-control |
| `POST /api/fleet/machines/:host/gui/screenshot` | fleet-control |
| `POST /api/fleet/machines/:host/gui/click` | fleet-control |
| `POST /api/fleet/machines/:host/gui/type` | fleet-control |
| `POST /api/fleet/machines/:host/restart-service` | fleet-control |
| `POST /api/geo/layers` | geo-visualization |
| `GET  /api/geo/layers` | geo-visualization |
| `GET  /api/geo/layers/:id` | geo-visualization |
| `POST /api/geo/layers/:id/features` | geo-visualization |
| `POST /api/geo/layers/:id/import.kml` | geo-visualization |
| `POST /api/geo/layers/:id/import.geojson` | geo-visualization |
| `GET  /api/geo/layers/:id/export.kml` | geo-visualization |
| `GET  /api/geo/layers/:id/export.geojson` | geo-visualization |
| `POST /api/geo/geocode` | geo-visualization |
| `DELETE /api/geo/features/:id` | geo-visualization |
| `GET  /api/gpu/snapshot` | gpu-router |
| `POST /api/gpu/route` | gpu-router |
| `GET  /api/gpu/routing-history` | gpu-router |
| `POST /api/gvoice/send` | gvoice-relay |
| `GET /api/gvoice/messages` | gvoice-relay |
| `GET /api/gvoice/health` | gvoice-relay |
| `POST /api/gvoice/test` | gvoice-relay |
| `POST /api/intake` | intake-pipeline |
| `POST /api/intake/url` | intake-pipeline |
| `GET  /api/intake/:objectId` | intake-pipeline |
| `GET  /api/intake/:objectId/bytes` | intake-pipeline |
| `WS   /ws/intake/feed` | intake-pipeline |
| `POST /api/knowledge/chunks` | knowledge-index |
| `POST /api/knowledge/query` | knowledge-index |
| `GET  /api/knowledge/index-status` | knowledge-index |
| `POST /api/knowledge/reindex` | knowledge-index |
| `DELETE /api/knowledge/document/:documentId` | knowledge-index |
| `POST /api/pty/create` | local-agent-terminal |
| `POST /api/pty/attach` | local-agent-terminal |
| `POST /api/pty/close` | local-agent-terminal |
| `GET  /api/pty/bridge-status` | local-agent-terminal |
| `WS   /ws/terminal/:sessionId` | local-agent-terminal |
| `WS   /v1/pty/client` | local-agent-terminal |
| `WS   /v1/pty/bridge` | local-agent-terminal |
| `GET  /v1/pty/status` | local-agent-terminal |
| `POST /api/gen/image` | media-generation |
| `POST /api/gen/video` | media-generation |
| `POST /api/gen/upscale` | media-generation |
| `GET /api/gen/runs` | media-generation |
| `GET /api/gen/runs/:runId` | media-generation |
| `POST /api/media/assets` | media-processing |
| `POST /api/media/:assetId/process` | media-processing |
| `GET  /api/media/:assetId/variants` | media-processing |
| `POST /api/media/:assetId/rollback` | media-processing |
| `POST /api/mega/mount/start` | mega-mount |
| `POST /api/mega/mount/stop` | mega-mount |
| `GET /api/mega/mount/status` | mega-mount |
| `POST /api/mega/mount/watchdog-tick` | mega-mount |
| `POST /api/notify` | notify |
| `POST /api/notify/rules` | notify |
| `GET  /api/notify/history` | notify |
| `POST /api/notify/test` | notify |
| `POST /api/og-proxy/routes` | og-unfurl-proxy |
| `GET /api/og-proxy/routes` | og-unfurl-proxy |
| `GET /api/og-proxy/hits` | og-unfurl-proxy |
| `POST /api/og-proxy/test-unfurl` | og-unfurl-proxy |
| `POST /api/paypal/orders` | paypal-payments |
| `GET /api/paypal/orders/:orderId` | paypal-payments |
| `POST /api/paypal/orders/:orderId/capture` | paypal-payments |
| `POST /api/paypal/products` | paypal-payments |
| `POST /api/paypal/plans` | paypal-payments |
| `POST /api/paypal/subscriptions` | paypal-payments |
| `GET /api/paypal/subscriptions` | paypal-payments |
| `POST /api/paypal/webhooks/verify` | paypal-payments |
| `POST /api/paypal/mode/switch` | paypal-payments |
| `predictions.create` | replicate-api |
| `predictions.get` | replicate-api |
| `predictions.list` | replicate-api |
| `predictions.cancel` | replicate-api |
| `models.create` | replicate-api |
| `models.get` | replicate-api |
| `models.list` | replicate-api |
| `models.update` | replicate-api |
| `models.search` | replicate-api |
| `models.delete` | replicate-api |
| `models.examples.list` | replicate-api |
| `models.predictions.create` | replicate-api |
| `models.readme.get` | replicate-api |
| `models.versions.get` | replicate-api |
| `models.versions.list` | replicate-api |
| `models.versions.delete` | replicate-api |
| `collections.get` | replicate-api |
| `collections.list` | replicate-api |
| `deployments.create` | replicate-api |
| `deployments.get` | replicate-api |
| `deployments.list` | replicate-api |
| `deployments.update` | replicate-api |
| `deployments.delete` | replicate-api |
| `deployments.predictions.create` | replicate-api |
| `trainings.create` | replicate-api |
| `trainings.get` | replicate-api |
| `trainings.list` | replicate-api |
| `trainings.cancel` | replicate-api |
| `hardware.list` | replicate-api |
| `account.get` | replicate-api |
| `webhooks.default.secret.get` | replicate-api |
| `search` | replicate-api |
| `POST /api/scheduler/jobs` | scheduler |
| `POST /api/scheduler/jobs/:id/run` | scheduler |
| `GET  /api/scheduler/jobs/:id/runs` | scheduler |
| `POST /api/scheduler/jobs/:id/disable` | scheduler |
| `GET  /api/scheduler/health` | scheduler |
| `POST /api/screenshot/url` | screenshot-capture |
| `POST /api/screenshot/desktop` | screenshot-capture |
| `POST /api/screenshot/region` | screenshot-capture |
| `GET  /api/screenshot/history` | screenshot-capture |
| `POST /api/digest/generate` | session-digest |
| `GET  /api/digest/:digestId` | session-digest |
| `GET  /api/digest/:digestId/html?variant=desktop\|mobile` | session-digest |
| `GET  /api/digest/:digestId/caveman.md` | session-digest |
| `POST /api/digest/:digestId/send` | session-digest |
| `POST /api/storm/query` | storm-data |
| `GET /api/storm/events/:eventId` | storm-data |
| `GET /api/storm/providers/health` | storm-data |
| `POST /api/storm/refresh-cache` | storm-data |
| `GET /api/sysmon/cpu` | system-monitor |
| `GET /api/sysmon/memory` | system-monitor |
| `GET /api/sysmon/network` | system-monitor |
| `GET /api/sysmon/storage` | system-monitor |
| `GET /api/sysmon/processes` | system-monitor |
| `POST /api/sysmon/processes/:pid/kill` | system-monitor |
| `GET /api/sysmon/services` | system-monitor |
| `POST /api/sysmon/services/:name/restart` | system-monitor |
| `POST /api/transcription/jobs` | transcription |
| `GET  /api/transcription/jobs/:id` | transcription |
| `GET  /api/transcription/jobs/:id/segments` | transcription |
| `POST /api/transcription/jobs/:id/relabel-speaker` | transcription |
| `POST /api/vec/embed` | vectorize |
| `POST /api/vec/similar` | vectorize |
| `POST /api/vec/cluster` | vectorize |
| `GET /api/vec/models` | vectorize |
| `POST /api/vec/dedupe` | vectorize |
| `POST /api/clip` | web-clipper |
| `GET  /api/clip/templates` | web-clipper |
| `POST /api/clip/templates` | web-clipper |
| `PUT  /api/clip/templates/:id` | web-clipper |
| `DELETE /api/clip/templates/:id` | web-clipper |
| `GET  /api/clip/history?domain=` | web-clipper |
| `POST /api/rtc/rooms` | webrtc-stream |
| `GET  /api/rtc/rooms/:slug` | webrtc-stream |
| `GET  /j/:slug` | webrtc-stream |
| `POST /api/rtc/rooms/:roomId/end` | webrtc-stream |
| `GET  /api/rtc/rooms/:roomId/participants` | webrtc-stream |
| `POST /api/rtc/sessions` | webrtc-stream |
| `POST /api/rtc/sessions/:id/offer` | webrtc-stream |
| `POST /api/rtc/sessions/:id/answer` | webrtc-stream |
| `POST /api/rtc/sessions/:id/ice` | webrtc-stream |
| `GET  /api/rtc/sessions/:id` | webrtc-stream |
| `POST /api/rtc/rooms/:roomId/messages` | webrtc-stream |
| `GET  /api/rtc/rooms/:roomId/messages?since=:cursor` | webrtc-stream |
| `POST /api/whatsapp/messages` | whatsapp-bridge |
| `GET  /api/whatsapp/chats` | whatsapp-bridge |
| `GET  /api/whatsapp/chats/:chatId/messages` | whatsapp-bridge |
| `POST /api/whatsapp/chats/:chatId/media` | whatsapp-bridge |
| `POST /api/whatsapp/search/contacts` | whatsapp-bridge |
| `GET /api/widgets/layout` | widget-framework |
| `POST /api/widgets/layout` | widget-framework |
| `GET /api/widgets/registry` | widget-framework |
| `POST /api/widgets/registry/:widgetId/enable` | widget-framework |
| `POST /api/wctl/screenshot` | windows-control |
| `POST /api/wctl/click` | windows-control |
| `POST /api/wctl/uia-click` | windows-control |
| `POST /api/wctl/type` | windows-control |
| `POST /api/wctl/ocr` | windows-control |
| `POST /api/wctl/template-match` | windows-control |
| `POST /api/wctl/window` | windows-control |

## UI surfaces

| Component | Capability |
|---|---|
| `RenameDropzone` | ai-file-renamer |
| `RenamePreviewTable` | ai-file-renamer |
| `ConflictResolver` | ai-file-renamer |
| `RenameRuleEditor` | ai-file-renamer |
| `DryRunApplyBar` | ai-file-renamer |
| `StrategyPicker` | ai-orchestration |
| `AngleViewer` | ai-orchestration |
| `ConsensusInspector` | ai-orchestration |
| `JudgeOutputPanel` | ai-orchestration |
| `SchedulerModal` | booking-scheduler |
| `SchedulerPage` | booking-scheduler |
| `Step1Service` | booking-scheduler |
| `Step2Date` | booking-scheduler |
| `Step3Time` | booking-scheduler |
| `Step4Details` | booking-scheduler |
| `Step5Confirm` | booking-scheduler |
| `ConfirmedBanner` | booking-scheduler |
| `ClipboardSnapshotButton` | clipboard-bridge |
| `ClipboardHistoryDrawer` | clipboard-bridge |
| `PasteTargetPicker` | clipboard-bridge |
| `FileBrowser` | cloud-storage |
| `UploadDropzone` | cloud-storage |
| `ShareLinkPanel` | cloud-storage |
| `SyncJobsTable` | cloud-storage |
| `StorageQuotaCard` | cloud-storage |
| `TrashBin` | cloud-storage |
| `DeployButton` | cloudflare-deploy |
| `DeployHistoryTable` | cloudflare-deploy |
| `BuildLogViewer` | cloudflare-deploy |
| `RollbackPanel` | cloudflare-deploy |
| `HashVerifyBadge` | cloudflare-deploy |
| `ConnectorCard` | connector-config |
| `SecretInput` | connector-config |
| `TestConnectionButton` | connector-config |
| `ConnectionStatusBadge` | connector-config |
| `PermissionScopeViewer` | connector-config |
| `ConnectorList` | connector-config |
| `FeedView` | content-dashboard |
| `FeedItem` | content-dashboard |
| `FilterSidebar` | content-dashboard |
| `TagEditor` | content-dashboard |
| `WorkflowTriggerButton` | content-dashboard |
| `StatsHeader` | content-dashboard |
| `PdfDropzone` | document-ingestion |
| `ImportProgressTimeline` | document-ingestion |
| `ExtractionPreview` | document-ingestion |
| `PageImageViewer` | document-ingestion |
| `ChunkInspector` | document-ingestion |
| `FailedPageReviewPanel` | document-ingestion |
| `ESignaturePortal` | e-signature |
| `Stepper` | e-signature |
| `ContractSelector` | e-signature |
| `TermsReview` | e-signature |
| `SignaturePad` | e-signature |
| `SignatureReceipt` | e-signature |
| `AuditTrailViewer` | e-signature |
| `EmailConnectorCard` | email-connector |
| `MailboxPicker` | email-connector |
| `SyncStatusPanel` | email-connector |
| `EmailThreadViewer` | email-connector |
| `AttachmentImportButton` | email-connector |
| `OAuthCallbackHandler` | email-connector |
| `SearchBox` | everything-search |
| `ResultsList` | everything-search |
| `FilterChips` | everything-search |
| `ExtensionPicker` | everything-search |
| `RecentSearches` | everything-search |
| `FleetDashboard` | fleet-control |
| `MachineCard` | fleet-control |
| `ServiceStatusGrid` | fleet-control |
| `GuiActionPanel` | fleet-control |
| `FleetMetricsChart` | fleet-control |
| `MapCanvas` | geo-visualization |
| `LayerControl` | geo-visualization |
| `MarkerClusterLayer` | geo-visualization |
| `GeoJsonLayer` | geo-visualization |
| `KmlLayer` | geo-visualization |
| `DrawingTools` | geo-visualization |
| `PlaceSearchBox` | geo-visualization |
| `CoordinateInspector` | geo-visualization |
| `GpuStatusGrid` | gpu-router |
| `GpuRoutingPanel` | gpu-router |
| `GpuMemoryChart` | gpu-router |
| `ModelPoolViewer` | gpu-router |
| `GvoiceStatusCard` | gvoice-relay |
| `SmsHistoryTable` | gvoice-relay |
| `TestRecipientPicker` | gvoice-relay |
| `HmacKeyRotator` | gvoice-relay |
| `IntakeDropzone` | intake-pipeline |
| `IntakeFeed` | intake-pipeline |
| `IntakeObjectInspector` | intake-pipeline |
| `KnowledgeSearchBox` | knowledge-index |
| `SourceCitationPanel` | knowledge-index |
| `ChunkViewer` | knowledge-index |
| `RAGDebugInspector` | knowledge-index |
| `IndexStatusCard` | knowledge-index |
| `PtyTerminal` | local-agent-terminal |
| `GenerationPanel` | media-generation |
| `PromptHistoryTable` | media-generation |
| `BackendPicker` | media-generation |
| `AssetGrid` | media-generation |
| `PromptTemplateEditor` | media-generation |
| `CostMeter` | media-generation |
| `MediaUploadPanel` | media-processing |
| `BeforeAfterCompare` | media-processing |
| `VariantGrid` | media-processing |
| `ProcessingStatus` | media-processing |
| `ExportButton` | media-processing |
| `MountStatusCard` | mega-mount |
| `MountActionPanel` | mega-mount |
| `WatchdogLogViewer` | mega-mount |
| `NotificationCenter` | notify |
| `ChannelRoutingEditor` | notify |
| `AlertRuleEditor` | notify |
| `ToastHost` | notify |
| `ProxyStatusCard` | og-unfurl-proxy |
| `CrawlerHitChart` | og-unfurl-proxy |
| `UASpoofConfigEditor` | og-unfurl-proxy |
| `RouteListPanel` | og-unfurl-proxy |
| `PayPalDashboard` | paypal-payments |
| `SubscriptionsTable` | paypal-payments |
| `OrdersTable` | paypal-payments |
| `WebhookEventLog` | paypal-payments |
| `EnvironmentSwitcher` | paypal-payments |
| `ProductCatalog` | paypal-payments |
| `PlanBuilder` | paypal-payments |
| `CronExpressionEditor` | scheduler |
| `ScheduleBuilder` | scheduler |
| `JobList` | scheduler |
| `JobRunHistory` | scheduler |
| `RetryPolicyEditor` | scheduler |
| `ManualRunButton` | scheduler |
| `ScreenshotButton` | screenshot-capture |
| `ScreenshotPreview` | screenshot-capture |
| `RegionPicker` | screenshot-capture |
| `ScreenshotHistory` | screenshot-capture |
| `DigestPreview` | session-digest |
| `DigestExportPanel` | session-digest |
| `DigestTemplateEditor` | session-digest |
| `DigestSendPanel` | session-digest |
| `StormMapView` | storm-data |
| `StormEventCard` | storm-data |
| `ProviderStatusGrid` | storm-data |
| `DateRangePicker` | storm-data |
| `HailSizeFilter` | storm-data |
| `CpuChart` | system-monitor |
| `MemoryChart` | system-monitor |
| `NetworkChart` | system-monitor |
| `StorageChart` | system-monitor |
| `ProcessTable` | system-monitor |
| `ServiceTable` | system-monitor |
| `SystemAlertsPanel` | system-monitor |
| `AudioUploadPanel` | transcription |
| `TranscriptViewer` | transcription |
| `SpeakerLabelEditor` | transcription |
| `TranscriptSearch` | transcription |
| `TranscriptExportButton` | transcription |
| `EmbedPlayground` | vectorize |
| `SimilaritySearchPanel` | vectorize |
| `ClusterViewer` | vectorize |
| `EmbeddingDimChart` | vectorize |
| `ClipPreview` | web-clipper |
| `TemplatePicker` | web-clipper |
| `ClipHistory` | web-clipper |
| `ClipDebugInspector` | web-clipper |
| `LiveStreamView` | webrtc-stream |
| `PeerListPanel` | webrtc-stream |
| `SignalingStatus` | webrtc-stream |
| `BandwidthChart` | webrtc-stream |
| `AudioVideoControls` | webrtc-stream |
| `ChatPanel` | webrtc-stream |
| `RoomJoinScreen` | webrtc-stream |
| `RoomLinkShare` | webrtc-stream |
| `HostControls` | webrtc-stream |
| `WhatsAppChatList` | whatsapp-bridge |
| `MessageComposer` | whatsapp-bridge |
| `MediaUploadPanel` | whatsapp-bridge |
| `ContactSearch` | whatsapp-bridge |
| `ClientDigestCard` | whatsapp-bridge |
| `ResizableWidget` | widget-framework |
| `WidgetGrid` | widget-framework |
| `CommandPalette` | widget-framework |
| `ContextMenu` | widget-framework |
| `Sidebar` | widget-framework |
| `Header` | widget-framework |
| `Notifications` | widget-framework |
| `LayoutEditor` | widget-framework |
| `WindowList` | windows-control |
| `UiaTreeViewer` | windows-control |
| `OcrTargetPicker` | windows-control |
| `TemplateMatchPanel` | windows-control |
| `ActionScopeBadge` | windows-control |

## CLI commands

| Command | Capability |
|---|---|
| `bulk-media-scrape-helpers` | bulk-media-import |
| `bulk-media-process-bundle` | bulk-media-import |
| `bulk-media-fast-upload` | bulk-media-import |
| `bulk-media-verify` | bulk-media-import |
| `cli.claude-deepseek` | deepseek-router |
| `cli.claude-deepseek.--check` | deepseek-router |
| `cli.claude-deepseek.--code` | deepseek-router |
| `cli.claude-deepseek.--agent` | deepseek-router |
| `cli.claude-deepseek.--pipeline` | deepseek-router |
| `cli.claude-deepseek.--stream` | deepseek-router |
| `cli.claude-deepseek.--include` | deepseek-router |
| `cli.claude-deepseek.--mcp-config` | deepseek-router |
| `cli.claude-deepseek.--tools` | deepseek-router |
| `cli.claude-deepseek.--continue` | deepseek-router |
| `cli.claude-deepseek.--resume` | deepseek-router |
| `cli.claude-deepseek.--longctx` | deepseek-router |
| `cli.claude-deepseek.--tier` | deepseek-router |
| `cli.claude-deepseek.--cost` | deepseek-router |
| `cli.ds-cost` | deepseek-router |

> Note: `deepseek-router` also exposes the same surface via its `runtime.cli.binaries`: `claude-deepseek`, `claude-deepseek.bat`, `ds-cost`, `ds-cost.bat`.

## Cross-capability dependencies

> From `requires.capabilities` in each manifest.

| Capability | Depends on |
|---|---|
| `ai-file-renamer` | deepseek-router |
| `ai-orchestration` | deepseek-router |
| `booking-scheduler` | webrtc-stream, notify, connector-config |
| `bulk-media-import` | intake-pipeline |
| `clipboard-bridge` | intake-pipeline |
| `cloud-storage` | connector-config, scheduler, notify, bulk-media-import |
| `cloudflare-deploy` | connector-config, notify |
| `connector-config` | _(none)_ |
| `content-dashboard` | knowledge-index, intake-pipeline |
| `deepseek-router` | _(none)_ |
| `document-ingestion` | intake-pipeline |
| `e-signature` | intake-pipeline, notify |
| `email-connector` | connector-config, scheduler |
| `everything-search` | fleet-control |
| `fleet-control` | connector-config, notify |
| `geo-visualization` | connector-config, scheduler |
| `gpu-router` | fleet-control |
| `gvoice-relay` | connector-config, notify, scheduler |
| `intake-pipeline` | _(none)_ |
| `knowledge-index` | document-ingestion, connector-config |
| `local-agent-terminal` | _(none)_ |
| `media-generation` | replicate-api, intake-pipeline, connector-config |
| `media-processing` | replicate-api |
| `mega-mount` | fleet-control, notify |
| `notify` | connector-config |
| `og-unfurl-proxy` | cloudflare-deploy, notify |
| `paypal-payments` | connector-config, notify |
| `replicate-api` | _(none)_ |
| `scheduler` | _(none)_ |
| `screenshot-capture` | intake-pipeline |
| `session-digest` | intake-pipeline, notify |
| `storm-data` | connector-config, geo-visualization, intake-pipeline |
| `system-monitor` | fleet-control, notify |
| `transcription` | intake-pipeline, knowledge-index |
| `vectorize` | gpu-router |
| `web-clipper` | intake-pipeline |
| `webrtc-stream` | connector-config, notify |
| `whatsapp-bridge` | connector-config |
| `widget-framework` | _(none)_ |
| `windows-control` | fleet-control |

## Cross-cluster handoffs (inferred)

> Events whose name prefix matches the emitter's id but whose schema appears in other capabilities' contracts/events.ts imports (best effort). Inferred from event-name conventions and `requires.capabilities` declarations.

- `intake.object.routed` (intake-pipeline) -> consumed by document-ingestion, media-processing, geo-visualization, knowledge-index, screenshot-capture, web-clipper, transcription, e-signature (everything that lists `intake-pipeline` in requires.capabilities)
- `intake.object.stored` (intake-pipeline) -> consumed by anyone that needs to read bytes (must NOT subscribe to `received`)
- `intake.object.received` (intake-pipeline) -> emitted by bulk-media-import directly (per its manifest description), threaded back into intake-pipeline so downstream routing fires
- `document.chunked` / `document.chunk.created` (document-ingestion) -> consumed by knowledge-index
- `document.ingestion.failed` (document-ingestion) -> consumed by notify per the notify manifest description
- `email.attachment.detected` (email-connector) -> consumed by intake-pipeline (via gmail-to-rag workflow)
- `email.message.received` (email-connector) -> consumed by content-dashboard, knowledge-index
- `bulk-import.file.uploaded` (bulk-media-import) -> consumed by rooflink-backfill-to-rag workflow + cloud-storage backfills
- `transcription.segment.created` (transcription) -> consumed by knowledge-index (chunks extend ChunkBase)
- `vec.embedded` (vectorize) -> consumed by knowledge-index, content-dashboard for similarity surfaces
- `media.variant.created` (media-processing) -> consumed by content-dashboard, intake-pipeline (variant lands as IntakeObject)
- `gen.asset.created` (media-generation) -> consumed by intake-pipeline (generated asset enters canonical pipeline)
- `clip.captured` / `clip.normalized` (web-clipper) -> consumed by intake-pipeline, knowledge-index
- `screenshot.captured` / `screenshot.normalized` (screenshot-capture) -> consumed by intake-pipeline; also referenced by chrome-fleet + css-error-extractor workflows
- `esig.session.completed` (e-signature) -> consumed by notify (counterparty notification), intake-pipeline (executed-PDF archive)
- `booking.confirmed` (booking-scheduler) -> consumed by notify (confirmation email), webrtc-stream (room provisioning)
- `booking.reminder.sent` / `booking.no-show` (booking-scheduler) -> consumed by notify
- `connector.health.changed` (connector-config) -> consumed by notify per the notify manifest description
- `connector.tested` (connector-config) -> consumed by every dependent capability for connection-status badges
- `scheduler.job.failed` (scheduler) -> consumed by notify per the notify manifest description; optionally consumed by local-agent-terminal for diagnostic deep-links
- `scheduler.tick` (scheduler) -> consumed by cloud-storage (scheduled-sync), email-connector (mailbox poll), gvoice-relay (poll-inbox), storm-data (cache-refresh), system-monitor (rollup), mega-mount (watchdog)
- `cost.recorded` -> emitted by CostLedger in core; consumed by any dashboard tile (cross-capability, not tied to a single emitter)
- `cf.deploy.completed` (cloudflare-deploy) -> consumed by notify, og-unfurl-proxy (worker deploy verification)
- `cf.deploy.failed` (cloudflare-deploy) -> consumed by notify
- `fleet.machine.unreachable` / `fleet.service.failed` (fleet-control) -> consumed by notify, system-monitor (alert correlation)
- `gpu.host.overloaded` (gpu-router) -> consumed by ai-orchestration (rebalance hints), media-generation (backend swap)
- `gpu.routed` (gpu-router) -> consumed by vectorize, transcription, media-generation for GPU attribution
- `mega.mount.hung` / `mega.mount.recovered` (mega-mount) -> consumed by notify
- `og-proxy.upstream.failed` (og-unfurl-proxy) -> consumed by notify
- `paypal.webhook.received` / `paypal.subscription.cancelled` (paypal-payments) -> consumed by notify
- `whatsapp.message.received` (whatsapp-bridge) -> consumed by intake-pipeline (via whatsapp-to-intake workflow), notify
- `gvoice.sms.received` (gvoice-relay) -> consumed by intake-pipeline, notify
- `rtc.room.created` / `rtc.room.ended` (webrtc-stream) -> consumed by booking-scheduler (booking-room lifecycle), notify
- `sysmon.alert.*` (system-monitor) -> consumed by notify
- `wctl.action.denied` (windows-control) -> consumed by notify (audit channel)
- `pty:send-to-claude` (local-agent-terminal) -> consumed inside local-agent-terminal only (intra-capability)
- `replicate.prediction.completed` (replicate-api) -> consumed by media-generation, media-processing
- `knowledge.sources.retrieved` (knowledge-index) -> consumed by content-dashboard, session-digest (for citations in digests)
- `digest.generated` / `digest.sent` (session-digest) -> consumed by notify, whatsapp-bridge (client-digest workflow)
- `geo.feature.created` (geo-visualization) -> consumed by storm-data (event correlation), content-dashboard
- `widget.*` / `layout.saved` (widget-framework) -> intra-capability; consumed by any dashboard host for persistence callbacks
