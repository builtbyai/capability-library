/**
 * product-registry contracts — bus events.
 *
 * Every event declared in `manifest.yaml provides.events[]` has a typed
 * zod schema here. Payloads embed `ProductSchema` only when the consumer
 * genuinely needs the full Product (e.g. `product.registered` for the
 * search-indexer); update events ship a diff to keep the bus narrow.
 *
 * Companions: see `./product.js` for the canonical Product, ScoreEntry,
 * BrandLane, CreativeWinner, SupplierLink, and ConsolidationEntry shapes
 * that this file imports.
 */
import { z } from 'zod';

import {
  BrandLaneSchema,
  ConsolidationEntrySchema,
  CreativeWinnerSchema,
  DecisionStateSchema,
  ProductIdSchema,
  ProductSchema,
  ScoreEntrySchema,
  SupplierLinkSchema,
} from './product.js';

/* ─────────────────────────────────────────────────────────────────────────
 * Registration / lifecycle
 * ──────────────────────────────────────────────────────────────────────── */

export const ProductRegisteredSchema = z.object({
  event: z.literal('product.registered'),
  product: ProductSchema,
  /** Where the registration originated. `auto-from-candidate` means a
   *  ProductCandidate from product-intelligence passed the dedupe check;
   *  `manual` means an operator entered the row directly. */
  source: z.enum(['auto-from-candidate', 'manual']),
});
export type ProductRegistered = z.infer<typeof ProductRegisteredSchema>;

export const ProductUpdatedSchema = z.object({
  event: z.literal('product.updated'),
  productId: ProductIdSchema,
  /** Field paths that changed (e.g. ['name', 'pricing.displayPriceUsd']). */
  changed: z.array(z.string()).min(1),
  /** Partial of the Product carrying just the new values for `changed`.
   *  Consumers re-fetch the full Product via GET if they need more. */
  updatedFields: ProductSchema.partial(),
});
export type ProductUpdated = z.infer<typeof ProductUpdatedSchema>;

export const ProductArchivedSchema = z.object({
  event: z.literal('product.archived'),
  productId: ProductIdSchema,
  reason: z.string(),
  archivedAt: z.string().datetime(),
});
export type ProductArchived = z.infer<typeof ProductArchivedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Brand-lane assignment (the MJB firewall — primitives 79, 80)
 * ──────────────────────────────────────────────────────────────────────── */

export const ProductLaneAssignedSchema = z.object({
  event: z.literal('product.lane.assigned'),
  productId: ProductIdSchema,
  brandLane: BrandLaneSchema,
  assignedBy: z.enum(['auto', 'operator']),
  /** Set when this is a re-assignment so downstream caps that cached the
   *  prior lane (social-distribution, content-dashboard) know to re-check
   *  their per-lane connector-config bindings. */
  priorLane: BrandLaneSchema.optional(),
});
export type ProductLaneAssigned = z.infer<typeof ProductLaneAssignedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Scoring history (append-only — primitives 21, 92)
 * ──────────────────────────────────────────────────────────────────────── */

export const ProductScoreHistoryAppendedSchema = z.object({
  event: z.literal('product.score-history.appended'),
  productId: ProductIdSchema,
  scoreEntry: ScoreEntrySchema,
  /** If the append changed the parent Product's decisionState, the prior
   *  value goes here so consumers can detect transitions without a diff. */
  replacedDecisionState: DecisionStateSchema.optional(),
});
export type ProductScoreHistoryAppended = z.infer<typeof ProductScoreHistoryAppendedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Consolidation / dedupe
 * ──────────────────────────────────────────────────────────────────────── */

export const ProductConsolidatedSchema = z.object({
  event: z.literal('product.consolidated'),
  survivingProductId: ProductIdSchema,
  mergedFromProductIds: z.array(ProductIdSchema).min(1),
  consolidationEntry: ConsolidationEntrySchema,
});
export type ProductConsolidated = z.infer<typeof ProductConsolidatedSchema>;

export const ProductDuplicateDetectedSchema = z.object({
  event: z.literal('product.duplicate.detected'),
  /** The just-arrived candidate (transient — has no productId yet) or the
   *  freshly-registered product if dedupe ran post-write. */
  candidateProductId: ProductIdSchema,
  existingProductId: ProductIdSchema,
  /** 0..1. The 0.6-0.9 band routes to manual review (see README). */
  dedupeScore: z.number().min(0).max(1),
  action: z.enum(['auto-merged', 'flagged-for-review', 'rejected']),
});
export type ProductDuplicateDetected = z.infer<typeof ProductDuplicateDetectedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Cluster assignment (from vectorize — primitive 45)
 * ──────────────────────────────────────────────────────────────────────── */

export const ProductClusterAssignedSchema = z.object({
  event: z.literal('product.cluster.assigned'),
  productId: ProductIdSchema,
  clusterId: z.string(),
  confidence: z.number().min(0).max(1),
  source: z.literal('vectorize'),
});
export type ProductClusterAssigned = z.infer<typeof ProductClusterAssignedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Creative-winner recording (primitive 100)
 * ──────────────────────────────────────────────────────────────────────── */

export const ProductCreativeWinnerRecordedSchema = z.object({
  event: z.literal('product.creative-winner.recorded'),
  productId: ProductIdSchema,
  winner: CreativeWinnerSchema,
});
export type ProductCreativeWinnerRecorded = z.infer<typeof ProductCreativeWinnerRecordedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Candidate rejection (the dedupe-check rejection path)
 * ──────────────────────────────────────────────────────────────────────── */

export const ProductCandidateRejectedSchema = z.object({
  event: z.literal('product.candidate.rejected'),
  /** ProductCandidate id from product-intelligence (uuid). */
  candidateId: z.string().uuid(),
  reason: z.enum(['duplicate', 'red-flag', 'below-band', 'manual-skip']),
  notes: z.string().optional(),
});
export type ProductCandidateRejected = z.infer<typeof ProductCandidateRejectedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Supplier link / unlink
 * ──────────────────────────────────────────────────────────────────────── */

export const SupplierLinkedSchema = z.object({
  event: z.literal('supplier.linked'),
  productId: ProductIdSchema,
  supplierLink: SupplierLinkSchema,
});
export type SupplierLinked = z.infer<typeof SupplierLinkedSchema>;

export const SupplierUnlinkedSchema = z.object({
  event: z.literal('supplier.unlinked'),
  productId: ProductIdSchema,
  supplierLink: SupplierLinkSchema,
});
export type SupplierUnlinked = z.infer<typeof SupplierUnlinkedSchema>;

/* ─────────────────────────────────────────────────────────────────────────
 * Event name registry
 * ──────────────────────────────────────────────────────────────────────── */

export const EVENT_NAMES = {
  registered: 'product.registered',
  updated: 'product.updated',
  laneAssigned: 'product.lane.assigned',
  scoreHistoryAppended: 'product.score-history.appended',
  archived: 'product.archived',
  consolidated: 'product.consolidated',
  duplicateDetected: 'product.duplicate.detected',
  clusterAssigned: 'product.cluster.assigned',
  creativeWinnerRecorded: 'product.creative-winner.recorded',
  candidateRejected: 'product.candidate.rejected',
  supplierLinked: 'supplier.linked',
  supplierUnlinked: 'supplier.unlinked',
} as const;
