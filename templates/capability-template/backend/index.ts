/**
 * Backend entrypoint. Register health checks + job handlers with the core
 * singletons so the dashboard can roll this capability up.
 *
 *   import { health, jobs } from '@multimarcdown/core';
 *   health.register('<id>', 'check-name', async () => ({ state: 'healthy' }));
 *   jobs.register('<id>:doThing', async (ctx) => { ... });
 */
export {};
