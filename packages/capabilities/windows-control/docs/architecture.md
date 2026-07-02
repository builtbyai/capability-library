# windows-control · architecture

Implements the port defined in `contracts/events.ts`.

## Surface

- 7 API endpoints
- 4 events emitted
- 2 jobs declared

## Dependencies

Composed via: fleet-control. Secrets resolved via `connector-config` if applicable.

## Hot path

Documented at the port-method level in `contracts/events.ts`. Implementation lives in `src/` (greenfield as of this scaffolding).
