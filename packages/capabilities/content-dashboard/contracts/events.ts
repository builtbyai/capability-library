/**
 * content-dashboard contracts. The dashboard port is a feed of items emitted
 * by other capabilities; these events are the user-initiated mutations
 * (pin, tag, workflow-trigger) that other capabilities (notify, knowledge-index,
 * scheduler) may want to observe.
 */
import { z } from 'zod';

export const DashboardItemRefSchema = z.object({
  itemId: z.string().uuid(),
  /** Originating capability id (web-clipper, media-generation, etc.). */
  sourceCapability: z.string(),
  /** The dotted intake/source event that produced this item, if known. */
  sourceEvent: z.string().optional(),
});
export type DashboardItemRef = z.infer<typeof DashboardItemRefSchema>;

export const DashboardItemPinnedEvent = z.object({
  event: z.literal('dashboard.item.pinned'),
  item: DashboardItemRefSchema,
  pinned: z.boolean(),
  /** User/principal that performed the pin. */
  actor: z.string(),
  at: z.string().datetime(),
});
export type DashboardItemPinned = z.infer<typeof DashboardItemPinnedEvent>;

export const DashboardItemTaggedEvent = z.object({
  event: z.literal('dashboard.item.tagged'),
  item: DashboardItemRefSchema,
  /** Full tag set after the edit, not a diff. */
  tags: z.array(z.string()),
  actor: z.string(),
  at: z.string().datetime(),
});
export type DashboardItemTagged = z.infer<typeof DashboardItemTaggedEvent>;

export const DashboardWorkflowTriggeredEvent = z.object({
  event: z.literal('dashboard.workflow.triggered'),
  item: DashboardItemRefSchema,
  /** Workflow capability/recipe identifier being invoked. */
  workflowId: z.string(),
  /** Free-form params forwarded to the workflow handler. */
  params: z.record(z.unknown()).default({}),
  actor: z.string(),
  at: z.string().datetime(),
});
export type DashboardWorkflowTriggered = z.infer<typeof DashboardWorkflowTriggeredEvent>;

export const EVENT_NAMES = {
  itemPinned: 'dashboard.item.pinned',
  itemTagged: 'dashboard.item.tagged',
  workflowTriggered: 'dashboard.workflow.triggered',
} as const;
