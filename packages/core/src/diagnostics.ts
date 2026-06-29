/**
 * Diagnostic reports.
 *
 * The PTY guide's best feature is its deterministic "walk this list in order"
 * triage ladder. This generalizes it: a capability declares its ladder of
 * probes (what to run, what to expect, what to do on failure), and we render a
 * report alongside live health. This is the difference between a demo and an
 * operational capability.
 */
import type { DiagnosticReport, DiagnosticStep, HealthStatus } from './types.js';
import { health } from './health.js';

export interface DiagnosticSpec {
  capabilityId: string;
  ladder: DiagnosticStep[];
  /** Optional extra context collected at report time. */
  collectContext?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
}

export async function buildDiagnosticReport(spec: DiagnosticSpec): Promise<DiagnosticReport> {
  const healthStatus: HealthStatus = await health.status(spec.capabilityId);
  const context = spec.collectContext ? await spec.collectContext() : undefined;
  return {
    capabilityId: spec.capabilityId,
    generatedAt: new Date().toISOString(),
    health: healthStatus,
    ladder: spec.ladder,
    context,
  };
}

/** Pretty-print a report the way the PTY runbook reads. */
export function formatReport(report: DiagnosticReport): string {
  const lines: string[] = [];
  lines.push(`# Diagnostics — ${report.capabilityId} (${report.generatedAt})`);
  lines.push(`Health: ${report.health.state.toUpperCase()} — ${report.health.summary}`);
  if (report.health.checks?.length) {
    for (const c of report.health.checks) {
      lines.push(`  [${c.state}] ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
    }
  }
  lines.push('');
  lines.push('Triage ladder (walk in order):');
  report.ladder.forEach((step, i) => {
    lines.push(`  ${i + 1}. ${step.probe}`);
    lines.push(`     expect: ${step.expect}`);
    lines.push(`     on fail: ${step.onFail}`);
  });
  if (report.context) {
    lines.push('');
    lines.push('Context: ' + JSON.stringify(report.context));
  }
  return lines.join('\n');
}
