# content-dashboard · sharp edges

## 1. Feed sources span heterogeneous time fields

web-clipper has capturedAt, intake-pipeline has receivedAt, transcription has completedAt, e-signature has session.createdAt. Normalize to a single `eventAt` at indexing time; otherwise sort order is provider-coupled.

## 2. Pinning is per-user but no auth layer exists yet

Pin state lives in the dashboard DB keyed by `userId`, but `userId` defaults to `default` if no auth provider is wired. Two browsers on the same machine share pins. Document this until auth lands.

## 3. Tag explosion erodes the value of tags

If anyone can add free-form tags, you get 50 synonyms for "important". Enforce a controlled vocabulary OR auto-merge via embedding similarity at the tag boundary (knowledge-index does this for chunks; reuse the same primitive).

## 4. Trigger-workflow from feed item needs scope check

Triggering `rag-reindex-on-model-upgrade` from a low-permission feed view = privilege escalation. The trigger button must check the user's scope BEFORE the workflow runs; never trust the UI to gate.

