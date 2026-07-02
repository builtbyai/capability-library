# content-dashboard · architecture

Implements the port defined in `contracts/events.ts`.

## Surface

- 5 API endpoints
- 3 events emitted
- 2 jobs declared
- 6 UI surfaces

## Dependencies

Composed via: knowledge-index, intake-pipeline. Secrets resolved via `connector-config`.

## Hot path

Documented at the port-method level in `contracts/events.ts`. Implementation lives in `src/` (greenfield).
