# webrtc-stream · architecture

Implements the port defined in `contracts/events.ts`.

## Surface

- 5 API endpoints
- 5 events emitted
- 3 jobs declared
- 5 UI surfaces

## Dependencies

Composed via: connector-config, notify. Secrets resolved via `connector-config`.

## Hot path

Documented at the port-method level in `contracts/events.ts`. Implementation lives in `src/` (greenfield).
