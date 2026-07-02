# fleet-health-rollup

**Composes:** scheduler, fleet-control, notify
**Trigger:** scheduler tick (hourly)
**Summary:** Hourly fleet health snapshot; notify on unreachable hosts + service failures

This is a wiring recipe. See `recipe.ts`.
