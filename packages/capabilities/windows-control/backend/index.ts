/**
 * windows-control backend entrypoint.
 *
 * Registers this capability's health checks (and job handlers, as they land)
 * with @multimarcdown/core so a host dashboard can roll it up. Call register()
 * once during host startup. Replace the placeholder check with a real probe as
 * the service is implemented.
 */
import { health } from '@multimarcdown/core';

export const CAPABILITY_ID = 'windows-control';

/** Register health checks + job handlers with the core singletons. */
export function register(): void {
  health.register(CAPABILITY_ID, 'implemented', async () => ({
    state: 'unknown',
    detail: 'windows-control: no runtime service yet — capability is contracts-first',
  }));
}
