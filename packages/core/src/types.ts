/**
 * Core type surface shared by every MultimarcDown capability.
 *
 * The central idea (from the library spec): a capability is not a React
 * component — it is a vertically-integrated unit that knows how to install,
 * configure, mount, report health, and diagnose itself.
 */

export type CapabilityKind = 'ui' | 'feature' | 'capability' | 'workflow' | 'adapter';

export type RiskLevel =
  | 'normal'
  | 'sensitive-data'
  | 'filesystem-read'
  | 'filesystem-write'
  | 'privileged'
  | 'external-ai-processing'
  | 'scheduled-automation'
  | 'network-bridge'
  | 'data-processing'
  | 'knowledge-index'
  | 'automation';

export type HealthState = 'healthy' | 'degraded' | 'failed' | 'unknown';

export interface HealthStatus {
  state: HealthState;
  /** Short human-readable summary. */
  summary: string;
  /** Per-check detail; the union of all registered checks for this capability. */
  checks?: HealthCheckResult[];
  checkedAt: string;
}

export interface HealthCheckResult {
  name: string;
  state: HealthState;
  detail?: string;
  /** ms the check took, when measured. */
  durationMs?: number;
}

export interface DiagnosticReport {
  capabilityId: string;
  generatedAt: string;
  health: HealthStatus;
  /** Ordered remediation steps a human (or AI) can walk. */
  ladder: DiagnosticStep[];
  /** Free-form fields captured for context (e.g. DO state, ports in use). */
  context?: Record<string, unknown>;
}

export interface DiagnosticStep {
  /** e.g. "curl http://127.0.0.1:5181/status" */
  probe: string;
  /** What a passing result looks like. */
  expect: string;
  /** What to do when it fails. */
  onFail: string;
}

/**
 * The runtime contract every full-stack capability implements.
 * Lifecycle methods are intentionally optional so UI-only capabilities can opt out.
 */
export interface Capability<Config = unknown> {
  readonly id: string;
  readonly kind: CapabilityKind;

  install?(): Promise<void>;
  configure?(config: Config): Promise<void>;
  /** Mount the primary UI surface into a DOM target (browser-side only). */
  mount?(target: HTMLElement): void | (() => void);
  health?(): Promise<HealthStatus>;
  diagnostics?(): Promise<DiagnosticReport>;
  uninstall?(): Promise<void>;
}
