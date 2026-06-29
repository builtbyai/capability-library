/**
 * DryRunTransaction — preview-then-apply-with-rollback semantics.
 *
 * Two capabilities need this: ai-file-renamer (rename batches) and
 * media-processing (variant creation). Both must:
 *   - stage operations and return them as a preview to the UI
 *   - apply only after explicit approval
 *   - record applied ops to an append-only log keyed by batchId
 *   - rollback by reversing the recorded log in reverse order
 *
 * Persistence is pluggable so deployments can use JSONL on disk OR a D1 table.
 *
 * Contract: apply() is FAIL-FAST (stops at first error so the operator can
 * decide). rollback() is best-effort (logs and continues so a partial mid-apply
 * crash is recoverable on restart).
 */

export interface TxOp {
  kind: string;
}

export interface Failure {
  opIndex: number;
  error: string;
}

export interface LogStore {
  append(batchId: string, entry: { dir: 'apply' | 'revert'; op: unknown; at: string }): Promise<void>;
  read(batchId: string, dir: 'apply' | 'revert'): Promise<Array<{ op: unknown; at: string }>>;
}

export interface DryRunConfig<Op extends TxOp> {
  capabilityId: string;
  logStore: LogStore;
  apply: (op: Op) => Promise<void>;
  revert: (op: Op) => Promise<void>;
}

export class DryRunTransaction<Op extends TxOp> {
  private staged = new Map<string, Op[]>();

  constructor(private cfg: DryRunConfig<Op>) {}

  stage(batchId: string, op: Op): void {
    let arr = this.staged.get(batchId);
    if (!arr) {
      arr = [];
      this.staged.set(batchId, arr);
    }
    arr.push(op);
  }

  preview(batchId: string): Op[] {
    return this.staged.get(batchId) ?? [];
  }

  async apply(batchId: string, predicate?: (op: Op) => boolean): Promise<{ applied: number; failed: Failure[] }> {
    const ops = this.preview(batchId).filter((o) => !predicate || predicate(o));
    const failed: Failure[] = [];
    let applied = 0;
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i]!;
      try {
        await this.cfg.apply(op);
        await this.cfg.logStore.append(batchId, { dir: 'apply', op, at: new Date().toISOString() });
        applied++;
      } catch (e) {
        failed.push({ opIndex: i, error: e instanceof Error ? e.message : String(e) });
        break;
      }
    }
    return { applied, failed };
  }

  async rollback(batchId: string): Promise<{ restored: number }> {
    const lines = await this.cfg.logStore.read(batchId, 'apply');
    let restored = 0;
    for (const entry of lines.slice().reverse()) {
      try {
        await this.cfg.revert(entry.op as Op);
        await this.cfg.logStore.append(batchId, { dir: 'revert', op: entry.op, at: new Date().toISOString() });
        restored++;
      } catch {
        // best-effort; continue
      }
    }
    return { restored };
  }
}

/** In-memory LogStore — useful for tests. Production should write JSONL or D1. */
export class InMemoryLogStore implements LogStore {
  private rows = new Map<string, Array<{ dir: 'apply' | 'revert'; op: unknown; at: string }>>();
  async append(batchId: string, entry: { dir: 'apply' | 'revert'; op: unknown; at: string }): Promise<void> {
    const arr = this.rows.get(batchId) ?? [];
    arr.push(entry);
    this.rows.set(batchId, arr);
  }
  async read(batchId: string, dir: 'apply' | 'revert'): Promise<Array<{ op: unknown; at: string }>> {
    return (this.rows.get(batchId) ?? []).filter((r) => r.dir === dir).map(({ op, at }) => ({ op, at }));
  }
}
