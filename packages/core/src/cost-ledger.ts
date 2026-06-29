/**
 * CostLedger — uniform cost tracking across AI providers.
 *
 * deepseek-router already ships the math (contracts/pricing.schema.ts).
 * Generalize: rate cards live alongside their adapter (`packages/adapters/<x>/rates.ts`)
 * and register on module load. Capabilities that invoke models call
 * `ledger.record({ provider, capability, operation, units, unitCost, totalCost, ... })`.
 *
 * Emits `cost.recorded` on the bus so a dashboard tile or audit log can
 * listen. The emitted payload matches the canonical 1.0.0 contract defined
 * in `@multimarcdown/cost-ledger` (packages/capabilities/cost-ledger/contracts/events.ts).
 *
 * Pre-1.0.0 callers used a `CostEntry` with `capabilityId` / `costUSD` /
 * `usage`. The new canonical names are `capability` / `totalCost` / `units`.
 * Migrate via {@link CostLedger.recordLegacy} (deprecated shim, to be
 * removed in v0.2.0).
 */
import { bus } from './events.js';

export const COST_RECORDED_SCHEMA_VERSION = '1.0.0' as const;

export interface RateCard {
  providerId: string;
  unit: 'token' | 'second' | 'image' | 'request';
  /** Per-million tokens (token), per-second (second), per-image, per-request. */
  input?: number;
  inputCacheHit?: number;
  output?: number;
  flat?: number;
}

/**
 * Snapshot of budget headroom at the time a `cost.recorded` event was
 * stamped. Mirrors `BudgetSnapshotSchema` in the capability contracts.
 */
export interface BudgetSnapshot {
  scope: 'perProduct' | 'perBrandLaneDaily' | 'globalDaily';
  softCap: number;
  hardCap: number;
  remaining: number;
}

/**
 * Canonical 1.0.0 cost-ledger entry. Mirrors `CostRecordedSchema` in the
 * capability contracts. Runtime-filled fields (`entryId`, `occurredAt`)
 * are stamped by the ledger; callers pass the rest.
 */
export interface CostEntry {
  entryId: string;
  event: 'cost.recorded';
  version: typeof COST_RECORDED_SCHEMA_VERSION;
  occurredAt: string;
  capability: string;
  workflowRunId?: string;
  productCandidateId?: string;
  brandLaneId?: string;
  provider: string;
  operation: string;
  units: number;
  unitCost: number;
  totalCost: number;
  currency: 'USD';
  budget?: BudgetSnapshot;
  metadata: Record<string, unknown>;
  /** Internal extension fields kept off the bus payload. */
  rateCardId?: string;
  externalReportedUSD?: number;
  jobId?: string;
}

/** Input shape for {@link CostLedger.record} — everything the caller supplies. */
export type CostEntryInput = Omit<CostEntry, 'entryId' | 'event' | 'version' | 'occurredAt' | 'currency' | 'metadata'> & {
  currency?: 'USD';
  metadata?: Record<string, unknown>;
};

/**
 * @deprecated Pre-1.0.0 input shape kept only for the {@link CostLedger.recordLegacy}
 *   adapter. Migrate to the canonical `CostEntryInput` and call
 *   {@link CostLedger.record} directly. Scheduled for removal in v0.2.0.
 */
export interface LegacyCostEntryInput {
  capabilityId: string;
  provider: string;
  operation: string;
  rateCardId?: string;
  usage: Record<string, number>;
  costUSD: number;
  externalReportedUSD?: number;
  jobId?: string;
}

export interface CostLedgerSummary {
  totalUSD: number;
  byProvider: Record<string, number>;
  byCapability: Record<string, number>;
}

export class CostLedger {
  private entries: CostEntry[] = [];
  private cards = new Map<string, RateCard>();

  registerCard(card: RateCard): void {
    this.cards.set(card.providerId, card);
  }

  computeFromUsage(rateCardId: string, usage: Record<string, number>): number {
    const c = this.cards.get(rateCardId);
    if (!c) throw new Error(`no rate card: ${rateCardId}`);
    switch (c.unit) {
      case 'token':
        return (
          ((usage.input_fresh ?? 0) * (c.input ?? 0) +
            (usage.input_cached ?? 0) * (c.inputCacheHit ?? 0) +
            (usage.output ?? 0) * (c.output ?? 0)) /
          1e6
        );
      case 'second':
        return (usage.seconds ?? 0) * (c.flat ?? 0);
      case 'image':
        return (usage.images ?? 0) * (c.flat ?? 0);
      case 'request':
        return c.flat ?? 0;
    }
  }

  /**
   * Record a cost entry using the canonical 1.0.0 shape and emit
   * `cost.recorded` on the bus. The emitted payload conforms to
   * `CostRecordedSchema` in `@multimarcdown/cost-ledger`.
   */
  async record(input: CostEntryInput): Promise<CostEntry> {
    const full: CostEntry = {
      ...input,
      event: 'cost.recorded',
      version: COST_RECORDED_SCHEMA_VERSION,
      entryId: cryptoRandomId(),
      occurredAt: new Date().toISOString(),
      currency: input.currency ?? 'USD',
      metadata: input.metadata ?? {},
    };
    this.entries.push(full);
    await bus.emit('cost.recorded', full.capability, busPayload(full));
    return full;
  }

  /**
   * @deprecated Pre-1.0.0 entry point. Maps the legacy field names
   *   (`capabilityId` / `costUSD` / `usage`) to the canonical shape and
   *   forwards to {@link CostLedger.record}. Will be removed in v0.2.0.
   */
  async recordLegacy(legacy: LegacyCostEntryInput): Promise<CostEntry> {
    const units = sumUsage(legacy.usage);
    const unitCost = units > 0 ? legacy.costUSD / units : 0;
    return this.record({
      capability: legacy.capabilityId,
      provider: legacy.provider,
      operation: legacy.operation,
      units,
      unitCost,
      totalCost: legacy.costUSD,
      rateCardId: legacy.rateCardId,
      externalReportedUSD: legacy.externalReportedUSD,
      jobId: legacy.jobId,
      metadata: {
        legacy: true,
        usage: legacy.usage,
      },
    });
  }

  sum(filter: { capability?: string; provider?: string; since?: string } = {}): CostLedgerSummary {
    const byProvider: Record<string, number> = {};
    const byCapability: Record<string, number> = {};
    let totalUSD = 0;
    for (const e of this.entries) {
      if (filter.capability && e.capability !== filter.capability) continue;
      if (filter.provider && e.provider !== filter.provider) continue;
      if (filter.since && e.occurredAt < filter.since) continue;
      totalUSD += e.totalCost;
      byProvider[e.provider] = (byProvider[e.provider] ?? 0) + e.totalCost;
      byCapability[e.capability] = (byCapability[e.capability] ?? 0) + e.totalCost;
    }
    return { totalUSD, byProvider, byCapability };
  }

  entriesForJob(jobId: string): CostEntry[] {
    return this.entries.filter((e) => e.jobId === jobId);
  }
}

export const ledger = new CostLedger();

/**
 * Strip internal-only fields (`entryId`, `rateCardId`, `externalReportedUSD`,
 * `jobId`) before broadcasting on the bus. The bus payload is the public
 * contract; the in-memory entry keeps the bookkeeping extras.
 */
function busPayload(e: CostEntry): Omit<CostEntry, 'entryId' | 'rateCardId' | 'externalReportedUSD' | 'jobId'> {
  const { entryId: _entryId, rateCardId: _rateCardId, externalReportedUSD: _ext, jobId: _jobId, ...rest } = e;
  return rest;
}

function sumUsage(usage: Record<string, number>): number {
  let total = 0;
  for (const v of Object.values(usage)) total += v;
  return total;
}

function cryptoRandomId(): string {
  // Avoid `crypto.randomUUID` dep gate on older Node — fall back to a hex blob.
  const buf = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(buf);
  else for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}
