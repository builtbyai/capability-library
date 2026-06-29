/**
 * Loads registry.yaml + each capability's manifest.yaml and validates them.
 *
 * Run directly to print the catalog:
 *   node --loader ts-node/esm packages/core/src/registry.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { z } from 'zod';
import { CapabilityManifestSchema, type CapabilityManifest, safeParseManifest } from './manifest.js';

const RegistryEntrySchema = z.object({
  id: z.string(),
  path: z.string(),
  kind: z.string(),
  status: z.string().default('planned'),
  riskLevel: z.string().default('normal'),
  summary: z.string().default(''),
});

const RegistrySchema = z.object({
  version: z.string(),
  kinds: z.record(z.string()).optional(),
  capabilities: z.array(RegistryEntrySchema),
  core: z.array(z.string()).optional(),
});

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;
export type Registry = z.infer<typeof RegistrySchema>;

export interface ResolvedCapability {
  entry: RegistryEntry;
  manifest?: CapabilityManifest;
  manifestError?: string;
}

/** Walk up from a starting dir to find the repo root (the dir holding registry.yaml). */
export function findRepoRoot(start: string = process.cwd()): string {
  let dir = resolve(start);
  for (let i = 0; i < 12; i++) {
    if (existsSync(join(dir, 'registry.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('registry.yaml not found walking up from ' + start);
}

export function loadRegistry(repoRoot: string = findRepoRoot()): Registry {
  const raw = yaml.load(readFileSync(join(repoRoot, 'registry.yaml'), 'utf8'));
  return RegistrySchema.parse(raw);
}

/** Load the registry and each entry's manifest.yaml, validating both. */
export function resolveCapabilities(repoRoot: string = findRepoRoot()): ResolvedCapability[] {
  const registry = loadRegistry(repoRoot);
  return registry.capabilities.map((entry) => {
    const manifestPath = join(repoRoot, entry.path, 'manifest.yaml');
    if (!existsSync(manifestPath)) {
      return { entry, manifestError: 'manifest.yaml missing' };
    }
    const rawManifest = yaml.load(readFileSync(manifestPath, 'utf8'));
    const parsed = safeParseManifest(rawManifest);
    if (!parsed.success) {
      return { entry, manifestError: parsed.error.message };
    }
    return { entry, manifest: parsed.data };
  });
}

// --- CLI: print the catalog when run directly -------------------------------
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const root = findRepoRoot();
  const registry = loadRegistry(root);
  console.log(`MultimarcDown registry v${registry.version} — ${registry.capabilities.length} capabilities\n`);
  let invalid = 0;
  for (const cap of resolveCapabilities(root)) {
    const status = cap.manifest ? '✓' : cap.manifestError ? '⚠' : '·';
    console.log(`${status} ${cap.entry.id.padEnd(22)} [${cap.entry.riskLevel}] ${cap.entry.status}`);
    if (cap.manifestError) {
      invalid++;
      console.log(`    manifest: ${cap.manifestError}`);
    }
  }
  // Real gate: fail the process (and CI) if any manifest didn't validate.
  if (invalid > 0) {
    console.error(`\n${invalid} manifest(s) failed validation`);
    process.exit(1);
  }
}

// Re-export for convenience
export { CapabilityManifestSchema };
