# paypal-payments · architecture

Implements the port defined in `contracts/events.ts`.

## Surface

- 9 API endpoints
- 7 events emitted
- 3 jobs declared
- 7 UI surfaces

## Dependencies

Composed via: connector-config, notify.

## Hot path

Documented at the port-method level in `contracts/events.ts`. Implementation lives in `src/` (greenfield).
