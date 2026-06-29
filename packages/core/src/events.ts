/**
 * A tiny typed event bus.
 *
 * The library rule (from the spec): capabilities communicate through normalized
 * events, not direct calls. Gmail emits `email.message.received`; the scheduler,
 * document-ingestion, and knowledge-index subscribe. That decoupling is what lets
 * you swap Gmail for IMAP without touching downstream automation.
 *
 * Capabilities declare their event names in `provides.events` (manifest.yaml) and
 * register concrete payload shapes here at runtime.
 */

export interface CoreEvent<T = unknown> {
  /** Dotted event name, e.g. 'email.message.received'. */
  event: string;
  /** Capability id that emitted it. */
  source: string;
  /** ISO timestamp. */
  at: string;
  payload: T;
}

export type EventHandler<T = unknown> = (e: CoreEvent<T>) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private wildcard = new Set<EventHandler>();

  /** Subscribe to one event name, or '*' for everything. Returns an unsubscribe fn. */
  on<T = unknown>(event: string, handler: EventHandler<T>): () => void {
    const set = event === '*' ? this.wildcard : this.getSet(event);
    set.add(handler as EventHandler);
    return () => set.delete(handler as EventHandler);
  }

  /** Subscribe to all events whose name starts with `prefix.` (e.g. 'document.'). */
  onPrefix<T = unknown>(prefix: string, handler: EventHandler<T>): () => void {
    const wrapped: EventHandler = (e) => {
      if (e.event === prefix || e.event.startsWith(prefix.endsWith('.') ? prefix : prefix + '.')) {
        return handler(e as CoreEvent<T>);
      }
    };
    this.wildcard.add(wrapped);
    return () => this.wildcard.delete(wrapped);
  }

  async emit<T = unknown>(event: string, source: string, payload: T): Promise<void> {
    const e: CoreEvent<T> = { event, source, at: new Date().toISOString(), payload };
    const direct = this.handlers.get(event);
    const targets = [...(direct ?? []), ...this.wildcard];
    await Promise.all(targets.map((h) => Promise.resolve(h(e as CoreEvent)).catch(reportHandlerError(event))));
  }

  private getSet(event: string): Set<EventHandler> {
    let s = this.handlers.get(event);
    if (!s) {
      s = new Set();
      this.handlers.set(event, s);
    }
    return s;
  }
}

function reportHandlerError(event: string) {
  return (err: unknown) => {
    // Handlers must never break the emitter; surface and continue.
    console.error(`[events] handler for "${event}" threw:`, err);
  };
}

/** Shared process-wide bus. Capabilities import this rather than newing their own. */
export const bus = new EventBus();
