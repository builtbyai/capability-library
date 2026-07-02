# connector-config · sharp edges

## 1. Encryption key rotation is destructive without a plan
If `MMD_SECRET_ENCRYPTION_KEY` changes, every existing `secretRef` becomes garbage. Support `dual-key` mode (decrypt with old, encrypt with new on next access) and only accept full key swap via `POST /api/connectors/rotate-key`.

## 2. `config` field leakage
Developers stash refresh tokens in `config` instead of `secretRefs`. Test endpoint scans config values for token-shaped strings (length > 32, base64/hex) and rejects at write time.

## 3. Test handlers hit live services
Repeated failed tests trip provider throttles. Cap test rate to 1/min per connector and surface "tested 4s ago, please wait."

## 4. Multi-tenant key collision
Two capabilities can create "gmail-primary" with different OAuth scopes. Unique key is `(type, displayName)` — enforce at DB layer.
