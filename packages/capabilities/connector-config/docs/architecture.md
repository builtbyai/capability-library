# connector-config · architecture

`registerConnectorType({type, configSchema, secretsSchema, test})` is called by consumer capabilities at boot (email-connector for gmail+imap, knowledge-index for vectorize, etc.). The registry serves the UI `ConnectorCard` and the test runner.

Secrets are AES-256-GCM encrypted with `MMD_SECRET_ENCRYPTION_KEY` (32 bytes). Storage rows hold `{ connectorId, type, displayName, config, secretRefs[] }` — never plaintext secrets. Consumers receive opaque `secretRef` ids and call `resolveSecret(ref)` at runtime.
