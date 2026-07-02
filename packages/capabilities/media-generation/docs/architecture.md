# media-generation · architecture

Implements the port defined in `contracts/events.ts`.

## Surface

- 5 API endpoints
- 5 events emitted
- 3 jobs declared
- 6 UI surfaces

## Dependencies

Composed via: replicate-api, intake-pipeline, connector-config. Secrets resolved via `connector-config`.

## Hot path

Documented at the port-method level in `contracts/events.ts`. Implementation lives in `src/` (greenfield).
