/**
 * Config loading.
 *
 * Each capability exports a zod schema describing its deploy-time constants
 * (the spec's "configuration schema" — the thing the PTY module was missing,
 * where CLOUD_WS_BASE / ports / paths were scattered across five files).
 * This collects them in one place and validates on load.
 */
import type { ZodType } from 'zod';

export interface LoadConfigOptions {
  /** Raw config object (e.g. parsed JSON/YAML or process.env-derived). */
  raw: unknown;
  /** Optional defaults merged under `raw`. */
  defaults?: Record<string, unknown>;
}

/** Validate raw config against a capability's schema; throws a readable error. */
export function loadConfig<T>(schema: ZodType<T>, opts: LoadConfigOptions): T {
  const merged =
    opts.defaults && isObject(opts.raw)
      ? { ...opts.defaults, ...opts.raw }
      : (opts.raw ?? opts.defaults ?? {});
  const parsed = schema.safeParse(merged);
  if (!parsed.success) {
    throw new Error('invalid config:\n' + parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n'));
  }
  return parsed.data;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
