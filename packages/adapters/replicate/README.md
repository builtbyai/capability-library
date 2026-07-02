# adapter: replicate

**Implements:** HttpJsonClient port
**Summary:** Typed Replicate REST client. Currently lives at packages/capabilities/replicate-api/backend; will move here in a later refactor.

Adapters are vendor-specific implementations of capability ports. They never define new ports; they conform to ports declared in the capability that consumes them. If a second consumer needs the same provider, this is where it lives.

## Contract

See the consuming capability's `contracts/events.ts` for the port interface this adapter implements.

## Sharp edges

Vendor-specific landmines live here, not in the consuming capability. Mention environment / build / auth / quota gotchas that bite the integration.

(Scaffold — fill in as the adapter is implemented.)
