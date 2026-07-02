# gvoice-relay · architecture

Implements the port defined in `contracts/events.ts`.

## Surface

- 4 API endpoints
- 4 events emitted
- 3 jobs declared

## Dependencies

Composed via: connector-config, notify, scheduler. Secrets resolved via `connector-config` if applicable.

## Hot path

Documented at the port-method level in `contracts/events.ts`. Implementation lives in `src/` (greenfield as of this scaffolding).
