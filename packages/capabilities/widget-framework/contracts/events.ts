/**
 * widget-framework contracts. Drag-and-drop resizable widget grid + shell primitives
 * (Sidebar, Header, CommandPalette, ContextMenu, Notifications). Workspace-aware;
 * events fire whenever a user mutates layout so persistence + telemetry can react.
 */
import { z } from 'zod';

export const WidgetPositionSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
export type WidgetPosition = z.infer<typeof WidgetPositionSchema>;

export const WidgetAddedEvent = z.object({
  event: z.literal('widget.added'),
  layoutId: z.string().uuid(),
  widgetId: z.string(),
  widgetType: z.string(),
  position: WidgetPositionSchema,
  userId: z.string().optional(),
  at: z.string().datetime(),
});
export type WidgetAdded = z.infer<typeof WidgetAddedEvent>;

export const WidgetRemovedEvent = z.object({
  event: z.literal('widget.removed'),
  layoutId: z.string().uuid(),
  widgetId: z.string(),
  userId: z.string().optional(),
  at: z.string().datetime(),
});
export type WidgetRemoved = z.infer<typeof WidgetRemovedEvent>;

export const WidgetMovedEvent = z.object({
  event: z.literal('widget.moved'),
  layoutId: z.string().uuid(),
  widgetId: z.string(),
  from: WidgetPositionSchema,
  to: WidgetPositionSchema,
  userId: z.string().optional(),
  at: z.string().datetime(),
});
export type WidgetMoved = z.infer<typeof WidgetMovedEvent>;

export const WidgetResizedEvent = z.object({
  event: z.literal('widget.resized'),
  layoutId: z.string().uuid(),
  widgetId: z.string(),
  from: WidgetPositionSchema,
  to: WidgetPositionSchema,
  userId: z.string().optional(),
  at: z.string().datetime(),
});
export type WidgetResized = z.infer<typeof WidgetResizedEvent>;

export const LayoutSavedEvent = z.object({
  event: z.literal('layout.saved'),
  layoutId: z.string().uuid(),
  userId: z.string().optional(),
  widgetCount: z.number().int().nonnegative(),
  at: z.string().datetime(),
});
export type LayoutSaved = z.infer<typeof LayoutSavedEvent>;

export const EVENT_NAMES = {
  added: 'widget.added',
  removed: 'widget.removed',
  moved: 'widget.moved',
  resized: 'widget.resized',
  layoutSaved: 'layout.saved',
} as const;
