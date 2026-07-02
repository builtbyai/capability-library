# cloud-storage · architecture

Implements the port defined in `contracts/events.ts`.

## Surface

- 8 API endpoints
- 6 events emitted
- 4 jobs declared
- 6 UI surfaces

## Dependencies

Composed via: connector-config, scheduler, notify, bulk-media-import. Secrets resolved via `connector-config`.

## Hot path

Documented at the port-method level in `contracts/events.ts`. Implementation lives in `src/` (greenfield).
