/**
 * MultimarcDown — aggregate entry point ("seed export surface").
 *
 * Re-exports the core abstractions every capability builds on. Individual
 * capabilities, adapters, and workflows are consumed via their own workspace
 * packages (e.g. `@multimarcdown/local-agent-terminal`); this file is the
 * single-import surface for the core layer + the registry/catalog helpers.
 *
 *   import { bus, jobs, health, loadRegistry, resolveCapabilities } from 'multimarcdown';
 *
 * Typechecked in CI via `tsconfig.entry.json` so it can never dangle again
 * (the previous version re-exported non-existent root-relative paths).
 */
export * from '@multimarcdown/core';
