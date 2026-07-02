# connector-config  ·  _planned_

One reusable system to add, validate, store (encrypted), and test external
connections. Every other capability references a connector by id instead of
building its own credential UI.

**Surfaces:** ConnectorCard, SecretInput, TestConnectionButton, ConnectionStatusBadge, PermissionScopeViewer
**Emits:** `connector.created`, `connector.tested`, `connector.health.changed`

**Canonical model** (`contracts/events.ts`):
```ts
type ConnectorConfig = {
  connectorId: string;
  type: 'gmail' | 'imap' | 'smtp' | 'cloudflare' | 'google_maps' | 'filesystem' | 'r2' | 'custom_api';
  displayName: string;
  status: 'unconfigured' | 'healthy' | 'degraded' | 'failed';
  config: Record<string, unknown>;
  secretRefs: string[];      // pointers into the encrypted store, never raw secrets
  createdAt: string; updatedAt: string;
};
```

**Boundary rule:** secrets live only in the encrypted store; capabilities receive
`secretRefs`, never plaintext. To implement, follow `local-agent-terminal`.
