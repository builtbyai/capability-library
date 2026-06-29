import { describe, it, expect } from 'vitest';
import { DryRunTransaction, InMemoryLogStore, type TxOp } from '../src/dry-run.js';

interface RenameOp extends TxOp {
  kind: 'rename';
  proposalId: string;
  from: string;
  to: string;
}

function makeEngine() {
  const fs = new Map<string, string>();
  fs.set('a.txt', 'A');
  fs.set('b.txt', 'B');

  const tx = new DryRunTransaction<RenameOp>({
    capabilityId: 'test',
    logStore: new InMemoryLogStore(),
    apply: async (op) => {
      if (!fs.has(op.from)) throw new Error(`missing source: ${op.from}`);
      if (fs.has(op.to)) throw new Error(`target exists: ${op.to}`);
      fs.set(op.to, fs.get(op.from)!);
      fs.delete(op.from);
    },
    revert: async (op) => {
      if (!fs.has(op.to)) return;
      fs.set(op.from, fs.get(op.to)!);
      fs.delete(op.to);
    },
  });
  return { tx, fs };
}

describe('DryRunTransaction', () => {
  it('stages and previews ops without applying', () => {
    const { tx, fs } = makeEngine();
    tx.stage('batch1', { kind: 'rename', proposalId: 'p1', from: 'a.txt', to: 'A.txt' });
    expect(tx.preview('batch1')).toHaveLength(1);
    expect(fs.get('a.txt')).toBe('A');
    expect(fs.has('A.txt')).toBe(false);
  });

  it('applies and emits applied count', async () => {
    const { tx, fs } = makeEngine();
    tx.stage('b1', { kind: 'rename', proposalId: 'p1', from: 'a.txt', to: 'A.txt' });
    tx.stage('b1', { kind: 'rename', proposalId: 'p2', from: 'b.txt', to: 'B.txt' });
    const r = await tx.apply('b1');
    expect(r).toEqual({ applied: 2, failed: [] });
    expect(fs.get('A.txt')).toBe('A');
    expect(fs.get('B.txt')).toBe('B');
  });

  it('rollback restores in reverse order', async () => {
    const { tx, fs } = makeEngine();
    tx.stage('b1', { kind: 'rename', proposalId: 'p1', from: 'a.txt', to: 'A.txt' });
    tx.stage('b1', { kind: 'rename', proposalId: 'p2', from: 'b.txt', to: 'B.txt' });
    await tx.apply('b1');
    const rb = await tx.rollback('b1');
    expect(rb.restored).toBe(2);
    expect(fs.get('a.txt')).toBe('A');
    expect(fs.get('b.txt')).toBe('B');
    expect(fs.has('A.txt')).toBe(false);
    expect(fs.has('B.txt')).toBe(false);
  });

  it('apply is fail-fast (stops at first error)', async () => {
    const { tx } = makeEngine();
    tx.stage('b1', { kind: 'rename', proposalId: 'p1', from: 'a.txt', to: 'A.txt' });
    tx.stage('b1', { kind: 'rename', proposalId: 'p2', from: 'missing.txt', to: 'X.txt' });
    tx.stage('b1', { kind: 'rename', proposalId: 'p3', from: 'b.txt', to: 'B.txt' });
    const r = await tx.apply('b1');
    expect(r.applied).toBe(1);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].opIndex).toBe(1);
  });

  it('partial-apply then rollback restores only what was applied', async () => {
    const { tx, fs } = makeEngine();
    tx.stage('b1', { kind: 'rename', proposalId: 'p1', from: 'a.txt', to: 'A.txt' });
    tx.stage('b1', { kind: 'rename', proposalId: 'p2', from: 'missing.txt', to: 'X.txt' });
    await tx.apply('b1');
    expect(fs.get('A.txt')).toBe('A');
    const rb = await tx.rollback('b1');
    expect(rb.restored).toBe(1);
    expect(fs.get('a.txt')).toBe('A');
  });
});
