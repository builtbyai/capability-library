# storm-data · architecture

Implements the port defined in `contracts/events.ts`.

## Surface

- 4 API endpoints
- 4 events emitted
- 2 jobs declared
- 5 UI surfaces

## Dependencies

Composed via: connector-config, geo-visualization, intake-pipeline. Secrets resolved via `connector-config`.

## Hot path

Documented at the port-method level in `contracts/events.ts`. Implementation lives in `src/` (greenfield).
