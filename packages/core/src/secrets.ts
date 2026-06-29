/**
 * Secret resolution.
 *
 * The PTY capability already established the pattern: a secret can come from an
 * env var OR a plaintext file on disk. The connector-config capability will
 * later add an encrypted store. Capabilities depend on this interface, not on
 * where the secret physically lives.
 */
import { readFileSync, existsSync } from 'node:fs';

export interface SecretProvider {
  /** Resolve a secret by logical name; returns undefined if unset. */
  get(name: string): string | undefined;
}

export interface EnvFileProviderOptions {
  /** Map a secret name to a file path fallback, e.g. AGENT_SECRET -> backend/data/agent-secret.txt */
  fileFallbacks?: Record<string, string>;
  env?: NodeJS.ProcessEnv;
}

/** Default provider: env var first, then an optional file fallback. */
export class EnvFileSecretProvider implements SecretProvider {
  constructor(private opts: EnvFileProviderOptions = {}) {}

  get(name: string): string | undefined {
    const env = this.opts.env ?? process.env;
    const fromEnv = env[name];
    if (fromEnv && fromEnv.length > 0) return fromEnv;

    const path = this.opts.fileFallbacks?.[name];
    if (path && existsSync(path)) {
      const v = readFileSync(path, 'utf8').trim();
      if (v.length > 0) return v;
    }
    return undefined;
  }
}

/** Resolve a secret or throw with a clear message naming both lookup locations. */
export function requireSecret(
  provider: SecretProvider,
  name: string,
  hint?: string,
): string {
  const v = provider.get(name);
  if (!v) {
    throw new Error(
      `missing secret "${name}"${hint ? ` — ${hint}` : ''}. ` +
        `Set the ${name} env var or provide its file fallback.`,
    );
  }
  return v;
}

export const secrets: SecretProvider = new EnvFileSecretProvider();
